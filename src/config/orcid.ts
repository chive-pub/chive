/**
 * ORCID OAuth configuration.
 *
 * @remarks
 * Configuration for the ORCID OAuth integration used to verify
 * author ORCID identities. Supports both the ORCID production
 * environment and the sandbox environment for testing.
 *
 * @packageDocumentation
 */

/**
 * ORCID OAuth configuration.
 *
 * @public
 */
export interface OrcidConfig {
  /**
   * ORCID OAuth client ID.
   *
   * @remarks
   * Obtained from the ORCID developer tools dashboard.
   *
   * Environment variable: `ORCID_CLIENT_ID`
   */
  readonly clientId: string;

  /**
   * ORCID OAuth client secret.
   *
   * @remarks
   * Obtained from the ORCID developer tools dashboard.
   *
   * Environment variable: `ORCID_CLIENT_SECRET`
   */
  readonly clientSecret: string;

  /**
   * ORCID base URL.
   *
   * @remarks
   * Use `https://orcid.org` for production or
   * `https://sandbox.orcid.org` for testing.
   *
   * Environment variable: `ORCID_BASE_URL`
   * Default: `https://orcid.org`
   */
  readonly baseUrl: string;

  /**
   * OAuth redirect URI for the callback endpoint.
   *
   * @remarks
   * Must match the redirect URI registered in the ORCID developer dashboard.
   *
   * Environment variable: `ORCID_REDIRECT_URI`
   * Default: `{API_BASE_URL}/api/v1/auth/orcid/callback`
   */
  readonly redirectUri: string;
}

/**
 * Returns ORCID OAuth configuration from environment variables.
 *
 * @returns ORCID OAuth configuration
 * @throws Error if ORCID_CLIENT_ID or ORCID_CLIENT_SECRET are not set
 *
 * @example
 * ```typescript
 * const config = getOrcidConfig();
 * console.log(config.baseUrl); // 'https://orcid.org'
 * ```
 *
 * @public
 */
export function getOrcidConfig(): OrcidConfig {
  const clientId = process.env.ORCID_CLIENT_ID;
  const clientSecret = process.env.ORCID_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'ORCID OAuth not configured: ORCID_CLIENT_ID and ORCID_CLIENT_SECRET are required'
    );
  }

  const baseUrl = process.env.ORCID_BASE_URL ?? 'https://orcid.org';
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  const redirectUri = process.env.ORCID_REDIRECT_URI ?? `${apiBaseUrl}/api/v1/auth/orcid/callback`;

  return { clientId, clientSecret, baseUrl, redirectUri };
}

/**
 * Checks if ORCID OAuth is configured (client ID and secret are set).
 *
 * @returns true if both ORCID_CLIENT_ID and ORCID_CLIENT_SECRET are set
 *
 * @example
 * ```typescript
 * if (isOrcidOAuthConfigured()) {
 *   const config = getOrcidConfig();
 * }
 * ```
 *
 * @public
 */
export function isOrcidOAuthConfigured(): boolean {
  return !!(process.env.ORCID_CLIENT_ID && process.env.ORCID_CLIENT_SECRET);
}
