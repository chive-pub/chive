/**
 * Multi-factor authentication (MFA) service interfaces.
 *
 * @remarks
 * Provides type definitions for MFA including:
 * - TOTP (Time-based One-Time Password)
 * - Backup codes
 * - MFA enrollment and verification
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6238 | RFC 6238 TOTP}
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../atproto.js';

/**
 * MFA method types.
 *
 * @public
 */
export type MFAMethodType = 'totp' | 'webauthn' | 'backup_code';

/**
 * TOTP enrollment result.
 *
 * @public
 */
export interface TOTPEnrollment {
  /**
   * Enrollment identifier.
   */
  readonly enrollmentId: string;

  /**
   * Base32-encoded secret for authenticator app.
   *
   * @remarks
   * Should be displayed to user only once during enrollment.
   */
  readonly secret: string;

  /**
   * otpauth:// URI for QR code generation.
   *
   * @example "otpauth://totp/Chive:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Chive"
   */
  readonly uri: string;

  /**
   * Recovery codes for backup.
   *
   * @remarks
   * 10 single-use codes generated during enrollment.
   * Should be displayed to user only once.
   */
  readonly backupCodes: readonly string[];
}

/**
 * MFA enrollment status.
 *
 * @public
 */
export interface MFAEnrollment {
  /**
   * User's DID.
   */
  readonly did: DID;

  /**
   * Whether TOTP is enrolled.
   */
  readonly totpEnabled: boolean;

  /**
   * TOTP enrollment timestamp.
   */
  readonly totpEnrolledAt?: Date;

  /**
   * Whether any WebAuthn credentials are registered.
   */
  readonly webauthnEnabled: boolean;

  /**
   * Number of remaining backup codes.
   */
  readonly backupCodesRemaining: number;

  /**
   * Whether MFA is required for this user.
   *
   * @remarks
   * True for users with elevated roles (moderator, authority-editor, admin).
   */
  readonly mfaRequired: boolean;
}

/**
 * MFA verification request.
 *
 * @public
 */
export interface MFAVerificationRequest {
  /**
   * MFA method type.
   */
  readonly method: MFAMethodType;

  /**
   * Verification code or credential.
   *
   * @remarks
   * For TOTP: 6-digit code.
   * For backup_code: the backup code.
   * For webauthn: serialized credential response.
   */
  readonly value: string;
}

/**
 * MFA verification result.
 *
 * @public
 */
export interface MFAVerificationResult {
  /**
   * Whether verification succeeded.
   */
  readonly verified: boolean;

  /**
   * Method that was verified.
   */
  readonly method: MFAMethodType;

  /**
   * Error message (if failed).
   */
  readonly error?: string;

  /**
   * Remaining backup codes (if backup code was used).
   */
  readonly backupCodesRemaining?: number;
}

/**
 * TOTP generation options.
 *
 * @public
 */
export interface TOTPOptions {
  /**
   * TOTP period in seconds.
   *
   * @defaultValue 30
   */
  readonly period?: number;

  /**
   * Number of digits in code.
   *
   * @defaultValue 6
   */
  readonly digits?: number;

  /**
   * HMAC algorithm.
   *
   * @defaultValue 'SHA1'
   */
  readonly algorithm?: 'SHA1' | 'SHA256' | 'SHA512';

  /**
   * Account name for URI.
   */
  readonly accountName?: string;

  /**
   * Issuer for URI.
   *
   * @defaultValue 'Chive'
   */
  readonly issuer?: string;
}

/**
 * MFA service interface.
 *
 * @remarks
 * Provides multi-factor authentication for enhanced security.
 *
 * @example
 * ```typescript
 * const mfaService = container.resolve<IMFAService>('IMFAService');
 *
 * // Enroll TOTP
 * const enrollment = await mfaService.enrollTOTP(did);
 * // Display QR code from enrollment.uri
 * // Verify with code from authenticator app
 * await mfaService.verifyTOTPEnrollment(did, enrollment.enrollmentId, userCode);
 *
 * // Later, during login
 * const result = await mfaService.verifyMFA(did, {
 *   method: 'totp',
 *   value: userCode,
 * });
 * ```
 *
 * @public
 */
export interface IMFAService {
  /**
   * Start TOTP enrollment.
   *
   * @remarks
   * Generates secret and backup codes.
   * User must verify with a code from their authenticator
   * before enrollment is complete.
   *
   * @param did - User's DID
   * @param options - TOTP options
   * @returns Enrollment with secret and backup codes
   *
   * @public
   */
  enrollTOTP(did: DID, options?: TOTPOptions): Promise<TOTPEnrollment>;

  /**
   * Verify TOTP enrollment.
   *
   * @remarks
   * Completes TOTP enrollment after user verifies with a code.
   *
   * @param did - User's DID
   * @param enrollmentId - Enrollment ID from enrollTOTP
   * @param code - TOTP code from authenticator app
   * @returns True if enrollment verified
   *
   * @throws ValidationError if code is invalid
   *
   * @public
   */
  verifyTOTPEnrollment(did: DID, enrollmentId: string, code: string): Promise<boolean>;

  /**
   * Disable TOTP for user.
   *
   * @param did - User's DID
   *
   * @public
   */
  disableTOTP(did: DID): Promise<void>;

  /**
   * Verify MFA code or credential.
   *
   * @param did - User's DID
   * @param request - Verification request
   * @returns Verification result
   *
   * @public
   */
  verifyMFA(did: DID, request: MFAVerificationRequest): Promise<MFAVerificationResult>;

  /**
   * Get MFA enrollment status.
   *
   * @param did - User's DID
   * @returns Enrollment status
   *
   * @public
   */
  getEnrollmentStatus(did: DID): Promise<MFAEnrollment>;

  /**
   * Generate new backup codes.
   *
   * @remarks
   * Invalidates existing backup codes and generates new ones.
   *
   * @param did - User's DID
   * @returns Array of 10 new backup codes
   *
   * @public
   */
  regenerateBackupCodes(did: DID): Promise<readonly string[]>;

  /**
   * Check if MFA is required for user.
   *
   * @remarks
   * MFA is required for users with elevated roles.
   *
   * @param did - User's DID
   * @returns True if MFA is required
   *
   * @public
   */
  isMFARequired(did: DID): Promise<boolean>;

  /**
   * Check if user has any MFA methods enrolled.
   *
   * @param did - User's DID
   * @returns True if any MFA method is enabled
   *
   * @public
   */
  hasMFAEnabled(did: DID): Promise<boolean>;
}
