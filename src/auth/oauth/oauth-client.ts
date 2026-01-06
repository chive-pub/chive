/**
 * OAuth 2.0 client management.
 *
 * @remarks
 * Manages registered OAuth clients for Chive API access.
 * Implements client registration and validation per RFC 6749.
 *
 * @packageDocumentation
 * @public
 */

import { createHash, randomBytes } from 'node:crypto';

import type { Redis } from 'ioredis';

import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { OAuthError } from '../errors.js';

/**
 * OAuth client type.
 *
 * @remarks
 * - `confidential`: Server-side applications that can keep secrets
 * - `public`: Client-side/mobile apps that cannot keep secrets (PKCE required)
 *
 * @public
 */
export type ClientType = 'confidential' | 'public';

/**
 * OAuth grant types.
 *
 * @public
 */
export type GrantType = 'authorization_code' | 'refresh_token' | 'client_credentials';

/**
 * OAuth client registration data.
 *
 * @public
 */
export interface OAuthClient {
  /**
   * Unique client identifier.
   */
  readonly clientId: string;

  /**
   * Client secret hash (confidential clients only).
   */
  readonly clientSecretHash?: string;

  /**
   * Client type.
   */
  readonly clientType: ClientType;

  /**
   * Client name for display.
   */
  readonly clientName: string;

  /**
   * Client description.
   */
  readonly description?: string;

  /**
   * Registered redirect URIs.
   */
  readonly redirectUris: readonly string[];

  /**
   * Allowed grant types.
   */
  readonly grantTypes: readonly GrantType[];

  /**
   * Allowed scopes.
   */
  readonly allowedScopes: readonly string[];

  /**
   * Client logo URL.
   */
  readonly logoUri?: string;

  /**
   * Client homepage URL.
   */
  readonly clientUri?: string;

  /**
   * Privacy policy URL.
   */
  readonly policyUri?: string;

  /**
   * Terms of service URL.
   */
  readonly tosUri?: string;

  /**
   * Client registration timestamp.
   */
  readonly createdAt: Date;

  /**
   * Last update timestamp.
   */
  readonly updatedAt?: Date;

  /**
   * Whether client is active.
   */
  readonly active: boolean;
}

/**
 * Client registration request.
 *
 * @public
 */
export interface ClientRegistrationRequest {
  /**
   * Client name.
   */
  readonly clientName: string;

  /**
   * Client type.
   */
  readonly clientType: ClientType;

  /**
   * Redirect URIs.
   */
  readonly redirectUris: readonly string[];

  /**
   * Requested grant types.
   */
  readonly grantTypes?: readonly GrantType[];

  /**
   * Requested scopes.
   */
  readonly requestedScopes?: readonly string[];

  /**
   * Client description.
   */
  readonly description?: string;

  /**
   * Client logo URL.
   */
  readonly logoUri?: string;

  /**
   * Client homepage URL.
   */
  readonly clientUri?: string;

  /**
   * Privacy policy URL.
   */
  readonly policyUri?: string;

  /**
   * Terms of service URL.
   */
  readonly tosUri?: string;
}

/**
 * Client registration response.
 *
 * @public
 */
export interface ClientRegistrationResponse {
  /**
   * Registered client.
   */
  readonly client: OAuthClient;

  /**
   * Client secret (only returned once for confidential clients).
   */
  readonly clientSecret?: string;
}

/**
 * OAuth client manager configuration.
 *
 * @public
 */
export interface OAuthClientManagerConfig {
  /**
   * Redis key prefix.
   *
   * @defaultValue 'chive:oauth:client:'
   */
  readonly clientPrefix?: string;

  /**
   * Default allowed scopes for new clients.
   */
  readonly defaultScopes?: readonly string[];

  /**
   * Maximum redirect URIs per client.
   *
   * @defaultValue 10
   */
  readonly maxRedirectUris?: number;
}

/**
 * OAuth client manager options.
 *
 * @public
 */
export interface OAuthClientManagerOptions {
  /**
   * Redis client.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config?: OAuthClientManagerConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<OAuthClientManagerConfig> = {
  clientPrefix: 'chive:oauth:client:',
  defaultScopes: ['read:preprints', 'read:reviews'],
  maxRedirectUris: 10,
};

/**
 * OAuth client manager.
 *
 * @remarks
 * Manages OAuth client registration, validation, and lookup.
 * Clients are stored in Redis for scalability.
 *
 * @example
 * ```typescript
 * const clientManager = new OAuthClientManager({
 *   redis,
 *   logger,
 * });
 *
 * // Register a new client
 * const { client, clientSecret } = await clientManager.registerClient({
 *   clientName: 'My App',
 *   clientType: 'public',
 *   redirectUris: ['https://myapp.com/callback'],
 * });
 *
 * // Validate client
 * const valid = await clientManager.validateClient(clientId, clientSecret);
 * ```
 *
 * @public
 */
export class OAuthClientManager {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<OAuthClientManagerConfig>;

  /**
   * Creates a new OAuthClientManager.
   *
   * @param options - Manager options
   */
  constructor(options: OAuthClientManagerOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Registers a new OAuth client.
   *
   * @param request - Registration request
   * @returns Registered client and secret (if confidential)
   */
  async registerClient(request: ClientRegistrationRequest): Promise<ClientRegistrationResponse> {
    // Validate redirect URIs
    this.validateRedirectUris(request.redirectUris);

    const clientId = this.generateClientId();
    const now = new Date();

    let clientSecret: string | undefined;
    let clientSecretHash: string | undefined;

    // Generate secret for confidential clients
    if (request.clientType === 'confidential') {
      clientSecret = this.generateClientSecret();
      clientSecretHash = this.hashSecret(clientSecret);
    }

    // Set default grant types based on client type
    const grantTypes =
      request.grantTypes ??
      (request.clientType === 'public'
        ? ['authorization_code', 'refresh_token']
        : ['authorization_code', 'refresh_token', 'client_credentials']);

    const client: OAuthClient = {
      clientId,
      clientSecretHash,
      clientType: request.clientType,
      clientName: request.clientName,
      description: request.description,
      redirectUris: [...request.redirectUris],
      grantTypes,
      allowedScopes: request.requestedScopes
        ? [...request.requestedScopes]
        : [...this.config.defaultScopes],
      logoUri: request.logoUri,
      clientUri: request.clientUri,
      policyUri: request.policyUri,
      tosUri: request.tosUri,
      createdAt: now,
      active: true,
    };

    // Store client
    await this.saveClient(client);

    this.logger.info('OAuth client registered', {
      clientId,
      clientName: request.clientName,
      clientType: request.clientType,
    });

    return {
      client,
      clientSecret,
    };
  }

  /**
   * Gets a client by ID.
   *
   * @param clientId - Client identifier
   * @returns Client or null if not found
   */
  async getClient(clientId: string): Promise<OAuthClient | null> {
    const key = `${this.config.clientPrefix}${clientId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return this.deserializeClient(data);
  }

  /**
   * Validates client credentials.
   *
   * @param clientId - Client identifier
   * @param clientSecret - Client secret (optional for public clients)
   * @returns True if credentials are valid
   */
  async validateClient(clientId: string, clientSecret?: string): Promise<boolean> {
    const client = await this.getClient(clientId);

    if (!client?.active) {
      return false;
    }

    // Public clients don't need secret validation
    if (client.clientType === 'public') {
      return true;
    }

    // Confidential clients require secret
    if (!clientSecret || !client.clientSecretHash) {
      return false;
    }

    const secretHash = this.hashSecret(clientSecret);
    return secretHash === client.clientSecretHash;
  }

  /**
   * Validates a redirect URI for a client.
   *
   * @param clientId - Client identifier
   * @param redirectUri - Redirect URI to validate
   * @returns True if URI is registered for client
   */
  async validateRedirectUri(clientId: string, redirectUri: string): Promise<boolean> {
    const client = await this.getClient(clientId);

    if (!client) {
      return false;
    }

    return client.redirectUris.includes(redirectUri);
  }

  /**
   * Validates requested scopes for a client.
   *
   * @param clientId - Client identifier
   * @param scopes - Requested scopes
   * @returns Array of allowed scopes (may be subset of requested)
   */
  async validateScopes(clientId: string, scopes: readonly string[]): Promise<string[]> {
    const client = await this.getClient(clientId);

    if (!client) {
      throw new OAuthError('invalid_client', 'Client not found');
    }

    return scopes.filter((scope) => client.allowedScopes.includes(scope));
  }

  /**
   * Deactivates a client.
   *
   * @param clientId - Client identifier
   */
  async deactivateClient(clientId: string): Promise<void> {
    const client = await this.getClient(clientId);

    if (client) {
      const updated: OAuthClient = {
        ...client,
        active: false,
        updatedAt: new Date(),
      };

      await this.saveClient(updated);

      this.logger.info('OAuth client deactivated', { clientId });
    }
  }

  /**
   * Rotates client secret.
   *
   * @param clientId - Client identifier
   * @returns New client secret
   * @throws OAuthError if client is public or not found
   */
  async rotateClientSecret(clientId: string): Promise<string> {
    const client = await this.getClient(clientId);

    if (!client) {
      throw new OAuthError('invalid_client', 'Client not found');
    }

    if (client.clientType === 'public') {
      throw new OAuthError('invalid_client', 'Public clients do not have secrets');
    }

    const newSecret = this.generateClientSecret();
    const newSecretHash = this.hashSecret(newSecret);

    const updated: OAuthClient = {
      ...client,
      clientSecretHash: newSecretHash,
      updatedAt: new Date(),
    };

    await this.saveClient(updated);

    this.logger.info('OAuth client secret rotated', { clientId });

    return newSecret;
  }

  /**
   * Saves a client to Redis.
   *
   * @param client - Client to save
   */
  private async saveClient(client: OAuthClient): Promise<void> {
    const key = `${this.config.clientPrefix}${client.clientId}`;
    await this.redis.set(key, this.serializeClient(client));
  }

  /**
   * Serializes a client for storage.
   *
   * @param client - Client to serialize
   * @returns JSON string
   */
  private serializeClient(client: OAuthClient): string {
    return JSON.stringify({
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt?.toISOString(),
    });
  }

  /**
   * Deserializes a client from storage.
   *
   * @param data - JSON string
   * @returns Client object
   */
  private deserializeClient(data: string): OAuthClient {
    const stored = JSON.parse(data) as OAuthClient & {
      createdAt: string;
      updatedAt?: string;
    };

    return {
      ...stored,
      createdAt: new Date(stored.createdAt),
      updatedAt: stored.updatedAt ? new Date(stored.updatedAt) : undefined,
    };
  }

  /**
   * Generates a unique client ID.
   *
   * @returns Client ID string
   */
  private generateClientId(): string {
    return `chive_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Generates a secure client secret.
   *
   * @returns Client secret string
   */
  private generateClientSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Hashes a client secret for storage.
   *
   * @param secret - Secret to hash
   * @returns SHA-256 hash
   */
  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Validates redirect URIs.
   *
   * @param uris - URIs to validate
   * @throws OAuthError if URIs are invalid
   */
  private validateRedirectUris(uris: readonly string[]): void {
    if (uris.length === 0) {
      throw new OAuthError('invalid_request', 'At least one redirect URI is required');
    }

    if (uris.length > this.config.maxRedirectUris) {
      throw new OAuthError(
        'invalid_request',
        `Maximum ${this.config.maxRedirectUris} redirect URIs allowed`
      );
    }

    for (const uri of uris) {
      try {
        const parsed = new URL(uri);

        // Require HTTPS in production (allow http://localhost for development)
        if (parsed.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.exec(parsed.hostname)) {
          throw new OAuthError('invalid_request', `Redirect URI must use HTTPS: ${uri}`);
        }

        // Disallow fragments
        if (parsed.hash) {
          throw new OAuthError('invalid_request', `Redirect URI must not contain fragment: ${uri}`);
        }
      } catch (error) {
        if (error instanceof OAuthError) {
          throw error;
        }
        throw new OAuthError('invalid_request', `Invalid redirect URI: ${uri}`);
      }
    }
  }
}
