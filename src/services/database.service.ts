import { Service, logger, type IAgentRuntime, type UUID } from "@elizaos/core";
import { eq, and, sql } from "drizzle-orm";
import { serviceCredentialsTable } from "../schema/service-credentials";
import type {
  ServiceName,
  ConnectionStatus,
} from "../types/auth.types";
import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

/**
 * Manages database tables and operations for the connections plugin.
 * Note: This service is currently not actively used as credentials are stored in agent settings.
 */
export class DatabaseService extends Service {
  static serviceType = "database";
  private tablesCreated = false;

  // The runtime is essential for database access.
  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
  }

  get capabilityDescription(): string {
    return "Database service for managing connections plugin database operations";
  }

  /**
   * Direct access to the database via the runtime.
   */
  private get db(): NodePgDatabase<Record<string, unknown>> {
    if (!this.runtime.db) {
      throw new Error("Database not available. Ensure @elizaos/plugin-sql is loaded before this plugin.");
    }
    return this.runtime.db;
  }

  /**
   * Creates and starts the database service.
   */
  static async start(runtime: IAgentRuntime): Promise<DatabaseService> {
    logger.info("Starting DatabaseService for connections plugin...");
    const service = new DatabaseService(runtime);
    await service.initialize();
    logger.info("DatabaseService for connections started successfully.");
    return service;
  }

  /**
   * Instance-specific stop method.
   * This service does not manage any persistent connections or intervals,
   * so no specific cleanup is required here.
   */
  async stop(): Promise<void> {
    // No operation needed.
  }

  /**
   * Initializes the database service and creates tables if they don't exist.
   */
  async initialize(): Promise<void> {
    try {
      await this.createTables();
    } catch (error) {
      logger.error("Failed to initialize DatabaseService for connections:", error);
      throw error;
    }
  }

  /**
   * Creates all necessary tables for the connections plugin.
   */
  private async createTables(): Promise<void> {
    if (this.tablesCreated) {
      return;
    }

    try {
      logger.info("Attempting to create database tables for connections plugin...");

      // Use a transaction to ensure all schema changes are applied atomically.
      await this.db.transaction(async (tx: PgTransaction<NodePgQueryResultHKT, Record<string, unknown>, ExtractTablesWithRelations<Record<string, unknown>>>) => {
        await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS plugin_connections`);

        await tx.execute(sql`
          DO $$ BEGIN
            CREATE TYPE plugin_connections.service_type AS ENUM (
              'twitter', 'discord', 'telegram', 'github', 'google', 
              'facebook', 'linkedin', 'instagram', 'tiktok', 'youtube', 'other'
            );
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);

        await tx.execute(sql`
          CREATE TABLE IF NOT EXISTS plugin_connections.service_credentials (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_id UUID NOT NULL,
            service_name plugin_connections.service_type NOT NULL,
            credentials JSONB NOT NULL DEFAULT '{}',
            is_active BOOLEAN NOT NULL DEFAULT true,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT service_credentials_agent_service_unique UNIQUE (agent_id, service_name)
          );
        `);

        await tx.execute(sql`CREATE INDEX IF NOT EXISTS service_credentials_agent_id_idx ON plugin_connections.service_credentials (agent_id)`);
        await tx.execute(sql`CREATE INDEX IF NOT EXISTS service_credentials_service_name_idx ON plugin_connections.service_credentials (service_name)`);
      });

      this.tablesCreated = true;
      logger.info("Database tables for connections plugin created or already exist.");
    } catch (error) {
      logger.error("Failed to create database tables for connections plugin:", error);
      throw error;
    }
  }

  /**
   * Validate database connection.
   */
  async validateConnection(): Promise<void> {
    try {
      await this.db.execute(sql`SELECT 1`);
    } catch (error) {
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  /**
   * Store encrypted credentials for a service.
   */
  async storeCredentials(
    agentId: UUID,
    service: ServiceName,
    credentials: Record<string, any>,
  ): Promise<void> {
    try {
      // Use raw SQL for upsert due to Drizzle typing issues
      await this.db.execute(sql`
        INSERT INTO plugin_connections.service_credentials (
          agent_id, service_name, credentials, is_active, updated_at
        ) VALUES (
          ${agentId}, ${service}, ${JSON.stringify(credentials)}, true, now()
        )
        ON CONFLICT (agent_id, service_name) 
        DO UPDATE SET 
          credentials = ${JSON.stringify(credentials)},
          is_active = true,
          updated_at = now()
      `);
    } catch (error) {
      logger.error(`Failed to store credentials for service '${service}':`, error);
      throw error;
    }
  }

  /**
   * Get encrypted credentials for a service.
   */
  async getCredentials(
    agentId: UUID,
    service: ServiceName,
  ): Promise<Record<string, any> | null> {
    try {
      const result = await this.db
        .select()
        .from(serviceCredentialsTable)
        .where(
          and(
            eq(serviceCredentialsTable.agentId, agentId),
            eq(serviceCredentialsTable.serviceName, service),
            eq(serviceCredentialsTable.isActive, true),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }
      return result[0].credentials as Record<string, any>;
    } catch (error) {
      logger.error(`Failed to get credentials for service '${service}':`, error);
      throw error;
    }
  }

  /**
   * Delete credentials for a service.
   */
  async deleteCredentials(agentId: UUID, service: ServiceName): Promise<void> {
    try {
      await this.db
        .delete(serviceCredentialsTable)
        .where(
          and(
            eq(serviceCredentialsTable.agentId, agentId),
            eq(serviceCredentialsTable.serviceName, service),
          ),
        );
    } catch (error) {
      logger.error(`Failed to delete credentials for service '${service}':`, error);
      throw error;
    }
  }

  /**
   * Get connection status for all services for an agent.
   */
  async getConnectionStatus(agentId: UUID): Promise<ConnectionStatus[]> {
    try {
      const credentials = await this.db
        .select()
        .from(serviceCredentialsTable)
        .where(eq(serviceCredentialsTable.agentId, agentId));

      return credentials.map((cred: any) => ({
        serviceName: cred.serviceName,
        isConnected: cred.isActive === true,
        isPending: false, // Default to false, auth service will determine actual state
        lastChecked: cred.updatedAt,
      }));
    } catch (error) {
      logger.error("Failed to get connection status:", error);
      throw error;
    }
  }

  /**
   * Check if service has credentials.
   */
  async hasCredentials(agentId: UUID, service: ServiceName): Promise<boolean> {
    try {
      const credentials = await this.getCredentials(agentId, service);
      return credentials !== null;
    } catch (error) {
      logger.error(`Failed to check credentials for service '${service}':`, error);
      return false;
    }
  }
}