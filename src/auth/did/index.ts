/**
 * DID authentication module.
 *
 * @remarks
 * Provides DID resolution and verification for AT Protocol authentication.
 *
 * @packageDocumentation
 * @public
 */

export { DIDResolver } from './did-resolver.js';
export type { DIDResolverConfig, DIDResolverOptions } from './did-resolver.js';
export { DIDVerifier } from './did-verifier.js';
export type { DIDVerifierOptions, DIDVerificationResult } from './did-verifier.js';
