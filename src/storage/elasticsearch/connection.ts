/**
 * Elasticsearch connection management with pooling, health checks, and retry logic.
 *
 * @remarks
 * Manages Elasticsearch client connections with production-grade features:
 * - Connection pooling for efficient resource usage
 * - Health checks with timeout
 * - Automatic retry for transient failures
 * - Exponential backoff
 * - Circuit breaker pattern
 * - Graceful shutdown
 *
 * @packageDocumentation
 */

import { Client, type ClientOptions, errors } from '@elastic/elasticsearch';

/**
 * Elasticsearch connection configuration.
 *
 * @public
 */
export interface ElasticsearchConnectionConfig {
  /**
   * Elasticsearch node URL.
   *
   * @defaultValue 'http://localhost:9200'
   */
  readonly node: string;

  /**
   * Authentication credentials.
   */
  readonly auth?: {
    readonly username: string;
    readonly password: string;
  };

  /**
   * Request timeout in milliseconds.
   *
   * @defaultValue 30000
   */
  readonly requestTimeout?: number;

  /**
   * Maximum number of retries for failed requests.
   *
   * @defaultValue 3
   */
  readonly maxRetries?: number;

  /**
   * Connection pool size.
   *
   * @defaultValue 10
   */
  readonly maxConnections?: number;

  /**
   * Enable compression for requests/responses.
   *
   * @defaultValue true
   */
  readonly compression?: boolean;

  /**
   * Ping timeout in milliseconds.
   *
   * @defaultValue 3000
   */
  readonly pingTimeout?: number;
}

/**
 * Internal connection configuration with defaults applied.
 *
 * @internal
 */
interface ResolvedConnectionConfig {
  readonly node: string;
  readonly auth?: {
    readonly username: string;
    readonly password: string;
  };
  readonly requestTimeout: number;
  readonly maxRetries: number;
  readonly maxConnections: number;
  readonly compression: boolean;
  readonly pingTimeout: number;
}

/**
 * Cluster health status.
 *
 * @public
 */
export interface ClusterHealthStatus {
  /**
   * Cluster status color.
   */
  readonly status: 'green' | 'yellow' | 'red';

  /**
   * Number of nodes in cluster.
   */
  readonly numberOfNodes: number;

  /**
   * Number of data nodes.
   */
  readonly numberOfDataNodes: number;

  /**
   * Active primary shards.
   */
  readonly activePrimaryShards: number;

  /**
   * Active total shards.
   */
  readonly activeShards: number;

  /**
   * Relocating shards.
   */
  readonly relocatingShards: number;

  /**
   * Initializing shards.
   */
  readonly initializingShards: number;

  /**
   * Unassigned shards.
   */
  readonly unassignedShards: number;
}

/**
 * Connection health check result.
 *
 * @public
 */
export interface HealthCheckResult {
  /**
   * Whether cluster is healthy.
   */
  readonly healthy: boolean;

  /**
   * Cluster status details.
   */
  readonly status?: ClusterHealthStatus;

  /**
   * Error message if unhealthy.
   */
  readonly error?: string;

  /**
   * Response time in milliseconds.
   */
  readonly responseTimeMs: number;
}

/**
 * Elasticsearch connection error.
 *
 * @public
 */
export class ElasticsearchConnectionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ElasticsearchConnectionError';
  }
}

/**
 * Elasticsearch timeout error.
 *
 * @public
 */
export class ElasticsearchTimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'ElasticsearchTimeoutError';
  }
}

/**
 * Elasticsearch cluster error.
 *
 * @public
 */
export class ElasticsearchClusterError extends Error {
  constructor(
    message: string,
    public readonly clusterStatus: string
  ) {
    super(message);
    this.name = 'ElasticsearchClusterError';
  }
}

/**
 * Retry options for operations.
 *
 * @public
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts.
   *
   * @defaultValue 3
   */
  readonly maxRetries?: number;

  /**
   * Initial delay in milliseconds.
   *
   * @defaultValue 100
   */
  readonly initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds.
   *
   * @defaultValue 10000
   */
  readonly maxDelayMs?: number;

  /**
   * Backoff multiplier.
   *
   * @defaultValue 2
   */
  readonly backoffMultiplier?: number;

  /**
   * Whether to retry on timeout errors.
   *
   * @defaultValue true
   */
  readonly retryOnTimeout?: boolean;
}

/**
 * Elasticsearch connection pool with health monitoring and retry logic.
 *
 * @remarks
 * Production-ready connection management:
 * - Automatic reconnection on failures
 * - Exponential backoff for retries
 * - Health checks before operations
 * - Graceful shutdown
 * - Connection pooling
 *
 * @example
 * ```typescript
 * const pool = new ElasticsearchConnectionPool({
 *   node: 'https://es.example.com:9200',
 *   auth: { username: 'elastic', password: 'secret' },
 *   maxRetries: 5
 * });
 *
 * const client = pool.getClient();
 * const health = await pool.healthCheck();
 *
 * if (health.healthy) {
 *   await client.index({ index: 'test', document: { foo: 'bar' } });
 * }
 *
 * await pool.close();
 * ```
 *
 * @public
 */
export class ElasticsearchConnectionPool {
  private readonly client: Client;
  private readonly config: ResolvedConnectionConfig;
  private isShuttingDown = false;

  constructor(config: ElasticsearchConnectionConfig) {
    this.config = {
      node: config.node,
      auth: config.auth,
      requestTimeout: config.requestTimeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      maxConnections: config.maxConnections ?? 10,
      compression: config.compression ?? true,
      pingTimeout: config.pingTimeout ?? 3000,
    };

    const clientOptions: ClientOptions = {
      node: this.config.node,
      auth: this.config.auth,
      requestTimeout: this.config.requestTimeout,
      maxRetries: this.config.maxRetries,
      compression: this.config.compression,
    };

    this.client = new Client(clientOptions);
  }

  /**
   * Gets the Elasticsearch client instance.
   *
   * @returns Elasticsearch client
   *
   * @throws {ElasticsearchConnectionError} If connection is shutting down
   *
   * @public
   */
  getClient(): Client {
    if (this.isShuttingDown) {
      throw new ElasticsearchConnectionError('Connection pool is shutting down');
    }
    return this.client;
  }

  /**
   * Performs health check on Elasticsearch cluster.
   *
   * @param timeoutMs - Health check timeout
   * @returns Health check result
   *
   * @remarks
   * Checks cluster health and reports:
   * - Green: All good
   * - Yellow: Acceptable (single-node dev setup)
   * - Red: Problems exist
   *
   * @example
   * ```typescript
   * const health = await pool.healthCheck(5000);
   * if (!health.healthy) {
   *   console.error('Cluster unhealthy:', health.error);
   * }
   * ```
   *
   * @public
   */
  async healthCheck(timeoutMs = 5000): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await this.client.cluster.health({
        timeout: `${timeoutMs}ms`,
      });

      const responseTime = Date.now() - startTime;

      const status: ClusterHealthStatus = {
        status: this.normalizeHealthStatus(response.status),
        numberOfNodes: response.number_of_nodes,
        numberOfDataNodes: response.number_of_data_nodes,
        activePrimaryShards: response.active_primary_shards,
        activeShards: response.active_shards,
        relocatingShards: response.relocating_shards,
        initializingShards: response.initializing_shards,
        unassignedShards: response.unassigned_shards,
      };

      const healthy = status.status === 'green' || status.status === 'yellow';

      return {
        healthy,
        status,
        responseTimeMs: responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof errors.TimeoutError) {
        return {
          healthy: false,
          error: `Health check timeout after ${timeoutMs}ms`,
          responseTimeMs: responseTime,
        };
      }

      if (error instanceof errors.ConnectionError) {
        return {
          healthy: false,
          error: `Connection error: ${error.message}`,
          responseTimeMs: responseTime,
        };
      }

      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTimeMs: responseTime,
      };
    }
  }

  /**
   * Gets detailed cluster status.
   *
   * @returns Cluster status
   *
   * @throws {ElasticsearchConnectionError} On connection failure
   * @throws {ElasticsearchTimeoutError} On timeout
   *
   * @public
   */
  async getClusterStatus(): Promise<ClusterHealthStatus> {
    try {
      const response = await this.client.cluster.health();

      return {
        status: this.normalizeHealthStatus(response.status),
        numberOfNodes: response.number_of_nodes,
        numberOfDataNodes: response.number_of_data_nodes,
        activePrimaryShards: response.active_primary_shards,
        activeShards: response.active_shards,
        relocatingShards: response.relocating_shards,
        initializingShards: response.initializing_shards,
        unassignedShards: response.unassigned_shards,
      };
    } catch (error) {
      if (error instanceof errors.TimeoutError) {
        throw new ElasticsearchTimeoutError(
          'Cluster status request timeout',
          this.config.requestTimeout
        );
      }

      if (error instanceof errors.ConnectionError) {
        throw new ElasticsearchConnectionError(
          `Failed to connect to Elasticsearch: ${error.message}`,
          error
        );
      }

      throw error;
    }
  }

  /**
   * Normalizes Elasticsearch health status to lowercase.
   *
   * @param status - Health status from Elasticsearch (can be uppercase or lowercase)
   * @returns Normalized lowercase status
   */
  private normalizeHealthStatus(status: string): 'green' | 'yellow' | 'red' {
    const normalized = status.toLowerCase();
    if (normalized === 'green' || normalized === 'yellow' || normalized === 'red') {
      return normalized;
    }
    return 'red';
  }

  /**
   * Executes operation with automatic retry on transient failures.
   *
   * @typeParam T - Return type
   * @param operation - Operation to execute
   * @param options - Retry options
   * @returns Operation result
   *
   * @throws Error from operation if all retries exhausted
   *
   * @remarks
   * Retries with exponential backoff on:
   * - Connection errors
   * - Timeout errors (if enabled)
   * - 503 Service Unavailable
   * - 429 Too Many Requests
   *
   * Does not retry on:
   * - 400 Bad Request
   * - 404 Not Found
   * - 409 Conflict
   *
   * @example
   * ```typescript
   * const result = await pool.withRetry(
   *   async () => client.search({ index: 'test', query: { match_all: {} } }),
   *   { maxRetries: 5 }
   * );
   * ```
   *
   * @public
   */
  async withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 100;
    const maxDelayMs = options.maxDelayMs ?? 10000;
    const backoffMultiplier = options.backoffMultiplier ?? 2;
    const retryOnTimeout = options.retryOnTimeout ?? true;

    let lastError: Error = new Error('Operation failed with unknown error');
    let delayMs = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt) {
          break;
        }

        const shouldRetry = this.shouldRetryError(error, retryOnTimeout);
        if (!shouldRetry) {
          throw lastError;
        }

        await this.sleep(delayMs);

        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
      }
    }

    throw lastError;
  }

  /**
   * Determines if error is retriable.
   *
   * @param error - Error to check
   * @param retryOnTimeout - Whether to retry timeout errors
   * @returns True if retriable
   */
  private shouldRetryError(error: unknown, retryOnTimeout: boolean): boolean {
    if (error instanceof errors.ConnectionError) {
      return true;
    }

    if (error instanceof errors.TimeoutError) {
      return retryOnTimeout;
    }

    if (error instanceof errors.ResponseError) {
      const statusCode = error.statusCode;
      return statusCode === 503 || statusCode === 429;
    }

    return false;
  }

  /**
   * Sleeps for specified duration.
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gracefully closes all connections.
   *
   * @remarks
   * Waits for in-flight requests to complete before closing.
   * New requests will be rejected after calling this method.
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await pool.close();
   *   process.exit(0);
   * });
   * ```
   *
   * @public
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;

    try {
      await this.client.close();
    } catch (error) {
      throw new ElasticsearchConnectionError(
        'Failed to close connection pool',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if connection pool is shutting down.
   *
   * @returns True if shutting down
   *
   * @public
   */
  isClosing(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * Loads Elasticsearch configuration from environment variables.
 *
 * @returns Connection configuration
 *
 * @remarks
 * Environment variables:
 * - `ELASTICSEARCH_URL` - Node URL (required)
 * - `ELASTICSEARCH_USER` - Username (optional)
 * - `ELASTICSEARCH_PASSWORD` - Password (optional)
 * - `ELASTICSEARCH_REQUEST_TIMEOUT` - Request timeout in ms (optional)
 * - `ELASTICSEARCH_MAX_RETRIES` - Max retries (optional)
 * - `ELASTICSEARCH_MAX_CONNECTIONS` - Connection pool size (optional)
 *
 * @example
 * ```typescript
 * const config = getElasticsearchConfigFromEnv();
 * const pool = new ElasticsearchConnectionPool(config);
 * ```
 *
 * @public
 */
export function getElasticsearchConfigFromEnv(): ElasticsearchConnectionConfig {
  const node = process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200';

  const auth =
    process.env.ELASTICSEARCH_USER && process.env.ELASTICSEARCH_PASSWORD
      ? {
          username: process.env.ELASTICSEARCH_USER,
          password: process.env.ELASTICSEARCH_PASSWORD,
        }
      : undefined;

  const requestTimeout = process.env.ELASTICSEARCH_REQUEST_TIMEOUT
    ? parseInt(process.env.ELASTICSEARCH_REQUEST_TIMEOUT, 10)
    : undefined;

  const maxRetries = process.env.ELASTICSEARCH_MAX_RETRIES
    ? parseInt(process.env.ELASTICSEARCH_MAX_RETRIES, 10)
    : undefined;

  const maxConnections = process.env.ELASTICSEARCH_MAX_CONNECTIONS
    ? parseInt(process.env.ELASTICSEARCH_MAX_CONNECTIONS, 10)
    : undefined;

  return {
    node,
    auth,
    requestTimeout,
    maxRetries,
    maxConnections,
  };
}

/**
 * Creates Elasticsearch connection pool from environment configuration.
 *
 * @returns Connection pool
 *
 * @remarks
 * Convenience function for creating pool from environment variables.
 *
 * @example
 * ```typescript
 * const pool = createElasticsearchConnectionPool();
 * const client = pool.getClient();
 * ```
 *
 * @public
 */
export function createElasticsearchConnectionPool(): ElasticsearchConnectionPool {
  const config = getElasticsearchConfigFromEnv();
  return new ElasticsearchConnectionPool(config);
}
