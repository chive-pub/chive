/**
 * WebAuthn/Passkey service for passwordless authentication.
 *
 * @remarks
 * Implements FIDO2/WebAuthn using @simplewebauthn/server.
 * Supports credential registration and authentication.
 *
 * @packageDocumentation
 * @public
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  VerifyRegistrationResponseOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyAuthenticationResponseOpts,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import type { Redis } from 'ioredis';

import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  IWebAuthnService,
  WebAuthnCredential,
  RegistrationChallenge,
  RegistrationOptions,
  RegistrationResponse,
  AuthenticationChallenge,
  AuthenticationResponse,
  WebAuthnVerificationResult,
  AuthenticatorTransport,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '../../types/interfaces/webauthn.interface.js';
import { WebAuthnError } from '../errors.js';

/**
 * WebAuthn service configuration.
 *
 * @public
 */
export interface WebAuthnServiceConfig {
  /**
   * Relying party name.
   *
   * @defaultValue 'Chive'
   */
  readonly rpName?: string;

  /**
   * Relying party ID (domain).
   *
   * @defaultValue 'chive.pub'
   */
  readonly rpId?: string;

  /**
   * Expected origin(s).
   *
   * @defaultValue ['https://chive.pub']
   */
  readonly expectedOrigins?: readonly string[];

  /**
   * Challenge expiration in seconds.
   *
   * @defaultValue 300 (5 minutes)
   */
  readonly challengeExpirationSeconds?: number;

  /**
   * Redis key prefix.
   *
   * @defaultValue 'chive:webauthn:'
   */
  readonly keyPrefix?: string;
}

/**
 * WebAuthn service options.
 *
 * @public
 */
export interface WebAuthnServiceOptions {
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
  readonly config?: WebAuthnServiceConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<WebAuthnServiceConfig> = {
  rpName: 'Chive',
  rpId: 'chive.pub',
  expectedOrigins: ['https://chive.pub'],
  challengeExpirationSeconds: 300,
  keyPrefix: 'chive:webauthn:',
};

/**
 * Stored credential format.
 */
interface StoredCredential {
  credentialId: string;
  did: DID;
  publicKey: string; // Base64
  counter: number;
  transports?: AuthenticatorTransport[];
  nickname?: string;
  aaguid?: string;
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * Challenge data stored in Redis.
 */
interface StoredChallenge {
  challenge: string;
  did: DID;
  nickname?: string;
  createdAt: string;
}

/**
 * WebAuthn service implementation.
 *
 * @remarks
 * Provides WebAuthn credential registration and authentication
 * using the @simplewebauthn/server library.
 *
 * @example
 * ```typescript
 * const webauthnService = new WebAuthnService({
 *   redis,
 *   logger,
 *   config: {
 *     rpName: 'Chive',
 *     rpId: 'chive.pub',
 *   },
 * });
 *
 * // Start registration
 * const challenge = await webauthnService.generateRegistrationChallenge(did);
 *
 * // Complete registration (after client response)
 * const credential = await webauthnService.verifyRegistration(response);
 * ```
 *
 * @public
 */
export class WebAuthnService implements IWebAuthnService {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<WebAuthnServiceConfig>;

  /**
   * Creates a new WebAuthnService.
   *
   * @param options - Service options
   */
  constructor(options: WebAuthnServiceOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
  }

  /**
   * Generates a registration challenge for credential creation.
   *
   * @param did - User's DID
   * @param options - Registration options
   * @returns Registration challenge
   */
  async generateRegistrationChallenge(
    did: DID,
    options?: RegistrationOptions
  ): Promise<RegistrationChallenge> {
    // Get existing credentials to exclude
    const existingCredentials = await this.listCredentials(did);

    const opts: GenerateRegistrationOptionsOpts = {
      rpName: this.config.rpName,
      rpID: this.config.rpId,
      userID: new Uint8Array(Buffer.from(did)),
      userName: did,
      attestationType:
        (options?.attestation === 'indirect' ? 'none' : options?.attestation) ?? 'none',
      excludeCredentials: existingCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: options?.userVerification ?? 'preferred',
        authenticatorAttachment: options?.authenticatorAttachment,
      },
    };

    const generatedOptions = await generateRegistrationOptions(opts);

    // Generate challenge ID
    const challengeId = crypto.randomUUID();

    // Store challenge
    const challengeKey = `${this.config.keyPrefix}challenge:${challengeId}`;
    const storedChallenge: StoredChallenge = {
      challenge: generatedOptions.challenge,
      did,
      nickname: options?.nickname,
      createdAt: new Date().toISOString(),
    };

    await this.redis.setex(
      challengeKey,
      this.config.challengeExpirationSeconds,
      JSON.stringify(storedChallenge)
    );

    this.logger.debug('Registration challenge generated', { did, challengeId });

    // Convert to our interface format
    const creationOptions: PublicKeyCredentialCreationOptionsJSON = {
      rp: {
        name: generatedOptions.rp.name,
        id: generatedOptions.rp.id ?? this.config.rpId,
      },
      user: {
        id: generatedOptions.user.id,
        name: generatedOptions.user.name,
        displayName: generatedOptions.user.displayName,
      },
      challenge: generatedOptions.challenge,
      pubKeyCredParams: generatedOptions.pubKeyCredParams.map((param) => ({
        type: 'public-key' as const,
        alg: param.alg,
      })),
      timeout: generatedOptions.timeout,
      excludeCredentials: generatedOptions.excludeCredentials?.map((cred) => ({
        id: cred.id,
        type: 'public-key' as const,
        transports: cred.transports as AuthenticatorTransport[] | undefined,
      })),
      authenticatorSelection: generatedOptions.authenticatorSelection
        ? {
            authenticatorAttachment:
              generatedOptions.authenticatorSelection.authenticatorAttachment,
            requireResidentKey: generatedOptions.authenticatorSelection.requireResidentKey,
            residentKey: generatedOptions.authenticatorSelection.residentKey,
            userVerification: generatedOptions.authenticatorSelection.userVerification,
          }
        : undefined,
      attestation:
        generatedOptions.attestation === 'enterprise' ? 'direct' : generatedOptions.attestation,
    };

    return {
      challengeId,
      options: creationOptions,
      expiresAt: new Date(Date.now() + this.config.challengeExpirationSeconds * 1000),
    };
  }

  /**
   * Verifies a registration response and stores the credential.
   *
   * @param response - Registration response from client
   * @returns Stored credential
   */
  async verifyRegistration(response: RegistrationResponse): Promise<WebAuthnCredential> {
    // Get stored challenge
    const challengeKey = `${this.config.keyPrefix}challenge:${response.challengeId}`;
    const challengeData = await this.redis.get(challengeKey);

    if (!challengeData) {
      throw new WebAuthnError('invalid_challenge', 'Registration challenge not found or expired');
    }

    const storedChallenge = JSON.parse(challengeData) as StoredChallenge;

    // Convert client response to simplewebauthn format
    const transports = response.credential.response.transports
      ? ([...response.credential.response.transports] as AuthenticatorTransportFuture[])
      : undefined;

    const registrationResponse = {
      id: response.credential.id,
      rawId: response.credential.rawId,
      type: response.credential.type,
      response: {
        clientDataJSON: response.credential.response.clientDataJSON,
        attestationObject: response.credential.response.attestationObject,
        transports,
      },
      clientExtensionResults: response.credential.clientExtensionResults ?? {},
    };

    const opts: VerifyRegistrationResponseOpts = {
      response: registrationResponse,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: [...this.config.expectedOrigins],
      expectedRPID: this.config.rpId,
    };

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse(opts);
    } catch (error) {
      throw new WebAuthnError(
        'registration_failed',
        error instanceof Error ? error.message : 'Verification failed',
        error instanceof Error ? error : undefined
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new WebAuthnError('registration_failed', 'Credential verification failed');
    }

    const { registrationInfo } = verification;

    // Store credential
    const credential: StoredCredential = {
      credentialId: registrationInfo.credential.id,
      did: storedChallenge.did,
      publicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64'),
      counter: registrationInfo.credential.counter,
      transports: response.credential.response.transports as AuthenticatorTransport[] | undefined,
      nickname: storedChallenge.nickname,
      aaguid: registrationInfo.aaguid,
      createdAt: new Date().toISOString(),
    };

    await this.storeCredential(credential);

    // Delete challenge
    await this.redis.del(challengeKey);

    this.logger.info('WebAuthn credential registered', {
      did: storedChallenge.did,
      credentialId: credential.credentialId,
    });

    return {
      credentialId: credential.credentialId,
      did: credential.did,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
      nickname: credential.nickname,
      aaguid: credential.aaguid,
      createdAt: new Date(credential.createdAt),
    };
  }

  /**
   * Generates an authentication challenge.
   *
   * @param did - User's DID (optional for discoverable credentials)
   * @returns Authentication challenge
   */
  async generateAuthenticationChallenge(did?: DID): Promise<AuthenticationChallenge> {
    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;

    if (did) {
      const credentials = await this.listCredentials(did);
      if (credentials.length === 0) {
        throw new WebAuthnError('credential_not_found', 'No WebAuthn credentials registered');
      }
      allowCredentials = credentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as AuthenticatorTransportFuture[] | undefined,
      }));
    }

    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: this.config.rpId,
      allowCredentials,
      userVerification: 'preferred',
    };

    const generatedOptions = await generateAuthenticationOptions(opts);

    // Generate challenge ID
    const challengeId = crypto.randomUUID();

    // Store challenge
    const challengeKey = `${this.config.keyPrefix}auth:${challengeId}`;
    const storedChallenge: StoredChallenge = {
      challenge: generatedOptions.challenge,
      did: did ?? ('' as DID), // Empty if discoverable
      createdAt: new Date().toISOString(),
    };

    await this.redis.setex(
      challengeKey,
      this.config.challengeExpirationSeconds,
      JSON.stringify(storedChallenge)
    );

    this.logger.debug('Authentication challenge generated', { did, challengeId });

    // Convert to our interface format
    const requestOptions: PublicKeyCredentialRequestOptionsJSON = {
      challenge: generatedOptions.challenge,
      timeout: generatedOptions.timeout,
      rpId: generatedOptions.rpId,
      allowCredentials: generatedOptions.allowCredentials?.map((cred) => ({
        id: cred.id,
        type: 'public-key' as const,
        transports: cred.transports as AuthenticatorTransport[] | undefined,
      })),
      userVerification: generatedOptions.userVerification,
    };

    return {
      challengeId,
      options: requestOptions,
      expiresAt: new Date(Date.now() + this.config.challengeExpirationSeconds * 1000),
    };
  }

  /**
   * Verifies an authentication response.
   *
   * @param response - Authentication response from client
   * @returns Verification result with credential
   */
  async verifyAuthentication(
    response: AuthenticationResponse
  ): Promise<WebAuthnVerificationResult> {
    // Get stored challenge
    const challengeKey = `${this.config.keyPrefix}auth:${response.challengeId}`;
    const challengeData = await this.redis.get(challengeKey);

    if (!challengeData) {
      return {
        verified: false,
        error: 'Authentication challenge not found or expired',
      };
    }

    const storedChallenge = JSON.parse(challengeData) as StoredChallenge;

    // Get the credential used
    const credential = await this.getCredentialById(response.credential.id);

    if (!credential) {
      return {
        verified: false,
        error: 'Credential not found',
      };
    }

    // Convert client response to simplewebauthn format
    const authResponse = {
      id: response.credential.id,
      rawId: response.credential.rawId,
      type: response.credential.type,
      response: {
        clientDataJSON: response.credential.response.clientDataJSON,
        authenticatorData: response.credential.response.authenticatorData,
        signature: response.credential.response.signature,
        userHandle: response.credential.response.userHandle,
      },
      clientExtensionResults: response.credential.clientExtensionResults ?? {},
    };

    const opts: VerifyAuthenticationResponseOpts = {
      response: authResponse,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: [...this.config.expectedOrigins],
      expectedRPID: this.config.rpId,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64')),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransportFuture[] | undefined,
      },
    };

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse(opts);
    } catch (error) {
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }

    if (!verification.verified) {
      return {
        verified: false,
        error: 'Authentication verification failed',
      };
    }

    // Update counter
    await this.updateCredentialCounter(
      credential.credentialId,
      verification.authenticationInfo.newCounter
    );

    // Delete challenge
    await this.redis.del(challengeKey);

    this.logger.info('WebAuthn authentication successful', {
      did: credential.did,
      credentialId: credential.credentialId,
    });

    return {
      verified: true,
      credential: {
        credentialId: credential.credentialId,
        did: credential.did,
        publicKey: credential.publicKey,
        counter: verification.authenticationInfo.newCounter,
        transports: credential.transports,
        nickname: credential.nickname,
        aaguid: credential.aaguid,
        createdAt: credential.createdAt,
        lastUsedAt: new Date(),
      },
    };
  }

  /**
   * Lists all credentials for a user.
   *
   * @param did - User's DID
   * @returns Array of credentials
   */
  async listCredentials(did: DID): Promise<readonly WebAuthnCredential[]> {
    const credentialsKey = `${this.config.keyPrefix}creds:${did}`;
    const credentialIds = await this.redis.smembers(credentialsKey);

    const credentials: WebAuthnCredential[] = [];

    for (const credId of credentialIds) {
      const credKey = `${this.config.keyPrefix}cred:${credId}`;
      const data = await this.redis.get(credKey);

      if (data) {
        const stored = JSON.parse(data) as StoredCredential;
        credentials.push({
          credentialId: stored.credentialId,
          did: stored.did,
          publicKey: stored.publicKey,
          counter: stored.counter,
          transports: stored.transports,
          nickname: stored.nickname,
          aaguid: stored.aaguid,
          createdAt: new Date(stored.createdAt),
          lastUsedAt: stored.lastUsedAt ? new Date(stored.lastUsedAt) : undefined,
        });
      }
    }

    return credentials;
  }

  /**
   * Deletes a credential.
   *
   * @param did - User's DID (for ownership verification)
   * @param credentialId - Credential ID to delete
   */
  async deleteCredential(did: DID, credentialId: string): Promise<void> {
    const credential = await this.getCredentialById(credentialId);

    if (!credential) {
      throw new WebAuthnError('credential_not_found', 'Credential not found');
    }

    if (credential.did !== did) {
      throw new WebAuthnError('registration_failed', 'Not authorized to delete this credential');
    }

    const credentialsKey = `${this.config.keyPrefix}creds:${did}`;
    const credKey = `${this.config.keyPrefix}cred:${credentialId}`;

    await this.redis.srem(credentialsKey, credentialId);
    await this.redis.del(credKey);

    this.logger.info('WebAuthn credential deleted', { did, credentialId });
  }

  /**
   * Updates a credential's nickname.
   *
   * @param did - User's DID
   * @param credentialId - Credential ID
   * @param nickname - New nickname
   */
  async updateCredentialNickname(did: DID, credentialId: string, nickname: string): Promise<void> {
    const credKey = `${this.config.keyPrefix}cred:${credentialId}`;
    const data = await this.redis.get(credKey);

    if (!data) {
      throw new WebAuthnError('credential_not_found', 'Credential not found');
    }

    const stored = JSON.parse(data) as StoredCredential;

    if (stored.did !== did) {
      throw new WebAuthnError('registration_failed', 'Not authorized to update this credential');
    }

    stored.nickname = nickname;
    await this.redis.set(credKey, JSON.stringify(stored));

    this.logger.debug('WebAuthn credential renamed', { did, credentialId, nickname });
  }

  /**
   * Stores a credential.
   *
   * @param credential - Credential to store
   */
  private async storeCredential(credential: StoredCredential): Promise<void> {
    const credentialsKey = `${this.config.keyPrefix}creds:${credential.did}`;
    const credKey = `${this.config.keyPrefix}cred:${credential.credentialId}`;

    await this.redis.sadd(credentialsKey, credential.credentialId);
    await this.redis.set(credKey, JSON.stringify(credential));
  }

  /**
   * Gets a credential by ID.
   *
   * @param credentialId - Credential ID
   * @returns Credential or null
   */
  private async getCredentialById(credentialId: string): Promise<WebAuthnCredential | null> {
    const credKey = `${this.config.keyPrefix}cred:${credentialId}`;
    const data = await this.redis.get(credKey);

    if (!data) {
      return null;
    }

    const stored = JSON.parse(data) as StoredCredential;
    return {
      credentialId: stored.credentialId,
      did: stored.did,
      publicKey: stored.publicKey,
      counter: stored.counter,
      transports: stored.transports,
      nickname: stored.nickname,
      aaguid: stored.aaguid,
      createdAt: new Date(stored.createdAt),
      lastUsedAt: stored.lastUsedAt ? new Date(stored.lastUsedAt) : undefined,
    };
  }

  /**
   * Updates a credential's counter.
   *
   * @param credentialId - Credential ID
   * @param newCounter - New counter value
   */
  private async updateCredentialCounter(credentialId: string, newCounter: number): Promise<void> {
    const credKey = `${this.config.keyPrefix}cred:${credentialId}`;
    const data = await this.redis.get(credKey);

    if (data) {
      const stored = JSON.parse(data) as StoredCredential;
      stored.counter = newCounter;
      stored.lastUsedAt = new Date().toISOString();
      await this.redis.set(credKey, JSON.stringify(stored));
    }
  }
}
