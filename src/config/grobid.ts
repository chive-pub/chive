/**
 * GROBID service configuration.
 *
 * @remarks
 * Configuration for the GROBID reference extraction service.
 * GROBID runs as a Docker sidecar and processes PDFs to extract
 * structured bibliographic references in TEI-XML format.
 *
 * @packageDocumentation
 */

/**
 * GROBID configuration.
 *
 * @public
 */
export interface GrobidConfig {
  /**
   * GROBID service URL.
   *
   * @remarks
   * Points to the GROBID REST API endpoint. In Docker Compose,
   * this is the internal service hostname.
   *
   * Environment variable: `GROBID_URL`
   * Default: `http://grobid:8070`
   */
  readonly url: string;

  /**
   * Request timeout in milliseconds.
   *
   * @remarks
   * PDF processing can take significant time for large documents.
   * 60 seconds is a reasonable default for most papers.
   *
   * Environment variable: `GROBID_TIMEOUT`
   * Default: 60000
   */
  readonly timeout: number;

  /**
   * Maximum concurrent requests to GROBID.
   *
   * @remarks
   * Should match the GROBID_MAX_CONCURRENCY Docker environment variable.
   *
   * Environment variable: `GROBID_MAX_CONCURRENCY`
   * Default: 4
   */
  readonly maxConcurrency: number;

  /**
   * Whether GROBID integration is enabled.
   *
   * @remarks
   * Set to false to disable GROBID entirely (e.g., in environments
   * where the Docker service is not available).
   *
   * Environment variable: `GROBID_ENABLED`
   * Default: true
   */
  readonly enabled: boolean;
}

/**
 * Loads GROBID configuration from environment variables.
 *
 * @returns GROBID configuration
 *
 * @example
 * ```typescript
 * const config = getGrobidConfig();
 * console.log(config.url); // 'http://grobid:8070'
 * ```
 *
 * @public
 */
export function getGrobidConfig(): GrobidConfig {
  return {
    url: process.env.GROBID_URL ?? 'http://grobid:8070',
    timeout: parseInt(process.env.GROBID_TIMEOUT ?? '60000', 10),
    maxConcurrency: parseInt(process.env.GROBID_MAX_CONCURRENCY ?? '4', 10),
    enabled: process.env.GROBID_ENABLED !== 'false',
  };
}
