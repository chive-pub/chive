/**
 * Multi-factor authentication service.
 *
 * @remarks
 * Implements TOTP-based MFA using @otplib with backup codes.
 *
 * @packageDocumentation
 * @public
 */

import { randomBytes, createHash } from 'node:crypto';

import { authenticator } from '@otplib/preset-default';
import type { Redis } from 'ioredis';

import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  IMFAService,
  TOTPEnrollment,
  TOTPOptions,
  MFAEnrollment,
  MFAVerificationRequest,
  MFAVerificationResult,
} from '../../types/interfaces/mfa.interface.js';
import { MFAVerificationError } from '../errors.js';

/**
 * MFA service configuration.
 *
 * @public
 */
export interface MFAServiceConfig {
  /**
   * TOTP issuer name.
   *
   * @defaultValue 'Chive'
   */
  readonly issuer?: string;

  /**
   * Number of backup codes to generate.
   *
   * @defaultValue 10
   */
  readonly backupCodeCount?: number;

  /**
   * Redis key prefix.
   *
   * @defaultValue 'chive:mfa:'
   */
  readonly keyPrefix?: string;

  /**
   * Maximum verification attempts before lockout.
   *
   * @defaultValue 5
   */
  readonly maxAttempts?: number;

  /**
   * Lockout duration in seconds.
   *
   * @defaultValue 900 (15 minutes)
   */
  readonly lockoutDurationSeconds?: number;

  /**
   * Enrollment expiration in seconds.
   *
   * @defaultValue 600 (10 minutes)
   */
  readonly enrollmentExpirationSeconds?: number;

  /**
   * Roles that require MFA.
   */
  readonly mfaRequiredRoles?: readonly string[];
}

/**
 * MFA service options.
 *
 * @public
 */
export interface MFAServiceOptions {
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
  readonly config?: MFAServiceConfig;

  /**
   * Callback to check user roles.
   */
  readonly getRoles?: (did: DID) => Promise<readonly string[]>;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<Omit<MFAServiceConfig, 'mfaRequiredRoles'>> & {
  mfaRequiredRoles: readonly string[];
} = {
  issuer: 'Chive',
  backupCodeCount: 10,
  keyPrefix: 'chive:mfa:',
  maxAttempts: 5,
  lockoutDurationSeconds: 900,
  enrollmentExpirationSeconds: 600,
  mfaRequiredRoles: ['admin', 'moderator', 'graph-editor'],
};

/**
 * Stored enrollment data.
 */
interface StoredEnrollment {
  enrollmentId: string;
  secret: string;
  backupCodes: string[];
  createdAt: string;
}

/**
 * Stored TOTP data.
 */
interface StoredTOTP {
  secret: string;
  enrolledAt: string;
}

/**
 * MFA service implementation.
 *
 * @remarks
 * Provides TOTP enrollment, verification, and backup code management.
 *
 * @example
 * ```typescript
 * const mfaService = new MFAService({
 *   redis,
 *   logger,
 * });
 *
 * // Enroll TOTP
 * const enrollment = await mfaService.enrollTOTP(did);
 * // User scans QR code...
 *
 * // Verify and activate
 * await mfaService.verifyTOTPEnrollment(did, enrollment.enrollmentId, userCode);
 *
 * // Later, verify during login
 * const result = await mfaService.verifyMFA(did, {
 *   method: 'totp',
 *   value: userCode,
 * });
 * ```
 *
 * @public
 */
export class MFAService implements IMFAService {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: Required<Omit<MFAServiceConfig, 'mfaRequiredRoles'>> & {
    mfaRequiredRoles: readonly string[];
  };
  private readonly getRoles: (did: DID) => Promise<readonly string[]>;

  /**
   * Creates a new MFAService.
   *
   * @param options - Service options
   */
  constructor(options: MFAServiceOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = {
      ...DEFAULT_CONFIG,
      ...options.config,
      mfaRequiredRoles: options.config?.mfaRequiredRoles ?? DEFAULT_CONFIG.mfaRequiredRoles,
    };
    this.getRoles = options.getRoles ?? (() => Promise.resolve([]));
  }

  /**
   * Starts TOTP enrollment for a user.
   *
   * @param did - User's DID
   * @param options - TOTP options
   * @returns TOTP enrollment with secret and URI
   */
  async enrollTOTP(did: DID, options?: TOTPOptions): Promise<TOTPEnrollment> {
    // Generate secret
    const secret = authenticator.generateSecret();

    // Generate enrollment ID
    const enrollmentId = crypto.randomUUID();

    // Generate otpauth URI
    const issuer = options?.issuer ?? this.config.issuer;
    const accountName = options?.accountName ?? did;
    const uri = authenticator.keyuri(accountName, issuer, secret);

    // Generate backup codes
    const backupCodes = this.generateBackupCodesArray();

    // Store pending enrollment
    const pendingKey = `${this.config.keyPrefix}pending:${did}:${enrollmentId}`;
    const storedEnrollment: StoredEnrollment = {
      enrollmentId,
      secret,
      backupCodes: backupCodes.map((code) => this.hashCode(code)),
      createdAt: new Date().toISOString(),
    };

    await this.redis.setex(
      pendingKey,
      this.config.enrollmentExpirationSeconds,
      JSON.stringify(storedEnrollment)
    );

    this.logger.debug('TOTP enrollment started', { did, enrollmentId });

    return {
      enrollmentId,
      secret,
      uri,
      backupCodes,
    };
  }

  /**
   * Verifies a TOTP code and completes enrollment.
   *
   * @param did - User's DID
   * @param enrollmentId - Enrollment ID from enrollTOTP
   * @param code - TOTP code from authenticator app
   * @returns True if enrollment verified
   */
  async verifyTOTPEnrollment(did: DID, enrollmentId: string, code: string): Promise<boolean> {
    const pendingKey = `${this.config.keyPrefix}pending:${did}:${enrollmentId}`;
    const pendingData = await this.redis.get(pendingKey);

    if (!pendingData) {
      throw new MFAVerificationError('totp', 'No pending TOTP enrollment or enrollment expired');
    }

    const storedEnrollment = JSON.parse(pendingData) as StoredEnrollment;

    // Verify code
    const isValid = authenticator.verify({ token: code, secret: storedEnrollment.secret });

    if (!isValid) {
      throw new MFAVerificationError('totp', 'Invalid TOTP code');
    }

    // Store activated TOTP
    const totpKey = `${this.config.keyPrefix}totp:${did}`;
    const storedTOTP: StoredTOTP = {
      secret: storedEnrollment.secret,
      enrolledAt: new Date().toISOString(),
    };
    await this.redis.set(totpKey, JSON.stringify(storedTOTP));

    // Store backup codes
    const backupKey = `${this.config.keyPrefix}backup:${did}`;
    await this.redis.del(backupKey);
    if (storedEnrollment.backupCodes.length > 0) {
      await this.redis.sadd(backupKey, ...storedEnrollment.backupCodes);
    }

    // Delete pending enrollment
    await this.redis.del(pendingKey);

    this.logger.info('TOTP enrollment activated', { did });

    return true;
  }

  /**
   * Disables TOTP for a user.
   *
   * @param did - User's DID
   */
  async disableTOTP(did: DID): Promise<void> {
    const totpKey = `${this.config.keyPrefix}totp:${did}`;
    const backupKey = `${this.config.keyPrefix}backup:${did}`;

    await this.redis.del(totpKey, backupKey);

    this.logger.info('TOTP disabled', { did });
  }

  /**
   * Verifies an MFA code or credential.
   *
   * @param did - User's DID
   * @param request - Verification request
   * @returns Verification result
   */
  async verifyMFA(did: DID, request: MFAVerificationRequest): Promise<MFAVerificationResult> {
    const { method, value } = request;

    // Check for lockout
    const lockoutKey = `${this.config.keyPrefix}lockout:${did}`;
    const lockout = await this.redis.get(lockoutKey);

    if (lockout) {
      const ttl = await this.redis.ttl(lockoutKey);
      return {
        verified: false,
        method,
        error: `Too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      };
    }

    let verified = false;
    let backupCodesRemaining: number | undefined;

    switch (method) {
      case 'totp':
        verified = await this.verifyTOTP(did, value);
        break;
      case 'backup_code':
        verified = await this.verifyBackupCode(did, value);
        if (verified) {
          backupCodesRemaining = await this.getRemainingBackupCodes(did);
        }
        break;
      case 'webauthn':
        // WebAuthn is handled by WebAuthnService
        return {
          verified: false,
          method,
          error: 'WebAuthn verification should use WebAuthnService',
        };
      default:
        return {
          verified: false,
          method,
          error: 'Unsupported MFA method',
        };
    }

    if (!verified) {
      await this.recordFailedAttempt(did);
      const attemptsRemaining = await this.getRemainingAttempts(did);

      return {
        verified: false,
        method,
        error: `Invalid code. ${attemptsRemaining} attempts remaining.`,
      };
    }

    // Clear failed attempts on success
    await this.clearFailedAttempts(did);

    this.logger.info('MFA verification successful', { did, method });

    return {
      verified: true,
      method,
      backupCodesRemaining,
    };
  }

  /**
   * Gets MFA enrollment status for a user.
   *
   * @param did - User's DID
   * @returns Enrollment status
   */
  async getEnrollmentStatus(did: DID): Promise<MFAEnrollment> {
    const totpKey = `${this.config.keyPrefix}totp:${did}`;
    const backupKey = `${this.config.keyPrefix}backup:${did}`;

    const totpData = await this.redis.get(totpKey);
    const backupCount = await this.redis.scard(backupKey);

    let totpEnabled = false;
    let totpEnrolledAt: Date | undefined;

    if (totpData) {
      const storedTOTP = JSON.parse(totpData) as StoredTOTP;
      totpEnabled = true;
      totpEnrolledAt = new Date(storedTOTP.enrolledAt);
    }

    const mfaRequired = await this.isMFARequired(did);

    // Check for WebAuthn credentials (simplified check)
    const webauthnKey = `chive:webauthn:creds:${did}`;
    const webauthnCount = await this.redis.scard(webauthnKey);

    return {
      did,
      totpEnabled,
      totpEnrolledAt,
      webauthnEnabled: webauthnCount > 0,
      backupCodesRemaining: backupCount,
      mfaRequired,
    };
  }

  /**
   * Regenerates backup codes.
   *
   * @param did - User's DID
   * @returns Array of new backup codes
   */
  async regenerateBackupCodes(did: DID): Promise<readonly string[]> {
    // Check if user has TOTP enabled
    const totpKey = `${this.config.keyPrefix}totp:${did}`;
    const totpData = await this.redis.get(totpKey);

    if (!totpData) {
      throw new MFAVerificationError(
        'backup_code',
        'TOTP must be enabled to generate backup codes'
      );
    }

    // Generate new codes
    const codes = this.generateBackupCodesArray();
    const hashedCodes = codes.map((code) => this.hashCode(code));

    // Store hashed codes
    const backupKey = `${this.config.keyPrefix}backup:${did}`;
    await this.redis.del(backupKey);
    if (hashedCodes.length > 0) {
      await this.redis.sadd(backupKey, ...hashedCodes);
    }

    this.logger.info('Backup codes regenerated', { did, count: codes.length });

    return codes;
  }

  /**
   * Checks if MFA is required for a user.
   *
   * @param did - User's DID
   * @returns True if MFA is required
   */
  async isMFARequired(did: DID): Promise<boolean> {
    const roles = await this.getRoles(did);

    return roles.some((role) => this.config.mfaRequiredRoles.includes(role));
  }

  /**
   * Checks if user has any MFA methods enabled.
   *
   * @param did - User's DID
   * @returns True if any MFA method is enabled
   */
  async hasMFAEnabled(did: DID): Promise<boolean> {
    const status = await this.getEnrollmentStatus(did);
    return status.totpEnabled || status.webauthnEnabled;
  }

  /**
   * Gets remaining backup codes count.
   *
   * @param did - User's DID
   * @returns Number of remaining codes
   */
  private async getRemainingBackupCodes(did: DID): Promise<number> {
    const backupKey = `${this.config.keyPrefix}backup:${did}`;
    return this.redis.scard(backupKey);
  }

  /**
   * Verifies a TOTP code.
   *
   * @param did - User's DID
   * @param code - TOTP code
   * @returns True if valid
   */
  private async verifyTOTP(did: DID, code: string): Promise<boolean> {
    const totpKey = `${this.config.keyPrefix}totp:${did}`;
    const totpData = await this.redis.get(totpKey);

    if (!totpData) {
      return false;
    }

    const storedTOTP = JSON.parse(totpData) as StoredTOTP;
    return authenticator.verify({ token: code, secret: storedTOTP.secret });
  }

  /**
   * Verifies a backup code.
   *
   * @param did - User's DID
   * @param code - Backup code
   * @returns True if valid
   */
  private async verifyBackupCode(did: DID, code: string): Promise<boolean> {
    const backupKey = `${this.config.keyPrefix}backup:${did}`;
    const normalizedCode = code.replace(/[\s-]/g, '').toLowerCase();
    const hashedCode = this.hashCode(normalizedCode);

    const removed = await this.redis.srem(backupKey, hashedCode);

    if (removed > 0) {
      this.logger.info('Backup code used', { did });
      return true;
    }

    return false;
  }

  /**
   * Generates an array of backup codes.
   *
   * @returns Array of formatted backup codes
   */
  private generateBackupCodesArray(): string[] {
    const codes: string[] = [];

    for (let i = 0; i < this.config.backupCodeCount; i++) {
      codes.push(this.generateBackupCode());
    }

    return codes;
  }

  /**
   * Generates a single backup code.
   *
   * @returns Formatted backup code (xxxx-xxxx)
   */
  private generateBackupCode(): string {
    const bytes = randomBytes(4);
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
  }

  /**
   * Hashes a code for storage.
   *
   * @param code - Code to hash
   * @returns SHA-256 hash
   */
  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /**
   * Records a failed verification attempt.
   *
   * @param did - User's DID
   */
  private async recordFailedAttempt(did: DID): Promise<void> {
    const attemptsKey = `${this.config.keyPrefix}attempts:${did}`;
    const attempts = await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, this.config.lockoutDurationSeconds);

    if (attempts >= this.config.maxAttempts) {
      const lockoutKey = `${this.config.keyPrefix}lockout:${did}`;
      await this.redis.setex(lockoutKey, this.config.lockoutDurationSeconds, '1');

      this.logger.warn('MFA lockout triggered', { did, attempts });
    }
  }

  /**
   * Gets remaining verification attempts.
   *
   * @param did - User's DID
   * @returns Remaining attempts
   */
  private async getRemainingAttempts(did: DID): Promise<number> {
    const attemptsKey = `${this.config.keyPrefix}attempts:${did}`;
    const attempts = await this.redis.get(attemptsKey);
    return Math.max(0, this.config.maxAttempts - parseInt(attempts ?? '0', 10));
  }

  /**
   * Clears failed attempt counter.
   *
   * @param did - User's DID
   */
  private async clearFailedAttempts(did: DID): Promise<void> {
    const attemptsKey = `${this.config.keyPrefix}attempts:${did}`;
    await this.redis.del(attemptsKey);
  }
}
