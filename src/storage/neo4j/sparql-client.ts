/**
 * SPARQL client with rate limiting and retry logic.
 *
 * @remarks
 * Provides a robust client for querying SPARQL endpoints (primarily Wikidata)
 * with built-in rate limiting, exponential backoff, and error handling.
 *
 * Wikidata rate limits (anonymous requests):
 * - 200 requests per minute
 * - 60 requests per second (burst)
 * - User-Agent required
 *
 * @packageDocumentation
 */

import { singleton } from 'tsyringe';

/**
 * SPARQL query binding value types.
 */
export type SparqlValue =
  | { type: 'uri'; value: string }
  | { type: 'literal'; value: string; 'xml:lang'?: string; datatype?: string }
  | { type: 'bnode'; value: string };

/**
 * SPARQL query result binding.
 */
export type SparqlBinding = Record<string, SparqlValue>;

/**
 * SPARQL query result format.
 */
export interface SparqlResult {
  head: {
    vars: string[];
    link?: string[];
  };
  results: {
    bindings: SparqlBinding[];
  };
}

/**
 * SPARQL query error details.
 */
export interface SparqlError extends Error {
  statusCode?: number;
  endpoint?: string;
  query?: string;
}

/**
 * SPARQL client configuration.
 */
export interface SparqlClientConfig {
  /**
   * SPARQL endpoint URL.
   * @default 'https://query.wikidata.org/sparql'
   */
  endpoint: string;

  /**
   * User-Agent header (required by Wikidata).
   * @default 'Chive/1.0 (https://chive.pub; contact@chive.pub)'
   */
  userAgent: string;

  /**
   * Maximum requests per minute.
   * @default 180 (conservative, Wikidata allows 200)
   */
  rateLimit: number;

  /**
   * Request timeout in milliseconds.
   * @default 30000 (30 seconds)
   */
  timeout: number;

  /**
   * Maximum retry attempts.
   * @default 3
   */
  maxRetries: number;

  /**
   * Initial retry delay in milliseconds.
   * @default 1000 (1 second)
   */
  retryDelay: number;

  /**
   * Exponential backoff multiplier.
   * @default 2
   */
  backoffMultiplier: number;
}

/**
 * Rate limiter using token bucket algorithm.
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(maxRequestsPerMinute: number) {
    this.maxTokens = maxRequestsPerMinute;
    this.tokens = maxRequestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = maxRequestsPerMinute / 60000; // tokens per ms
  }

  /**
   * Refill tokens based on elapsed time.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Wait until a token is available, then consume it.
   */
  async acquire(): Promise<void> {
    while (true) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Wait until next token should be available
      const waitTime = (1 - this.tokens) / this.refillRate;
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(waitTime)));
    }
  }
}

/**
 * SPARQL client with rate limiting and retry logic.
 *
 * @remarks
 * Provides methods for executing SPARQL queries against a configured endpoint
 * (default: Wikidata) with automatic rate limiting and retry handling.
 *
 * Features:
 * - Token bucket rate limiting (respects API limits)
 * - Exponential backoff retries
 * - Configurable timeouts
 * - User-Agent header management
 * - Strongly-typed result parsing
 *
 * @example
 * ```typescript
 * const client = new SparqlClient({
 *   endpoint: 'https://query.wikidata.org/sparql',
 *   rateLimit: 180,
 *   maxRetries: 3
 * });
 *
 * const result = await client.query(`
 *   SELECT ?item ?label WHERE {
 *     ?item wdt:P31 wd:Q5.
 *     ?item rdfs:label ?label.
 *     FILTER(LANG(?label) = "en")
 *   }
 *   LIMIT 10
 * `);
 * ```
 */
@singleton()
export class SparqlClient {
  private readonly config: SparqlClientConfig;
  private readonly rateLimiter: RateLimiter;

  constructor(config?: Partial<SparqlClientConfig>) {
    this.config = {
      endpoint: config?.endpoint ?? 'https://query.wikidata.org/sparql',
      userAgent: config?.userAgent ?? 'Chive/1.0 (https://chive.pub; contact@chive.pub)',
      rateLimit: config?.rateLimit ?? 180,
      timeout: config?.timeout ?? 30000,
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
    };

    this.rateLimiter = new RateLimiter(this.config.rateLimit);
  }

  /**
   * Execute a SPARQL SELECT query.
   *
   * @param query - SPARQL query string
   * @param retryCount - Current retry attempt (internal)
   * @returns Query results
   * @throws {SparqlError} If query fails after all retries
   *
   * @example
   * ```typescript
   * const results = await client.query(`
   *   PREFIX wd: <http://www.wikidata.org/entity/>
   *   PREFIX wdt: <http://www.wikidata.org/prop/direct/>
   *   PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
   *
   *   SELECT ?item ?label WHERE {
   *     ?item wdt:P31 wd:Q11862829.  # academic discipline
   *     ?item rdfs:label ?label.
   *     FILTER(LANG(?label) = "en")
   *   }
   *   LIMIT 100
   * `);
   *
   * for (const binding of results.results.bindings) {
   *   console.log(binding.label.value);
   * }
   * ```
   */
  async query(query: string, retryCount = 0): Promise<SparqlResult> {
    // Wait for rate limit token
    await this.rateLimiter.acquire();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const url = new URL(this.config.endpoint);
      url.searchParams.set('query', query);
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'application/sparql-results+json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Check if we should retry
        if (this.shouldRetry(response.status) && retryCount < this.config.maxRetries) {
          const delay = this.calculateRetryDelay(retryCount);
          await this.sleep(delay);
          return this.query(query, retryCount + 1);
        }

        const error = new Error(`SPARQL query failed: ${response.statusText}`) as SparqlError;
        error.statusCode = response.status;
        error.endpoint = this.config.endpoint;
        error.query = query;
        throw error;
      }

      const result = (await response.json()) as SparqlResult;
      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on network errors or timeouts
      if (retryCount < this.config.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        return this.query(query, retryCount + 1);
      }

      if (error instanceof Error) {
        const sparqlError = error as SparqlError;
        sparqlError.endpoint = this.config.endpoint;
        sparqlError.query = query;
        throw sparqlError;
      }

      throw error;
    }
  }

  /**
   * Execute a SPARQL ASK query.
   *
   * @param query - SPARQL ASK query
   * @returns Boolean result
   * @throws {SparqlError} If query fails
   *
   * @example
   * ```typescript
   * const exists = await client.ask(`
   *   ASK {
   *     wd:Q5 wdt:P31 wd:Q16889133.
   *   }
   * `);
   * console.log(exists ? 'Entity exists' : 'Entity not found');
   * ```
   */
  async ask(query: string): Promise<boolean> {
    await this.rateLimiter.acquire();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const url = new URL(this.config.endpoint);
      url.searchParams.set('query', query);
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'application/sparql-results+json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`SPARQL ASK query failed: ${response.statusText}`) as SparqlError;
        error.statusCode = response.status;
        error.endpoint = this.config.endpoint;
        error.query = query;
        throw error;
      }

      const result = (await response.json()) as { boolean: boolean };
      return result.boolean;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        const sparqlError = error as SparqlError;
        sparqlError.endpoint = this.config.endpoint;
        sparqlError.query = query;
        throw sparqlError;
      }

      throw error;
    }
  }

  /**
   * Extract string value from SPARQL binding.
   *
   * @param binding - SPARQL binding
   * @param variable - Variable name
   * @returns String value or undefined
   *
   * @example
   * ```typescript
   * const label = client.extractString(binding, 'label');
   * const uri = client.extractString(binding, 'item');
   * ```
   */
  extractString(binding: SparqlBinding, variable: string): string | undefined {
    const value = binding[variable];
    return value?.value;
  }

  /**
   * Extract language-tagged literal value.
   *
   * @param binding - SPARQL binding
   * @param variable - Variable name
   * @param language - Language code (e.g., 'en')
   * @returns String value or undefined
   *
   * @example
   * ```typescript
   * const label = client.extractLiteral(binding, 'label', 'en');
   * ```
   */
  extractLiteral(binding: SparqlBinding, variable: string, language?: string): string | undefined {
    const value = binding[variable];

    if (value?.type !== 'literal') {
      return undefined;
    }

    if (language && value['xml:lang'] !== language) {
      return undefined;
    }

    return value.value;
  }

  /**
   * Extract URI from SPARQL binding.
   *
   * @param binding - SPARQL binding
   * @param variable - Variable name
   * @returns URI string or undefined
   *
   * @example
   * ```typescript
   * const itemUri = client.extractUri(binding, 'item');
   * // Returns: 'http://www.wikidata.org/entity/Q5'
   * ```
   */
  extractUri(binding: SparqlBinding, variable: string): string | undefined {
    const value = binding[variable];

    if (value?.type !== 'uri') {
      return undefined;
    }

    return value.value;
  }

  /**
   * Extract Wikidata Q-ID from URI.
   *
   * @param uri - Wikidata entity URI
   * @returns Q-ID or undefined
   *
   * @example
   * ```typescript
   * const qid = client.extractQid('http://www.wikidata.org/entity/Q5');
   * // Returns: 'Q5'
   * ```
   */
  extractQid(uri: string): string | undefined {
    const match = /\/([QP]\d+)$/.exec(uri);
    return match?.[1];
  }

  /**
   * Check if HTTP status code should trigger a retry.
   */
  private shouldRetry(statusCode: number): boolean {
    // Retry on server errors and rate limits
    return statusCode >= 500 || statusCode === 429;
  }

  /**
   * Calculate retry delay with exponential backoff.
   */
  private calculateRetryDelay(retryCount: number): number {
    return this.config.retryDelay * Math.pow(this.config.backoffMultiplier, retryCount);
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
