/**
 * ATProto Service Auth JWT Verifier.
 *
 * @remarks
 * Implements the industry standard ATProto service authentication pattern.
 * Verifies JWTs signed by user's atproto signing key against their DID document.
 *
 * Flow:
 * 1. User's PDS issues a service auth JWT for Chive (via getServiceAuth)
 * 2. JWT is signed with user's atproto signing key (same key that signs repo commits)
 * 3. Chive verifies the JWT by resolving user's DID and checking signature
 *
 * @see {@link https://docs.bsky.app/docs/advanced-guides/service-auth | ATProto Service Auth}
 * @packageDocumentation
 * @public
 */

import { IdResolver } from '@atproto/identity';
import { verifyJwt, cryptoVerifySignatureWithKey } from '@atproto/xrpc-server';

import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Service auth verifier configuration.
 *
 * @public
 */
export interface ServiceAuthVerifierConfig {
  /**
   * Chive's DID (audience for service auth JWTs).
   *
   * @remarks
   * This should be a did:web or did:plc for Chive's service identity.
   * Service auth JWTs must have this as their `aud` claim.
   */
  readonly serviceDid: string;

  /**
   * PLC directory URL for DID resolution.
   *
   * @defaultValue 'https://plc.directory'
   */
  readonly plcDirectoryUrl?: string;
}

/**
 * Service auth verifier options.
 *
 * @public
 */
export interface ServiceAuthVerifierOptions {
  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Configuration.
   */
  readonly config: ServiceAuthVerifierConfig;
}

/**
 * Verified service auth result.
 *
 * @public
 */
export interface ServiceAuthResult {
  /**
   * User's DID (from `iss` claim).
   */
  readonly did: DID;

  /**
   * Lexicon method the token is authorized for (from `lxm` claim).
   */
  readonly lxm?: string;

  /**
   * Token expiration timestamp.
   */
  readonly exp: number;
}

/**
 * Interface for service auth verification.
 *
 * @remarks
 * Allows injection of mock verifiers for testing.
 *
 * @public
 */
export interface IServiceAuthVerifier {
  /**
   * Verifies a service auth JWT.
   *
   * @param jwt - The JWT string
   * @param lxm - Optional expected lexicon method
   * @returns Verification result or null if invalid
   */
  verify(jwt: string, lxm?: string): Promise<ServiceAuthResult | null>;
}

/**
 * ATProto Service Auth JWT Verifier.
 *
 * @remarks
 * Uses the official @atproto/xrpc-server and @atproto/identity libraries
 * to verify service auth JWTs according to ATProto specification.
 *
 * @example
 * ```typescript
 * const verifier = new ServiceAuthVerifier({
 *   logger,
 *   config: {
 *     serviceDid: 'did:web:chive.pub',
 *   },
 * });
 *
 * // Verify a service auth JWT
 * const result = await verifier.verify(jwtString);
 * if (result) {
 *   console.log('User DID:', result.did);
 * }
 * ```
 *
 * @public
 */
export class ServiceAuthVerifier implements IServiceAuthVerifier {
  private readonly logger: ILogger;
  private readonly config: ServiceAuthVerifierConfig;
  private readonly idResolver: IdResolver;

  /**
   * Creates a new ServiceAuthVerifier.
   *
   * @param options - Verifier options
   */
  constructor(options: ServiceAuthVerifierOptions) {
    this.logger = options.logger;
    this.config = options.config;

    // Initialize ATProto identity resolver
    this.idResolver = new IdResolver({
      plcUrl: options.config.plcDirectoryUrl ?? 'https://plc.directory',
    });
  }

  /**
   * Verifies a service auth JWT.
   *
   * @param jwt - The JWT string from Authorization header (without "Bearer " prefix)
   * @param lxm - Optional: expected lexicon method (e.g., "pub.chive.claiming.findClaimable")
   * @returns Verification result or null if invalid
   *
   * @remarks
   * Verification includes:
   * - Signature verification against user's DID document signing key
   * - Audience check (must match Chive's service DID)
   * - Expiration check
   * - Optional lexicon method check
   */
  async verify(jwt: string, lxm?: string): Promise<ServiceAuthResult | null> {
    try {
      // Create a function that resolves DIDs to their signing keys
      // Uses IdResolver.did.resolveAtprotoKey() which returns the key in did:key format
      // as expected by verifyJwt and cryptoVerifySignatureWithKey
      const getSigningKey = async (iss: string, forceRefresh: boolean): Promise<string> => {
        // resolveAtprotoKey returns the atproto signing key in did:key format
        // This is the correct format for cryptoVerifySignatureWithKey
        const signingKey = await this.idResolver.did.resolveAtprotoKey(iss, forceRefresh);
        return signingKey;
      };

      // Verify the JWT using @atproto/xrpc-server
      const payload = await verifyJwt(
        jwt,
        this.config.serviceDid, // aud check
        lxm ?? null, // lxm check (null to skip)
        getSigningKey,
        cryptoVerifySignatureWithKey
      );

      this.logger.debug('Service auth JWT verified', {
        iss: payload.iss,
        aud: payload.aud,
        lxm: payload.lxm,
        exp: payload.exp,
      });

      return {
        did: payload.iss as DID,
        lxm: payload.lxm,
        exp: payload.exp,
      };
    } catch (error) {
      this.logger.warn('Service auth JWT verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}
