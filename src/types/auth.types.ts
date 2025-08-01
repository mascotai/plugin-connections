import type { UUID } from "@elizaos/core";

/**
 * Supported external services
 */
export type ServiceName = "twitter" | "discord" | "telegram" | "github" | "google" | "facebook" | "linkedin" | "instagram" | "tiktok" | "youtube" | "other";

/**
 * Service credential storage structure
 */
export interface ServiceCredential {
  id: UUID;
  agentId: UUID;
  serviceName: ServiceName;
  credentials: Record<string, any>; // Encrypted credential data
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OAuth session tracking
 */
export interface OAuthSession {
  id: UUID;
  agentId: UUID;
  serviceName: ServiceName;
  state: string;
  codeVerifier?: string;
  returnUrl?: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Twitter-specific credential structure
 */
export interface TwitterCredentials {
  apiKey: string;
  apiSecretKey: string;
  accessToken: string;
  accessTokenSecret: string;
  userId?: string;
  username?: string;
}

/**
 * OAuth flow initiation request
 */
export interface OAuthInitiateRequest {
  agentId: UUID;
  serviceName: ServiceName;
  returnUrl?: string;
}

/**
 * OAuth flow completion request
 */
export interface OAuthCompleteRequest {
  agentId: UUID;
  serviceName: ServiceName;
  code: string;
  state: string;
  oauthToken?: string;
  oauthVerifier?: string;
}

/**
 * Connection status response
 */
export interface ConnectionStatus {
  serviceName: ServiceName;
  isConnected: boolean;
  isPending: boolean;
  username?: string;
  userId?: string;
  expiresAt?: Date;
  lastChecked: Date;
}

/**
 * Auth service interface
 */
export interface IAuthService {
  
  getCredentials(
    agentId: UUID,
    service: ServiceName,
  ): Promise<Record<string, any> | null>;
  revokeCredentials(agentId: UUID, service: ServiceName): Promise<void>;

  storeCredentials(
    agentId: UUID,
    service: ServiceName,
    credentials: Record<string, any>,
  ): Promise<void>;
  getConnectionStatus(
    agentId: UUID,
    service: ServiceName,
  ): Promise<ConnectionStatus>;
}

/**
 * Encryption service interface
 */
export interface IEncryptionService {
  encrypt(data: string): string;
  decrypt(encryptedData: string): string;
  isEnabled(): boolean;
}
