/**
 * DID document signature verifier.
 *
 * @remarks
 * Verifies JWT signatures against public keys in DID documents.
 * Supports ES256 (ECDSA P-256) as used by AT Protocol.
 *
 * @packageDocumentation
 * @public
 */

import * as jose from 'jose';

import type { DID } from '../../types/atproto.js';
import type { DIDDocument, IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { TokenValidationError } from '../errors.js';

/**
 * DID verification result.
 *
 * @public
 */
export interface DIDVerificationResult {
  /**
   * Whether verification succeeded.
   */
  readonly valid: boolean;

  /**
   * Verified DID (if successful).
   */
  readonly did?: DID;

  /**
   * Verification method ID that matched.
   */
  readonly verificationMethodId?: string;

  /**
   * Error messages (if failed).
   */
  readonly errors?: readonly string[];
}

/**
 * JWT header with key ID.
 */
interface JWTHeader {
  readonly alg: string;
  readonly typ?: string;
  readonly kid?: string;
}

/**
 * JWT payload with standard claims.
 */
interface JWTPayload {
  readonly sub: string;
  readonly iss?: string;
  readonly aud?: string | readonly string[];
  readonly exp?: number;
  readonly iat?: number;
  readonly jti?: string;
  [key: string]: unknown;
}

/**
 * DID verifier options.
 *
 * @public
 */
export interface DIDVerifierOptions {
  /**
   * Identity resolver for fetching DID documents.
   */
  readonly identityResolver: IIdentityResolver;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Expected issuer for token validation.
   */
  readonly expectedIssuer?: string;

  /**
   * Expected audience for token validation.
   */
  readonly expectedAudience?: string;

  /**
   * Clock tolerance in seconds for expiration check.
   *
   * @defaultValue 60
   */
  readonly clockToleranceSeconds?: number;
}

/**
 * DID document signature verifier.
 *
 * @remarks
 * Verifies JWT signatures by:
 * 1. Extracting the DID from the token subject
 * 2. Resolving the DID to its DID document
 * 3. Finding matching verification methods
 * 4. Verifying the signature against each key
 *
 * @example
 * ```typescript
 * const verifier = new DIDVerifier({
 *   identityResolver: resolver,
 *   logger,
 *   expectedIssuer: 'https://api.chive.pub',
 *   expectedAudience: 'https://api.chive.pub',
 * });
 *
 * const result = await verifier.verify(jwt);
 * if (result.valid) {
 *   console.log('Verified DID:', result.did);
 * }
 * ```
 *
 * @public
 */
export class DIDVerifier {
  private readonly identityResolver: IIdentityResolver;
  private readonly logger: ILogger;
  private readonly expectedIssuer?: string;
  private readonly expectedAudience?: string;
  private readonly clockToleranceSeconds: number;

  /**
   * Creates a new DIDVerifier.
   *
   * @param options - Verifier options
   */
  constructor(options: DIDVerifierOptions) {
    this.identityResolver = options.identityResolver;
    this.logger = options.logger;
    this.expectedIssuer = options.expectedIssuer;
    this.expectedAudience = options.expectedAudience;
    this.clockToleranceSeconds = options.clockToleranceSeconds ?? 60;
  }

  /**
   * Verifies a JWT against DID document.
   *
   * @param token - JWT to verify
   * @returns Verification result
   */
  async verify(token: string): Promise<DIDVerificationResult> {
    try {
      // Decode header and payload without verification
      const { header, payload } = this.decodeToken(token);

      // Validate algorithm
      if (header.alg !== 'ES256') {
        return {
          valid: false,
          errors: [`Unsupported algorithm: ${header.alg}. Expected ES256.`],
        };
      }

      // Extract DID from subject
      const did = payload.sub as DID;
      if (!did?.startsWith('did:')) {
        return {
          valid: false,
          errors: ['Invalid or missing subject claim (sub)'],
        };
      }

      // Resolve DID document
      const didDocument = await this.identityResolver.resolveDID(did);
      if (!didDocument) {
        return {
          valid: false,
          errors: [`Failed to resolve DID: ${did}`],
        };
      }

      // Verify signature against DID document
      const verificationResult = await this.verifySignature(token, didDocument, header.kid);

      if (!verificationResult.valid) {
        return verificationResult;
      }

      // Validate claims
      const claimsResult = this.validateClaims(payload);
      if (!claimsResult.valid) {
        return claimsResult;
      }

      return {
        valid: true,
        did,
        verificationMethodId: verificationResult.verificationMethodId,
      };
    } catch (error) {
      this.logger.warn('JWT verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof TokenValidationError) {
        return {
          valid: false,
          errors: [error.message],
        };
      }

      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown verification error'],
      };
    }
  }

  /**
   * Decodes a JWT without verification.
   *
   * @param token - JWT to decode
   * @returns Decoded header and payload
   */
  private decodeToken(token: string): { header: JWTHeader; payload: JWTPayload } {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new TokenValidationError('malformed', 'Invalid JWT format');
    }

    const [headerPart, payloadPart] = parts;
    if (!headerPart || !payloadPart) {
      throw new TokenValidationError('malformed', 'Invalid JWT format');
    }

    try {
      const header = JSON.parse(
        Buffer.from(headerPart, 'base64url').toString('utf-8')
      ) as JWTHeader;

      const payload = JSON.parse(
        Buffer.from(payloadPart, 'base64url').toString('utf-8')
      ) as JWTPayload;

      return { header, payload };
    } catch {
      throw new TokenValidationError('malformed', 'Failed to decode JWT');
    }
  }

  /**
   * Verifies signature against DID document verification methods.
   *
   * @param token - JWT to verify
   * @param didDocument - DID document with verification methods
   * @param kid - Key ID hint from JWT header
   * @returns Verification result
   */
  private async verifySignature(
    token: string,
    didDocument: DIDDocument,
    kid?: string
  ): Promise<DIDVerificationResult> {
    const verificationMethods = didDocument.verificationMethod;
    if (!verificationMethods || verificationMethods.length === 0) {
      return {
        valid: false,
        errors: ['No verification methods in DID document'],
      };
    }

    // If kid is provided, try that method first
    if (kid) {
      const targetMethod = verificationMethods.find((vm) => vm.id === kid || vm.id.endsWith(kid));
      if (targetMethod) {
        const result = await this.tryVerifyWithMethod(token, targetMethod);
        if (result.valid) {
          return result;
        }
      }
    }

    // Try all verification methods
    const errors: string[] = [];
    for (const method of verificationMethods) {
      const result = await this.tryVerifyWithMethod(token, method);
      if (result.valid) {
        return result;
      }
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    return {
      valid: false,
      errors: errors.length > 0 ? errors : ['No matching verification method found'],
    };
  }

  /**
   * Attempts to verify JWT with a specific verification method.
   *
   * @param token - JWT to verify
   * @param method - Verification method from DID document
   * @returns Verification result
   */
  private async tryVerifyWithMethod(
    token: string,
    method: {
      readonly id: string;
      readonly type: string;
      readonly controller: DID;
      readonly publicKeyMultibase?: string;
    }
  ): Promise<DIDVerificationResult> {
    try {
      // Only support Multikey and JsonWebKey2020 for now
      if (
        method.type !== 'Multikey' &&
        method.type !== 'JsonWebKey2020' &&
        method.type !== 'EcdsaSecp256r1VerificationKey2019'
      ) {
        return {
          valid: false,
          errors: [`Unsupported verification method type: ${method.type}`],
        };
      }

      if (!method.publicKeyMultibase) {
        return {
          valid: false,
          errors: ['Verification method missing publicKeyMultibase'],
        };
      }

      // Import the public key
      const publicKey = await this.importPublicKey(method.publicKeyMultibase);

      // Verify the JWT
      await jose.jwtVerify(token, publicKey, {
        clockTolerance: this.clockToleranceSeconds,
      });

      return {
        valid: true,
        verificationMethodId: method.id,
      };
    } catch (error) {
      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        return {
          valid: false,
          errors: ['Signature verification failed'],
        };
      }

      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Verification failed'],
      };
    }
  }

  /**
   * Imports a public key from multibase encoding.
   *
   * @param multibase - Multibase-encoded public key
   * @returns CryptoKey for verification
   */
  private async importPublicKey(multibase: string): Promise<jose.CryptoKey | Uint8Array> {
    // Multibase format: base58btc prefix 'z' followed by multicodec + key data
    // For secp256r1 (P-256): multicodec 0x1200
    if (!multibase.startsWith('z')) {
      throw new TokenValidationError(
        'invalid_claims',
        'Unsupported multibase encoding (expected base58btc)'
      );
    }

    // Decode base58btc
    const decoded = this.decodeBase58btc(multibase.slice(1));

    // Check multicodec prefix for P-256 compressed key (0x1200)
    // The compressed point is 33 bytes
    if (decoded.length < 35) {
      throw new TokenValidationError('invalid_claims', 'Invalid public key length');
    }

    // Extract the compressed point (skip 2-byte multicodec prefix)
    const compressedPoint = decoded.slice(2);

    // Convert compressed point to uncompressed for jose
    const uncompressedPoint = this.decompressPoint(compressedPoint);

    // Import as P-256 key
    const jwk: jose.JWK = {
      kty: 'EC',
      crv: 'P-256',
      x: jose.base64url.encode(uncompressedPoint.slice(1, 33)),
      y: jose.base64url.encode(uncompressedPoint.slice(33, 65)),
    };

    return jose.importJWK(jwk, 'ES256');
  }

  /**
   * Decodes base58btc string to bytes.
   *
   * @param encoded - Base58btc encoded string
   * @returns Decoded bytes
   */
  private decodeBase58btc(encoded: string): Uint8Array {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const ALPHABET_MAP = new Map<string, number>();
    for (let i = 0; i < ALPHABET.length; i++) {
      const char = ALPHABET[i];
      if (char !== undefined) {
        ALPHABET_MAP.set(char, i);
      }
    }

    let result = BigInt(0);
    for (const char of encoded) {
      const value = ALPHABET_MAP.get(char);
      if (value === undefined) {
        throw new TokenValidationError('invalid_claims', 'Invalid base58btc character');
      }
      result = result * BigInt(58) + BigInt(value);
    }

    // Convert BigInt to bytes
    const hex = result.toString(16).padStart(encoded.length * 2, '0');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }

    // Handle leading zeros
    let leadingZeros = 0;
    for (const char of encoded) {
      if (char === '1') {
        leadingZeros++;
      } else {
        break;
      }
    }

    if (leadingZeros > 0) {
      const withZeros = new Uint8Array(leadingZeros + bytes.length);
      withZeros.set(bytes, leadingZeros);
      return withZeros;
    }

    return bytes;
  }

  /**
   * Decompresses a P-256 point.
   *
   * @param compressed - Compressed point (33 bytes)
   * @returns Uncompressed point (65 bytes)
   */
  private decompressPoint(compressed: Uint8Array): Uint8Array {
    if (compressed.length !== 33) {
      throw new TokenValidationError('invalid_claims', 'Invalid compressed point length');
    }

    const prefix = compressed[0];
    if (prefix !== 0x02 && prefix !== 0x03) {
      throw new TokenValidationError('invalid_claims', 'Invalid compressed point prefix');
    }

    // Extract X coordinate
    const x = compressed.slice(1);

    // P-256 curve parameters
    const p = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
    const a = BigInt('0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc');
    const b = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');

    // Convert X to BigInt
    const xBigInt = BigInt('0x' + Buffer.from(x).toString('hex'));

    // Calculate y^2 = x^3 + ax + b mod p
    const xCubed = this.modPow(xBigInt, BigInt(3), p);
    const ax = (a * xBigInt) % p;
    const y2 = (xCubed + ax + b) % p;

    // Calculate y = sqrt(y^2) mod p using Tonelli-Shanks
    const y = this.modSqrt(y2, p);

    // Choose correct y based on prefix
    const isOdd = y % BigInt(2) === BigInt(1);
    const yFinal = (prefix === 0x03) === isOdd ? y : p - y;

    // Create uncompressed point
    const result = new Uint8Array(65);
    result[0] = 0x04;
    const xBytes = this.bigIntToBytes(xBigInt, 32);
    const yBytes = this.bigIntToBytes(yFinal, 32);
    result.set(xBytes, 1);
    result.set(yBytes, 33);

    return result;
  }

  /**
   * Modular exponentiation.
   */
  private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = BigInt(1);
    base = base % mod;
    while (exp > BigInt(0)) {
      if (exp % BigInt(2) === BigInt(1)) {
        result = (result * base) % mod;
      }
      exp = exp / BigInt(2);
      base = (base * base) % mod;
    }
    return result;
  }

  /**
   * Modular square root for P-256.
   */
  private modSqrt(a: bigint, p: bigint): bigint {
    // For P-256, p ≡ 3 (mod 4), so sqrt(a) = a^((p+1)/4)
    const exp = (p + BigInt(1)) / BigInt(4);
    return this.modPow(a, exp, p);
  }

  /**
   * Converts BigInt to fixed-length bytes.
   */
  private bigIntToBytes(n: bigint, length: number): Uint8Array {
    const hex = n.toString(16).padStart(length * 2, '0');
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  /**
   * Validates JWT claims.
   *
   * @param payload - JWT payload
   * @returns Validation result
   */
  private validateClaims(payload: JWTPayload): DIDVerificationResult {
    const errors: string[] = [];
    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp !== undefined && payload.exp < now - this.clockToleranceSeconds) {
      errors.push('Token has expired');
    }

    // Check not before
    if (payload.iat !== undefined && payload.iat > now + this.clockToleranceSeconds) {
      errors.push('Token issued in the future');
    }

    // Check issuer
    if (this.expectedIssuer && payload.iss !== this.expectedIssuer) {
      errors.push(`Invalid issuer: expected ${this.expectedIssuer}, got ${payload.iss}`);
    }

    // Check audience
    if (this.expectedAudience) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(this.expectedAudience)) {
        errors.push(
          `Invalid audience: expected ${this.expectedAudience}, got ${audiences.join(', ')}`
        );
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }
}
