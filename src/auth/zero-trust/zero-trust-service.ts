/**
 * Zero Trust architecture service.
 *
 * @remarks
 * Implements NIST SP 800-207 Zero Trust principles:
 * - Never trust, always verify
 * - Least privilege access
 * - Continuous verification
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';

import { APIError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  IZeroTrustPolicy,
  PolicyInput,
  PolicyDecision,
  PolicyObligation,
} from '../../types/interfaces/zero-trust.interface.js';

/**
 * Zero Trust service configuration.
 *
 * @public
 */
export interface ZeroTrustServiceConfig {
  /**
   * Minimum trust score required for access.
   *
   * @defaultValue 50
   */
  readonly minTrustScore?: number;

  /**
   * Trust score weights.
   */
  readonly weights?: {
    readonly authentication?: number;
    readonly devicePosture?: number;
    readonly behaviorAnalysis?: number;
    readonly networkContext?: number;
  };

  /**
   * Redis key prefix.
   *
   * @defaultValue 'chive:zt:'
   */
  readonly keyPrefix?: string;

  /**
   * Cache TTL in seconds.
   *
   * @defaultValue 300
   */
  readonly cacheTtlSeconds?: number;

  /**
   * Policy version.
   *
   * @defaultValue '0.1.0'
   */
  readonly policyVersion?: string;
}

/**
 * Zero Trust service options.
 *
 * @public
 */
export interface ZeroTrustServiceOptions {
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
  readonly config?: ZeroTrustServiceConfig;
}

/**
 * Full config type with all fields required.
 */
interface FullConfig {
  minTrustScore: number;
  weights: {
    authentication: number;
    devicePosture: number;
    behaviorAnalysis: number;
    networkContext: number;
  };
  keyPrefix: string;
  cacheTtlSeconds: number;
  policyVersion: string;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: FullConfig = {
  minTrustScore: 50,
  weights: {
    authentication: 40,
    devicePosture: 25,
    behaviorAnalysis: 20,
    networkContext: 15,
  },
  keyPrefix: 'chive:zt:',
  cacheTtlSeconds: 300,
  policyVersion: '0.1.0',
};

/**
 * Trust score components.
 */
interface TrustScore {
  total: number;
  components: {
    authentication: number;
    devicePosture: number;
    behaviorAnalysis: number;
    networkContext: number;
  };
}

/**
 * Device posture data.
 */
interface DevicePosture {
  encryptionEnabled?: boolean;
  screenLockEnabled?: boolean;
  biometricEnabled?: boolean;
  osUpToDate?: boolean;
  recordedAt?: string;
}

/**
 * Zero Trust policy service.
 *
 * @remarks
 * Evaluates access requests using multiple trust signals:
 * - Authentication strength (MFA, session age)
 * - Device posture (known device, security state)
 * - Behavioral analysis (unusual patterns)
 * - Network context (IP reputation, location)
 *
 * @example
 * ```typescript
 * const ztService = new ZeroTrustService({
 *   redis,
 *   logger,
 * });
 *
 * const decision = await ztService.evaluate({
 *   subject: { did: userDid, roles: ['author'] },
 *   action: 'write',
 *   resource: { type: 'preprint', id: preprintId },
 * });
 *
 * if (!decision.allow) {
 *   // Handle denial or step-up auth requirement
 * }
 * ```
 *
 * @public
 */
export class ZeroTrustService implements IZeroTrustPolicy {
  private readonly redis: Redis;
  private readonly logger: ILogger;
  private readonly config: FullConfig;
  private policyVersion: string;

  /**
   * Creates a new ZeroTrustService.
   *
   * @param options - Service options
   */
  constructor(options: ZeroTrustServiceOptions) {
    this.redis = options.redis;
    this.logger = options.logger;
    this.config = {
      ...DEFAULT_CONFIG,
      ...options.config,
      weights: { ...DEFAULT_CONFIG.weights, ...options.config?.weights },
    };
    this.policyVersion = options.config?.policyVersion ?? DEFAULT_CONFIG.policyVersion;
  }

  /**
   * Evaluates a policy decision for an access request.
   *
   * @param input - Policy input
   * @returns Policy decision
   */
  async evaluate(input: PolicyInput): Promise<PolicyDecision> {
    const trustScore = await this.calculateTrustScore(input);

    const allow = trustScore.total >= this.config.minTrustScore;
    const requiresStepUp =
      trustScore.total < this.config.minTrustScore + 20 &&
      trustScore.total >= this.config.minTrustScore - 10;

    const obligations: PolicyObligation[] = [];
    if (requiresStepUp) {
      obligations.push({
        type: 'step_up_authentication',
        parameters: { reason: 'Low trust score' },
      });
    }

    const reasons = this.getDecisionReasons(trustScore, allow);

    const decision: PolicyDecision = {
      allow,
      reasons,
      obligations: obligations.length > 0 ? obligations : undefined,
      ttl: this.config.cacheTtlSeconds,
    };

    // Log decision for audit
    this.logger.info('Zero trust evaluation', {
      subject: input.subject.did ?? input.subject.spiffeId,
      resource: `${input.resource.type}:${input.resource.id ?? 'all'}`,
      action: input.action,
      trustScore: trustScore.total,
      allow,
    });

    return decision;
  }

  /**
   * Loads policy bundle from URL.
   *
   * @remarks
   * Fetches and validates an OPA policy bundle from the specified URL.
   * The bundle is expected to be a tar.gz file containing Rego policies.
   *
   * OPA bundles follow the format specified in:
   * https://www.openpolicyagent.org/docs/latest/management-bundles/
   *
   * @param bundleUrl - URL to OPA bundle (tar.gz)
   * @throws ConfigurationError if bundle cannot be fetched or is invalid
   */
  async loadPolicy(bundleUrl: string): Promise<void> {
    this.logger.info('Loading policy bundle', { bundleUrl });

    try {
      // Fetch bundle from URL
      const response = await fetch(bundleUrl, {
        headers: {
          Accept: 'application/gzip, application/x-tar, application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new APIError(
          `Failed to fetch OPA bundle: ${response.statusText}`,
          response.status,
          bundleUrl
        );
      }

      // Get bundle as ArrayBuffer
      const bundle = await response.arrayBuffer();
      const bundleBuffer = Buffer.from(bundle);

      if (bundleBuffer.length === 0) {
        throw new ValidationError('OPA bundle is empty', 'bundle', 'non_empty');
      }

      // Calculate bundle hash for change detection
      const hashBuffer = await crypto.subtle.digest('SHA-256', bundle);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const bundleHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      // Check if bundle has changed
      const hashKey = `${this.config.keyPrefix}policy:hash`;
      const currentHash = await this.redis.get(hashKey);

      if (currentHash === bundleHash) {
        this.logger.debug('Policy bundle unchanged, skipping reload', { bundleUrl });
        return;
      }

      // Store bundle URL and hash for reference
      const urlKey = `${this.config.keyPrefix}policy:bundle`;
      await this.redis.set(urlKey, bundleUrl);
      await this.redis.set(hashKey, bundleHash);

      // Store bundle content (for potential OPA sidecar to pick up)
      const contentKey = `${this.config.keyPrefix}policy:content`;
      await this.redis.set(contentKey, bundleBuffer.toString('base64'));

      // Update version based on bundle hash
      const previousVersion = this.policyVersion;
      this.policyVersion = `bundle-${bundleHash.slice(0, 8)}`;

      this.logger.info('OPA policy bundle loaded', {
        bundleUrl,
        bundleSize: bundleBuffer.length,
        bundleHash: bundleHash.slice(0, 16),
        previousVersion,
        newVersion: this.policyVersion,
      });

      // Clear decision cache when policy changes
      const cachePattern = `${this.config.keyPrefix}decision:*`;
      const keys = await this.redis.keys(cachePattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug('Cleared decision cache after policy update', {
          clearedKeys: keys.length,
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to load OPA policy bundle',
        error instanceof Error ? error : undefined,
        {
          bundleUrl,
        }
      );
      throw error;
    }
  }

  /**
   * Gets current policy version.
   *
   * @returns Policy version string
   */
  getPolicyVersion(): Promise<string> {
    return Promise.resolve(this.policyVersion);
  }

  /**
   * Audits a policy decision.
   *
   * @remarks
   * Logs the decision for compliance and debugging.
   *
   * @param decision - Policy decision
   * @param input - Original policy input
   */
  async auditDecision(decision: PolicyDecision, input: PolicyInput): Promise<void> {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      subject: input.subject,
      resource: input.resource,
      action: input.action,
      decision: {
        allow: decision.allow,
        reasons: decision.reasons,
      },
      context: input.context,
    };

    // Store in Redis for short-term audit trail
    const key = `${this.config.keyPrefix}audit:${Date.now()}`;
    await this.redis.setex(key, 86400 * 7, JSON.stringify(auditEntry)); // 7 days

    // Add to audit list
    const listKey = `${this.config.keyPrefix}audit:list`;
    await this.redis.lpush(listKey, key);
    await this.redis.ltrim(listKey, 0, 9999); // Keep last 10000 entries

    this.logger.debug('Policy decision audited', {
      subject: input.subject.did ?? input.subject.spiffeId,
      allow: decision.allow,
    });
  }

  /**
   * Records device posture for a user.
   *
   * @param did - User's DID
   * @param deviceId - Device identifier
   * @param posture - Device posture data
   */
  async recordDevicePosture(did: string, deviceId: string, posture: DevicePosture): Promise<void> {
    const key = `${this.config.keyPrefix}device:${did}:${deviceId}`;

    await this.redis.setex(
      key,
      86400 * 30, // 30 days
      JSON.stringify({
        ...posture,
        recordedAt: new Date().toISOString(),
      })
    );

    // Add to known devices
    const devicesKey = `${this.config.keyPrefix}devices:${did}`;
    await this.redis.sadd(devicesKey, deviceId);

    this.logger.debug('Device posture recorded', { did, deviceId });
  }

  /**
   * Gets known devices for a user.
   *
   * @param did - User's DID
   * @returns Array of device IDs
   */
  async getKnownDevices(did: string): Promise<string[]> {
    const devicesKey = `${this.config.keyPrefix}devices:${did}`;
    return this.redis.smembers(devicesKey);
  }

  /**
   * Records a security event for behavior analysis.
   *
   * @param did - User's DID
   * @param eventType - Event type
   * @param context - Event context
   */
  async recordSecurityEvent(
    did: string,
    eventType: string,
    context: Record<string, unknown>
  ): Promise<void> {
    const key = `${this.config.keyPrefix}events:${did}`;
    const event = JSON.stringify({
      type: eventType,
      context,
      timestamp: new Date().toISOString(),
    });

    // Store recent events (last 1000)
    await this.redis.lpush(key, event);
    await this.redis.ltrim(key, 0, 999);
    await this.redis.expire(key, 86400 * 7); // 7 days

    this.logger.debug('Security event recorded', { did, eventType });
  }

  /**
   * Calculates trust score for a request.
   *
   * @param input - Policy input
   * @returns Trust score
   */
  private async calculateTrustScore(input: PolicyInput): Promise<TrustScore> {
    const authScore = await this.calculateAuthenticationScore(input);
    const deviceScore = await this.calculateDeviceScore(input);
    const behaviorScore = await this.calculateBehaviorScore(input);
    const networkScore = await this.calculateNetworkScore(input);

    const total = Math.round(
      (authScore * this.config.weights.authentication +
        deviceScore * this.config.weights.devicePosture +
        behaviorScore * this.config.weights.behaviorAnalysis +
        networkScore * this.config.weights.networkContext) /
        100
    );

    return {
      total,
      components: {
        authentication: authScore,
        devicePosture: deviceScore,
        behaviorAnalysis: behaviorScore,
        networkContext: networkScore,
      },
    };
  }

  /**
   * Calculates authentication score.
   *
   * @param input - Policy input
   * @returns Score 0-100
   */
  private async calculateAuthenticationScore(input: PolicyInput): Promise<number> {
    let score = 0;

    // Base score for authenticated user
    if (input.subject.did) {
      score += 40;
    }

    // SPIFFE ID for service-to-service
    if (input.subject.spiffeId) {
      score += 50;
    }

    // Role-based bonus
    const roles = input.subject.roles ?? [];
    if (roles.includes('admin')) {
      score += 20;
    } else if (roles.includes('moderator') || roles.includes('authority-editor')) {
      score += 15;
    } else if (roles.includes('author')) {
      score += 10;
    }

    // MFA bonus (check via claims or Redis)
    if (input.subject.did) {
      const mfaKey = `${this.config.keyPrefix}mfa:${input.subject.did}`;
      const mfaUsed = await this.redis.get(mfaKey);
      if (mfaUsed) {
        score += 20;
      }
    }

    // Recent authentication bonus (from attributes)
    const sessionAge = input.context?.attributes?.sessionAge;
    if (typeof sessionAge === 'number') {
      if (sessionAge < 300) {
        score += 10;
      } else if (sessionAge < 1800) {
        score += 5;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculates device posture score.
   *
   * @param input - Policy input
   * @returns Score 0-100
   */
  private async calculateDeviceScore(input: PolicyInput): Promise<number> {
    const deviceId = input.context?.attributes?.deviceId;
    if (!deviceId || typeof deviceId !== 'string') {
      return 30; // Unknown device baseline
    }

    const did = input.subject.did;
    if (!did) {
      return 40; // No user context
    }

    // Check if known device
    const knownDevices = await this.getKnownDevices(did);
    if (!knownDevices.includes(deviceId)) {
      return 40; // New device
    }

    // Get device posture
    const key = `${this.config.keyPrefix}device:${did}:${deviceId}`;
    const postureData = await this.redis.get(key);

    if (!postureData) {
      return 50; // Known but no posture
    }

    const posture = JSON.parse(postureData) as DevicePosture;
    let score = 60; // Known device baseline

    // Add points for security features
    if (posture.encryptionEnabled) score += 15;
    if (posture.screenLockEnabled) score += 10;
    if (posture.biometricEnabled) score += 10;
    if (posture.osUpToDate) score += 5;

    return Math.min(100, score);
  }

  /**
   * Calculates behavior analysis score.
   *
   * @param input - Policy input
   * @returns Score 0-100
   */
  private async calculateBehaviorScore(input: PolicyInput): Promise<number> {
    const did = input.subject.did;
    if (!did) {
      return 70; // No user to analyze
    }

    // Start with baseline
    let score = 70;

    const eventsKey = `${this.config.keyPrefix}events:${did}`;
    const events = await this.redis.lrange(eventsKey, 0, 99);

    // Analyze recent events
    let failedLogins = 0;
    let unusualLocations = 0;

    for (const eventStr of events) {
      const event = JSON.parse(eventStr) as {
        type: string;
        context: Record<string, unknown>;
      };

      if (event.type === 'login_failed') {
        failedLogins++;
      }
      if (event.type === 'unusual_location') {
        unusualLocations++;
      }
    }

    // Deduct for suspicious activity
    score -= failedLogins * 5;
    score -= unusualLocations * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculates network context score.
   *
   * @param input - Policy input
   * @returns Score 0-100
   */
  private async calculateNetworkScore(input: PolicyInput): Promise<number> {
    const ipAddress = input.context?.ipAddress;
    if (!ipAddress) {
      return 50; // Unknown network
    }

    let score = 70; // Baseline

    // Check IP reputation (simplified)
    const reputationKey = `${this.config.keyPrefix}ip:${ipAddress}`;
    const reputation = await this.redis.get(reputationKey);

    if (reputation === 'trusted') {
      score += 20;
    } else if (reputation === 'suspicious') {
      score -= 30;
    } else if (reputation === 'blocked') {
      return 0;
    }

    // Bonus for known IP
    const did = input.subject.did;
    if (did) {
      const knownIpsKey = `${this.config.keyPrefix}ips:${did}`;
      const isKnown = await this.redis.sismember(knownIpsKey, ipAddress);
      if (isKnown) {
        score += 10;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Gets reasons for policy decision.
   *
   * @param trustScore - Calculated trust score
   * @param allow - Whether access is allowed
   * @returns Array of reasons
   */
  private getDecisionReasons(trustScore: TrustScore, allow: boolean): string[] {
    const reasons: string[] = [];

    if (allow) {
      reasons.push(`Access granted (trust score: ${trustScore.total})`);
    } else {
      reasons.push(
        `Access denied (trust score: ${trustScore.total}, minimum: ${this.config.minTrustScore})`
      );

      // Find weakest component
      const components = Object.entries(trustScore.components);
      const weakest = components.sort((a, b) => a[1] - b[1])[0];
      if (weakest) {
        reasons.push(`Lowest score: ${weakest[0]} (${weakest[1]})`);
      }
    }

    return reasons;
  }
}
