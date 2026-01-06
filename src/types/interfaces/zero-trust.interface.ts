/**
 * Zero Trust architecture interfaces.
 *
 * @remarks
 * Provides type definitions for Zero Trust security including:
 * - SPIFFE/SPIRE service identity (X.509 SVIDs)
 * - Open Policy Agent (OPA) policy evaluation
 * - Mutual TLS (mTLS) configuration
 *
 * Implements NIST SP 800-207 Zero Trust Architecture.
 *
 * @see {@link https://csrc.nist.gov/publications/detail/sp/800-207/final | NIST SP 800-207}
 * @see {@link https://spiffe.io/docs/latest/spiffe-about/overview/ | SPIFFE Specification}
 *
 * @packageDocumentation
 * @public
 */

/**
 * SPIFFE Verifiable Identity Document (SVID).
 *
 * @remarks
 * X.509 certificate containing SPIFFE ID.
 *
 * @public
 */
export interface X509SVID {
  /**
   * SPIFFE ID.
   *
   * @remarks
   * Format: spiffe://trust-domain/path
   *
   * @example "spiffe://chive.pub/ns/production/sa/appview-service"
   */
  readonly spiffeId: string;

  /**
   * X.509 certificate chain (PEM encoded).
   *
   * @remarks
   * First certificate is the SVID, followed by intermediate CAs.
   */
  readonly certChain: readonly string[];

  /**
   * Private key (PEM encoded).
   *
   * @remarks
   * Only available when fetching own SVID.
   */
  readonly privateKey?: string;

  /**
   * Certificate expiration timestamp.
   */
  readonly expiresAt: Date;

  /**
   * Certificate not-before timestamp.
   */
  readonly notBefore: Date;
}

/**
 * Trust bundle containing CA certificates.
 *
 * @public
 */
export interface TrustBundle {
  /**
   * Trust domain.
   *
   * @example "chive.pub"
   */
  readonly trustDomain: string;

  /**
   * Root CA certificates (PEM encoded).
   */
  readonly certificates: readonly string[];

  /**
   * Bundle sequence number.
   *
   * @remarks
   * Increases when bundle is updated.
   */
  readonly sequenceNumber: number;

  /**
   * Refresh hint in seconds.
   *
   * @remarks
   * Recommended interval for refreshing the bundle.
   */
  readonly refreshHint: number;
}

/**
 * SVID verification result.
 *
 * @public
 */
export interface SVIDVerificationResult {
  /**
   * Whether verification succeeded.
   */
  readonly verified: boolean;

  /**
   * Verified SPIFFE ID (if successful).
   */
  readonly spiffeId?: string;

  /**
   * Error message (if failed).
   */
  readonly error?: string;

  /**
   * Certificate details.
   */
  readonly certificate?: {
    readonly subject: string;
    readonly issuer: string;
    readonly serialNumber: string;
    readonly notBefore: Date;
    readonly notAfter: Date;
  };
}

/**
 * Service identity interface.
 *
 * @remarks
 * Provides SPIFFE-based service identity for Zero Trust.
 *
 * @public
 */
export interface IServiceIdentity {
  /**
   * Get own SVID.
   *
   * @remarks
   * Returns the current service's X.509 SVID.
   *
   * @returns Current SVID
   *
   * @public
   */
  getSVID(): Promise<X509SVID>;

  /**
   * Get trust bundle.
   *
   * @remarks
   * Returns CA certificates for verifying peer SVIDs.
   *
   * @param trustDomain - Optional trust domain (defaults to own domain)
   * @returns Trust bundle
   *
   * @public
   */
  getTrustBundle(trustDomain?: string): Promise<TrustBundle>;

  /**
   * Verify peer SVID.
   *
   * @param certChain - PEM-encoded certificate chain
   * @returns Verification result
   *
   * @public
   */
  verifyPeerSVID(certChain: readonly string[]): Promise<SVIDVerificationResult>;

  /**
   * Watch for SVID rotation.
   *
   * @remarks
   * Callback is invoked when SVID is rotated.
   *
   * @param callback - Function to call with new SVID
   * @returns Unsubscribe function
   *
   * @public
   */
  watchSVID(callback: (svid: X509SVID) => void): () => void;
}

/**
 * OPA policy input for authorization decisions.
 *
 * @public
 */
export interface PolicyInput {
  /**
   * Subject identity.
   */
  readonly subject: {
    /**
     * User's DID (if user request).
     */
    readonly did?: string;

    /**
     * Service SPIFFE ID (if service-to-service).
     */
    readonly spiffeId?: string;

    /**
     * JWT claims (if JWT authenticated).
     */
    readonly claims?: Readonly<Record<string, unknown>>;

    /**
     * User roles.
     */
    readonly roles?: readonly string[];
  };

  /**
   * Action being performed.
   */
  readonly action: string;

  /**
   * Resource being accessed.
   */
  readonly resource: {
    /**
     * Resource type.
     */
    readonly type: string;

    /**
     * Resource identifier.
     */
    readonly id?: string;

    /**
     * Resource owner.
     */
    readonly owner?: string;

    /**
     * Additional resource attributes.
     */
    readonly attributes?: Readonly<Record<string, unknown>>;
  };

  /**
   * Request context.
   */
  readonly context?: {
    /**
     * Client IP address.
     */
    readonly ipAddress?: string;

    /**
     * Request timestamp.
     */
    readonly timestamp?: string;

    /**
     * Request path.
     */
    readonly path?: string;

    /**
     * Request method.
     */
    readonly method?: string;

    /**
     * Additional context.
     */
    readonly attributes?: Readonly<Record<string, unknown>>;
  };
}

/**
 * OPA policy decision.
 *
 * @public
 */
export interface PolicyDecision {
  /**
   * Whether the action is allowed.
   */
  readonly allow: boolean;

  /**
   * Reasons for the decision.
   *
   * @remarks
   * Useful for debugging and audit logging.
   */
  readonly reasons?: readonly string[];

  /**
   * Obligations to be fulfilled.
   *
   * @remarks
   * Additional actions required after allowing.
   *
   * @example ["log_access", "rate_limit"]
   */
  readonly obligations?: readonly PolicyObligation[];

  /**
   * Decision time-to-live in seconds.
   *
   * @remarks
   * How long the decision can be cached.
   */
  readonly ttl?: number;
}

/**
 * Policy obligation to be fulfilled.
 *
 * @public
 */
export interface PolicyObligation {
  /**
   * Obligation type.
   */
  readonly type: string;

  /**
   * Obligation parameters.
   */
  readonly parameters?: Readonly<Record<string, unknown>>;
}

/**
 * Zero Trust policy interface.
 *
 * @remarks
 * Provides policy evaluation via Open Policy Agent.
 *
 * @example
 * ```typescript
 * const policy = container.resolve<IZeroTrustPolicy>('IZeroTrustPolicy');
 *
 * const decision = await policy.evaluate({
 *   subject: { did: userDid, roles: ['author'] },
 *   action: 'read',
 *   resource: { type: 'preprint', id: preprintId },
 * });
 *
 * if (!decision.allow) {
 *   throw new AuthorizationError('Access denied');
 * }
 * ```
 *
 * @public
 */
export interface IZeroTrustPolicy {
  /**
   * Evaluate policy for given input.
   *
   * @param input - Policy input
   * @returns Policy decision
   *
   * @public
   */
  evaluate(input: PolicyInput): Promise<PolicyDecision>;

  /**
   * Load policy bundle from URL.
   *
   * @remarks
   * Fetches and loads OPA bundle.
   *
   * @param bundleUrl - URL to OPA bundle
   *
   * @public
   */
  loadPolicy(bundleUrl: string): Promise<void>;

  /**
   * Get current policy version.
   *
   * @returns Policy version string
   *
   * @public
   */
  getPolicyVersion(): Promise<string>;

  /**
   * Audit a policy decision.
   *
   * @remarks
   * Logs the decision for compliance and debugging.
   *
   * @param decision - Policy decision
   * @param input - Original policy input
   *
   * @public
   */
  auditDecision(decision: PolicyDecision, input: PolicyInput): Promise<void>;
}

/**
 * mTLS configuration.
 *
 * @public
 */
export interface MTLSConfig {
  /**
   * TLS protocol version.
   *
   * @remarks
   * Should be 1.3 for Zero Trust.
   */
  readonly minVersion: 'TLSv1.2' | 'TLSv1.3';

  /**
   * Allowed cipher suites.
   *
   * @remarks
   * Should use AEAD ciphers only.
   */
  readonly cipherSuites?: readonly string[];

  /**
   * Whether to require client certificates.
   *
   * @remarks
   * True for mTLS, false for server TLS only.
   */
  readonly requireClientCert: boolean;

  /**
   * Whether to verify client certificate.
   */
  readonly verifyClient: boolean;

  /**
   * CA certificates for client verification (PEM encoded).
   */
  readonly clientCAs?: readonly string[];

  /**
   * Server certificate (PEM encoded).
   */
  readonly certificate: string;

  /**
   * Server private key (PEM encoded).
   */
  readonly privateKey: string;

  /**
   * Certificate chain (PEM encoded).
   */
  readonly certificateChain?: readonly string[];
}

/**
 * mTLS configuration provider interface.
 *
 * @public
 */
export interface IMTLSConfigProvider {
  /**
   * Get mTLS configuration.
   *
   * @returns Current mTLS configuration
   *
   * @public
   */
  getConfig(): Promise<MTLSConfig>;

  /**
   * Watch for configuration updates.
   *
   * @remarks
   * Callback invoked when certificates rotate.
   *
   * @param callback - Function to call with new config
   * @returns Unsubscribe function
   *
   * @public
   */
  watchConfig(callback: (config: MTLSConfig) => void): () => void;

  /**
   * Verify peer certificate.
   *
   * @param certChain - Peer certificate chain (PEM encoded)
   * @returns Verification result
   *
   * @public
   */
  verifyPeer(certChain: readonly string[]): Promise<SVIDVerificationResult>;
}
