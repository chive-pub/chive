/**
 * PKCE (Proof Key for Code Exchange) utilities.
 *
 * @remarks
 * Implements RFC 7636 for OAuth 2.0 PKCE extension.
 * Uses SHA-256 for code challenge generation.
 *
 * @packageDocumentation
 * @public
 */

import { createHash, randomBytes } from 'node:crypto';

import { PKCEError } from '../errors.js';

/**
 * PKCE code challenge method.
 *
 * @remarks
 * Only S256 (SHA-256) is supported as plain is not secure.
 *
 * @public
 */
export type CodeChallengeMethod = 'S256';

/**
 * PKCE code verifier and challenge pair.
 *
 * @public
 */
export interface PKCEPair {
  /**
   * Code verifier (client secret).
   *
   * @remarks
   * 43-128 character base64url string.
   */
  readonly codeVerifier: string;

  /**
   * Code challenge (sent to authorization server).
   *
   * @remarks
   * Base64url-encoded SHA-256 hash of verifier.
   */
  readonly codeChallenge: string;

  /**
   * Challenge method (always S256).
   */
  readonly codeChallengeMethod: CodeChallengeMethod;
}

/**
 * Generates a PKCE code verifier.
 *
 * @remarks
 * Creates a cryptographically random 43-128 character string
 * using base64url encoding per RFC 7636.
 *
 * @param length - Verifier length in bytes (default 32, generates 43 chars)
 * @returns Code verifier string
 *
 * @public
 */
export function generateCodeVerifier(length = 32): string {
  if (length < 32 || length > 96) {
    throw new PKCEError('invalid_verifier', 'Code verifier length must be between 32 and 96 bytes');
  }

  return randomBytes(length).toString('base64url');
}

/**
 * Generates a code challenge from a verifier.
 *
 * @remarks
 * Computes BASE64URL(SHA256(code_verifier)) per RFC 7636.
 *
 * @param codeVerifier - The code verifier to hash
 * @returns Code challenge string
 *
 * @public
 */
export function generateCodeChallenge(codeVerifier: string): string {
  if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new PKCEError('invalid_verifier', 'Code verifier must be 43-128 characters');
  }

  return createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Generates a complete PKCE pair.
 *
 * @param length - Verifier length in bytes (default 32)
 * @returns Code verifier and challenge pair
 *
 * @public
 */
export function generatePKCEPair(length = 32): PKCEPair {
  const codeVerifier = generateCodeVerifier(length);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Verifies a code verifier against a challenge.
 *
 * @param codeVerifier - The code verifier from token request
 * @param codeChallenge - The code challenge from authorization request
 * @param method - Challenge method (must be S256)
 * @returns True if verifier matches challenge
 * @throws PKCEError if method is not supported
 *
 * @public
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: CodeChallengeMethod = 'S256'
): boolean {
  if (method !== 'S256') {
    throw new PKCEError('method_not_supported', `Unsupported challenge method: ${String(method)}`);
  }

  const computedChallenge = generateCodeChallenge(codeVerifier);
  return computedChallenge === codeChallenge;
}
