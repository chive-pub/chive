/**
 * WebAuthn (passkey) service interfaces.
 *
 * @remarks
 * Provides type definitions for WebAuthn/FIDO2 authentication including:
 * - Passkey registration (attestation)
 * - Passkey authentication (assertion)
 * - Credential management
 *
 * @see {@link https://www.w3.org/TR/webauthn-2/ | WebAuthn Level 2}
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../atproto.js';

/**
 * Authenticator transport types.
 *
 * @public
 */
export type AuthenticatorTransport = 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid';

/**
 * WebAuthn credential stored in database.
 *
 * @public
 */
export interface WebAuthnCredential {
  /**
   * Credential ID (base64url encoded).
   */
  readonly credentialId: string;

  /**
   * Associated user's DID.
   */
  readonly did: DID;

  /**
   * COSE public key (base64url encoded).
   */
  readonly publicKey: string;

  /**
   * Signature counter for replay detection.
   *
   * @remarks
   * Incremented by authenticator on each use.
   * If counter decreases, credential may be cloned.
   */
  readonly counter: number;

  /**
   * Credential transports.
   */
  readonly transports?: readonly AuthenticatorTransport[];

  /**
   * User-provided nickname for the credential.
   *
   * @example "MacBook Touch ID", "YubiKey 5C"
   */
  readonly nickname?: string;

  /**
   * Credential creation timestamp.
   */
  readonly createdAt: Date;

  /**
   * Last authentication timestamp.
   */
  readonly lastUsedAt?: Date;

  /**
   * AAGUID of the authenticator.
   *
   * @remarks
   * Can be used to identify authenticator type.
   */
  readonly aaguid?: string;
}

/**
 * Registration challenge options.
 *
 * @public
 */
export interface RegistrationOptions {
  /**
   * User-provided nickname for the credential.
   */
  readonly nickname?: string;

  /**
   * Require user verification (biometric/PIN).
   *
   * @defaultValue 'preferred'
   */
  readonly userVerification?: 'required' | 'preferred' | 'discouraged';

  /**
   * Attestation preference.
   *
   * @defaultValue 'none'
   */
  readonly attestation?: 'none' | 'indirect' | 'direct';

  /**
   * Authenticator attachment preference.
   */
  readonly authenticatorAttachment?: 'platform' | 'cross-platform';
}

/**
 * Registration challenge response.
 *
 * @remarks
 * Returned to client for navigator.credentials.create().
 *
 * @public
 */
export interface RegistrationChallenge {
  /**
   * Challenge identifier for server-side lookup.
   */
  readonly challengeId: string;

  /**
   * PublicKeyCredentialCreationOptions for WebAuthn API.
   *
   * @remarks
   * Serialized for transmission to client.
   * Contains challenge, user info, RP info, and credential parameters.
   */
  readonly options: PublicKeyCredentialCreationOptionsJSON;

  /**
   * Challenge expiration timestamp.
   */
  readonly expiresAt: Date;
}

/**
 * Serialized PublicKeyCredentialCreationOptions.
 *
 * @remarks
 * JSON-safe format for client transmission.
 *
 * @public
 */
export interface PublicKeyCredentialCreationOptionsJSON {
  readonly rp: {
    readonly name: string;
    readonly id: string;
  };
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly displayName: string;
  };
  readonly challenge: string;
  readonly pubKeyCredParams: readonly {
    readonly type: 'public-key';
    readonly alg: number;
  }[];
  readonly timeout?: number;
  readonly excludeCredentials?: readonly {
    readonly id: string;
    readonly type: 'public-key';
    readonly transports?: readonly AuthenticatorTransport[];
  }[];
  readonly authenticatorSelection?: {
    readonly authenticatorAttachment?: 'platform' | 'cross-platform';
    readonly requireResidentKey?: boolean;
    readonly residentKey?: 'discouraged' | 'preferred' | 'required';
    readonly userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  readonly attestation?: 'none' | 'indirect' | 'direct';
}

/**
 * Registration response from client.
 *
 * @public
 */
export interface RegistrationResponse {
  /**
   * Challenge ID from RegistrationChallenge.
   */
  readonly challengeId: string;

  /**
   * Credential response from navigator.credentials.create().
   */
  readonly credential: {
    readonly id: string;
    readonly rawId: string;
    readonly type: 'public-key';
    readonly response: {
      readonly clientDataJSON: string;
      readonly attestationObject: string;
      readonly transports?: readonly AuthenticatorTransport[];
    };
    readonly clientExtensionResults?: Record<string, unknown>;
  };
}

/**
 * Authentication challenge response.
 *
 * @remarks
 * Returned to client for navigator.credentials.get().
 *
 * @public
 */
export interface AuthenticationChallenge {
  /**
   * Challenge identifier for server-side lookup.
   */
  readonly challengeId: string;

  /**
   * PublicKeyCredentialRequestOptions for WebAuthn API.
   */
  readonly options: PublicKeyCredentialRequestOptionsJSON;

  /**
   * Challenge expiration timestamp.
   */
  readonly expiresAt: Date;
}

/**
 * Serialized PublicKeyCredentialRequestOptions.
 *
 * @public
 */
export interface PublicKeyCredentialRequestOptionsJSON {
  readonly challenge: string;
  readonly timeout?: number;
  readonly rpId?: string;
  readonly allowCredentials?: readonly {
    readonly id: string;
    readonly type: 'public-key';
    readonly transports?: readonly AuthenticatorTransport[];
  }[];
  readonly userVerification?: 'required' | 'preferred' | 'discouraged';
}

/**
 * Authentication response from client.
 *
 * @public
 */
export interface AuthenticationResponse {
  /**
   * Challenge ID from AuthenticationChallenge.
   */
  readonly challengeId: string;

  /**
   * Credential response from navigator.credentials.get().
   */
  readonly credential: {
    readonly id: string;
    readonly rawId: string;
    readonly type: 'public-key';
    readonly response: {
      readonly clientDataJSON: string;
      readonly authenticatorData: string;
      readonly signature: string;
      readonly userHandle?: string;
    };
    readonly clientExtensionResults?: Record<string, unknown>;
  };
}

/**
 * WebAuthn verification result.
 *
 * @public
 */
export interface WebAuthnVerificationResult {
  /**
   * Whether verification succeeded.
   */
  readonly verified: boolean;

  /**
   * Credential that was verified (if successful).
   */
  readonly credential?: WebAuthnCredential;

  /**
   * Error message (if failed).
   */
  readonly error?: string;
}

/**
 * WebAuthn service interface.
 *
 * @remarks
 * Provides WebAuthn/FIDO2 passkey support for passwordless authentication.
 *
 * @example
 * ```typescript
 * const webauthn = container.resolve<IWebAuthnService>('IWebAuthnService');
 *
 * // Registration flow
 * const challenge = await webauthn.generateRegistrationChallenge(did);
 * // ... client calls navigator.credentials.create() ...
 * const credential = await webauthn.verifyRegistration(response);
 *
 * // Authentication flow
 * const authChallenge = await webauthn.generateAuthenticationChallenge(did);
 * // ... client calls navigator.credentials.get() ...
 * const result = await webauthn.verifyAuthentication(authResponse);
 * ```
 *
 * @public
 */
export interface IWebAuthnService {
  /**
   * Generate registration challenge for new credential.
   *
   * @param did - User's DID
   * @param options - Registration options
   * @returns Challenge for client
   *
   * @public
   */
  generateRegistrationChallenge(
    did: DID,
    options?: RegistrationOptions
  ): Promise<RegistrationChallenge>;

  /**
   * Verify registration response and store credential.
   *
   * @param response - Registration response from client
   * @returns Stored credential
   *
   * @throws WebAuthnError if verification fails
   *
   * @public
   */
  verifyRegistration(response: RegistrationResponse): Promise<WebAuthnCredential>;

  /**
   * Generate authentication challenge.
   *
   * @param did - User's DID (optional for discoverable credentials)
   * @returns Challenge for client
   *
   * @public
   */
  generateAuthenticationChallenge(did?: DID): Promise<AuthenticationChallenge>;

  /**
   * Verify authentication response.
   *
   * @param response - Authentication response from client
   * @returns Verification result with credential
   *
   * @public
   */
  verifyAuthentication(response: AuthenticationResponse): Promise<WebAuthnVerificationResult>;

  /**
   * List credentials for user.
   *
   * @param did - User's DID
   * @returns Array of credentials
   *
   * @public
   */
  listCredentials(did: DID): Promise<readonly WebAuthnCredential[]>;

  /**
   * Delete credential.
   *
   * @param did - User's DID (for ownership verification)
   * @param credentialId - Credential ID to delete
   *
   * @throws NotFoundError if credential does not exist
   * @throws AuthorizationError if not credential owner
   *
   * @public
   */
  deleteCredential(did: DID, credentialId: string): Promise<void>;

  /**
   * Update credential nickname.
   *
   * @param did - User's DID
   * @param credentialId - Credential ID
   * @param nickname - New nickname
   *
   * @public
   */
  updateCredentialNickname(did: DID, credentialId: string, nickname: string): Promise<void>;
}
