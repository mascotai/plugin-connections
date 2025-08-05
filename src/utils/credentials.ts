import { logger, type IAgentRuntime } from "@elizaos/core";
import { eq, and } from "drizzle-orm";
import { serviceCredentialsTable } from "../schema/service-credentials";
import type { ServiceName } from "../types/auth.types";
import { decryptObjectValues, getSalt } from "@elizaos/core";

/**
 * Gets and decrypts credentials for a given service from the database.
 */
export async function getCredentials(
  runtime: IAgentRuntime,
  serviceName: ServiceName
): Promise<Record<string, any> | null> {
  if (!runtime.db) {
    return null;
  }

  try {
    const result = await runtime.db
      .select()
      .from(serviceCredentialsTable)
      .where(
        and(
          eq(serviceCredentialsTable.agentId, runtime.agentId),
          eq(serviceCredentialsTable.serviceName, serviceName),
          eq(serviceCredentialsTable.isActive, true)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const credentialData = result[0].credentials as any;

    if (credentialData && credentialData.encryptedData) {
      const salt = getSalt();
      return decryptObjectValues(credentialData.encryptedData, salt);
    }

    return credentialData;
  } catch (error) {
    logger.error(`Failed to get credentials for ${serviceName}:`, error);
    return null;
  }
}