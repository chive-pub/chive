/**
 * ATProto OAuth client wrapper for Node.js.
 *
 * @remarks
 * Wraps @atproto/oauth-client-node with Redis-backed session and state stores.
 * Handles DPoP, PKCE, and PAR automatically per ATProto OAuth specification.
 *
 * @packageDocumentation
 * @public
 */

import { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { Redis } from 'ioredis';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

import { RedisSessionStore, type RedisSessionStoreConfig } from './session-store.js';
import { RedisStateStore, type RedisStateStoreConfig } from './state-store.js';

/**
 * OAuth client metadata configuration.
 *
 * @public
 */
export interface OAuthClientMetadataConfig {
  /**
   * OAuth client ID (URL to client-metadata.json).
   *
   * @example 'https://chive.pub/oauth/client-metadata.json'
   */
  readonly clientId: string;

  /**
   * OAuth redirect URI for authorization callback.
   *
   * @example 'https://chive.pub/oauth/callback'
   */
  readonly redirectUri: string;

  /**
   * OAuth scopes to request.
   *
   * @remarks
   * Must include 'atproto' for PDS access. 'transition:generic' allows
   * writing to any lexicon namespace.
   *
   * @defaultValue ['atproto', 'transition:generic']
   */
  readonly scopes?: readonly string[];
}

/**
 * Configuration for the ATProto OAuth client.
 *
 * @public
 */
export interface ATProtoOAuthClientConfig {
  /**
   * OAuth client metadata.
   */
  readonly clientMetadata: OAuthClientMetadataConfig;

  /**
   * Session store configuration.
   */
  readonly sessionStore?: RedisSessionStoreConfig;

  /**
   * State store configuration.
   */
  readonly stateStore?: RedisStateStoreConfig;
}

/**
 * Options for creating an ATProto OAuth client.
 *
 * @public
 */
export interface ATProtoOAuthClientOptions {
  /**
   * Redis client instance.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration options.
   */
  readonly config: ATProtoOAuthClientConfig;
}

/**
 * Creates a configured ATProto OAuth client.
 *
 * @remarks
 * The OAuth client handles all ATProto OAuth requirements automatically:
 * - DPoP token binding (mandatory)
 * - PKCE S256 challenges (mandatory)
 * - PAR (Pushed Authorization Requests) (mandatory)
 * - Token refresh with single-use rotation
 *
 * @example
 * ```typescript
 * const oauthClient = createATProtoOAuthClient({
 *   redis,
 *   logger,
 *   config: {
 *     clientMetadata: {
 *       clientId: 'https://chive.pub/oauth/client-metadata.json',
 *       redirectUri: 'https://chive.pub/oauth/callback',
 *     },
 *     sessionStore: {
 *       encryptionKey: process.env.SESSION_ENCRYPTION_KEY,
 *     },
 *   },
 * });
 *
 * // Start authorization flow
 * const url = await oauthClient.authorize(handle, {
 *   scope: 'atproto transition:generic',
 * });
 *
 * // After callback, restore session and get agent
 * const agent = await oauthClient.restore(did);
 * await agent.com.atproto.repo.createRecord({...});
 * ```
 *
 * @param options - Client options
 * @returns Configured NodeOAuthClient instance
 *
 * @public
 */
export function createATProtoOAuthClient(options: ATProtoOAuthClientOptions): NodeOAuthClient {
  const { redis, logger, config } = options;

  const sessionStore = new RedisSessionStore({
    redis,
    logger,
    config: config.sessionStore,
  });

  const stateStore = new RedisStateStore({
    redis,
    logger,
    config: config.stateStore,
  });

  const scopes = config.clientMetadata.scopes ?? ['atproto', 'transition:generic'];

  return new NodeOAuthClient({
    clientMetadata: {
      client_id: config.clientMetadata.clientId,
      client_name: 'Chive Eprint Service',
      client_uri: 'https://chive.pub',
      logo_uri: 'https://chive.pub/logo.png',
      tos_uri: 'https://chive.pub/terms',
      policy_uri: 'https://chive.pub/privacy',
      redirect_uris: [config.clientMetadata.redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: scopes.join(' '),
      token_endpoint_auth_method: 'none', // Public client
      application_type: 'web',
      dpop_bound_access_tokens: true, // DPoP is mandatory
    },
    stateStore,
    sessionStore,
  });
}

/**
 * Re-export types from @atproto/oauth-client-node for convenience.
 */
export type { NodeOAuthClient } from '@atproto/oauth-client-node';
