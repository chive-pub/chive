/**
 * ATProto OAuth module.
 *
 * @remarks
 * Provides OAuth client integration for ATProto PDS operations.
 * Uses the official @atproto/oauth-client-node SDK with Redis-backed
 * session and state stores.
 *
 * @packageDocumentation
 * @public
 */

export {
  createATProtoOAuthClient,
  type ATProtoOAuthClientConfig,
  type ATProtoOAuthClientOptions,
  type OAuthClientMetadataConfig,
  type NodeOAuthClient,
} from './node-oauth-client.js';

export {
  RedisSessionStore,
  type RedisSessionStoreConfig,
  type RedisSessionStoreOptions,
} from './session-store.js';

export {
  RedisStateStore,
  type RedisStateStoreConfig,
  type RedisStateStoreOptions,
} from './state-store.js';
