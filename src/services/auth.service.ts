import { Service, logger, type IAgentRuntime, type UUID, getSalt, encryptObjectValues } from "@elizaos/core";
import { DatabaseService } from "./database.service";
import type {
  IAuthService,
  ServiceName,
  OAuthSession,
  ConnectionStatus,
} from "../types/auth.types";
import { LRUCache } from "lru-cache";
import { getCredentials as getCredentialsUtil } from "../utils/credentials";

import { randomBytes } from "crypto";

/**
 * Authentication service for managing agent credentials to external services
 */
export class AuthService extends Service implements IAuthService {
  static serviceType = "auth";

  private oauthCache: LRUCache<string, any>;

  private get databaseService(): DatabaseService {
    const dbService = this.runtime.getService("database") as DatabaseService;
    if (!dbService) {
      throw new Error("Database service not available");
    }
    return dbService;
  }

  constructor(runtime: IAgentRuntime) {
    super(runtime);

    this.oauthCache = new LRUCache<string, any>({
      max: 1000,
      ttl: 1000 * 60 * 15, // 15 minutes
    });
  }

  get capabilityDescription(): string {
    return "Authentication service for managing agent credentials to external services";
  }

  /**
   * Generate a secure random state parameter for OAuth
   */
  generateOAuthState(): string {
    return randomBytes(32).toString("hex");
  }

  static async start(runtime: IAgentRuntime): Promise<AuthService> {
    const service = new AuthService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const service = runtime.getService(AuthService.serviceType);
    if (service) {
      await service.stop();
    }
  }

  async stop(): Promise<void> {
    // No cleanup needed
  }

  async storeCredentials(
    agentId: UUID,
    service: ServiceName,
    credentials: Record<string, any>,
  ): Promise<void> {
    try {
      const salt = getSalt();
      const encryptedCredentials = encryptObjectValues(credentials, salt);

      await this.databaseService.storeCredentials(agentId, service, {
        encryptedData: encryptedCredentials,
      });
    } catch (error) {
      logger.error(`Failed to store credentials for service '${service}':`, error);
      throw error;
    }
  }

  async getCredentials(
    agentId: UUID,
    service: ServiceName
  ): Promise<Record<string, any> | null> {
    return getCredentialsUtil(this.runtime, service);
  }

  async revokeCredentials(agentId: UUID, service: ServiceName): Promise<void> {
    if (service !== "twitter") {
      return;
    }
    await this.databaseService.deleteCredentials(agentId, service);
  }

  async getConnectionStatus(
    agentId: UUID,
    service: ServiceName,
  ): Promise<ConnectionStatus> {
    const credentials = await this.getCredentials(agentId, service);

    const settingsKeys: Partial<Record<ServiceName, string[]>> = {
      twitter: ["TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_TOKEN_SECRET"],
    };

    // Get settings from runtime
    const serviceSettingKeys = settingsKeys[service];
    const settings = serviceSettingKeys?.reduce(
      (acc: Record<string, any>, key: string) => {
        acc[key] = this.runtime.getSetting(key);
        return acc;
      },
      {},
    );

    const settingsToCredentialKeyMap: Partial<Record<ServiceName, Record<string, string>>> = {
      twitter: {
        TWITTER_ACCESS_TOKEN: "accessToken",
        TWITTER_ACCESS_TOKEN_SECRET: "accessTokenSecret",
      },
    };

    // Determine if the connection is pending
    const isPending = (() => {
      // If there are no credentials, it can't be pending. It's just disconnected.
      if (!credentials) {
        return false;
      }

      // If there are credentials, check if they differ from settings.
      if (settings) {
        const keyMap = settingsToCredentialKeyMap[service];
        if (!keyMap) return false;

        return Object.keys(settings).some((settingKey) => {
          const credentialKey = keyMap[settingKey];
          // Only compare if the setting is actually present in the runtime.
          return (
            settings[settingKey] &&
            settings[settingKey] !== credentials[credentialKey]
          );
        });
      }

      // If no settings are defined for this service, it can't be pending.
      return false;
    })();

    return {
      serviceName: service,
      isConnected: !!credentials,
      isPending,
      lastChecked: new Date(),
    };
  }

  storeTempCredentials(key: string, credentials: Record<string, any>): void {
    this.oauthCache.set(`temp:${key}`, credentials);
  }

  getTempCredentials(key: string): Record<string, any> | null {
    const credentials = this.oauthCache.get(`temp:${key}`);
    return credentials ? (credentials as Record<string, any>) : null;
  }

  deleteTempCredentials(key: string): void {
    this.oauthCache.delete(`temp:${key}`);
  }

  async createOAuthSession(
    agentId: UUID,
    service: ServiceName,
    state: string,
    returnUrl?: string
  ): Promise<void> {
    const sessionData: OAuthSession = {
      id: crypto.randomUUID() as UUID,
      agentId,
      serviceName: service,
      state,
      returnUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      createdAt: new Date(),
    };
    this.oauthCache.set(`session:${state}`, sessionData);
  }
}
