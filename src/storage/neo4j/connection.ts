import neo4j, { Driver, Session, type QueryResult, ManagedTransaction } from 'neo4j-driver';
import { singleton } from 'tsyringe';

import { DatabaseError, ValidationError } from '../../types/errors.js';

/**
 * Health status for Neo4j connection
 */
export interface HealthStatus {
  healthy: boolean;
  message?: string;
  latency?: number;
}

/**
 * Neo4j connection configuration
 */
export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
  maxConnectionPoolSize?: number;
  connectionAcquisitionTimeout?: number;
  connectionTimeout?: number;
  maxTransactionRetryTime?: number;
}

/**
 * Transaction function type
 */
export type TransactionWork<T> = (tx: ManagedTransaction) => Promise<T>;

/**
 * Neo4j connection manager with connection pooling, retry logic, and health checks.
 *
 * This class manages the Neo4j driver lifecycle including connection pooling,
 * automatic retry with exponential backoff, health monitoring, and graceful shutdown.
 *
 * @example
 * ```typescript
 * const connection = container.resolve(Neo4jConnection);
 * await connection.initialize(config);
 *
 * // Execute a query
 * const result = await connection.executeQuery(
 *   'MATCH (n:Field {uri: $uri}) RETURN n',
 *   { uri: 'at://did:plc:example/pub.chive.graph.field/ml' }
 * );
 *
 * // Execute in transaction
 * const data = await connection.executeTransaction(async (tx) => {
 *   const result = await tx.run('CREATE (n:Field {name: $name}) RETURN n', { name: 'ML' });
 *   return result.records;
 * });
 * ```
 */
@singleton()
export class Neo4jConnection {
  private driver: Driver | null = null;
  private config: Neo4jConfig | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isHealthy = false;

  /**
   * Initialize the Neo4j driver with the provided configuration.
   *
   * Creates a connection pool with automatic retry and health monitoring.
   * Should be called once during application startup.
   *
   * @param config - Neo4j connection configuration
   * @throws {Error} If already initialized or connection fails
   */
  async initialize(config: Neo4jConfig): Promise<void> {
    if (this.driver) {
      throw new ValidationError(
        'Neo4j connection already initialized',
        'driver',
        'already_initialized'
      );
    }

    this.config = config;

    // Create driver with connection pooling
    // disableLosslessIntegers: true makes the driver return native JavaScript numbers
    // instead of Integer objects. This is safe when values are within Number.MAX_SAFE_INTEGER.
    // See: https://neo4j.com/docs/api/javascript-driver/current/class/lib6/types.js~Config.html
    this.driver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
      maxConnectionPoolSize: config.maxConnectionPoolSize ?? 50,
      connectionAcquisitionTimeout: config.connectionAcquisitionTimeout ?? 60000,
      connectionTimeout: config.connectionTimeout ?? 30000,
      maxTransactionRetryTime: config.maxTransactionRetryTime ?? 30000,
      disableLosslessIntegers: true,
    });

    // Verify connectivity
    await this.verifyConnectivity();

    // Start health check monitoring
    this.startHealthCheckMonitoring();
  }

  /**
   * Verify connectivity to Neo4j database.
   *
   * @throws {Error} If connection verification fails
   */
  private async verifyConnectivity(): Promise<void> {
    if (!this.driver) {
      throw new DatabaseError('CONNECT', 'Driver not initialized');
    }

    try {
      await this.driver.verifyConnectivity();
      this.isHealthy = true;
    } catch (err) {
      this.isHealthy = false;
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('CONNECT', `Failed to connect to Neo4j: ${error.message}`, error);
    }
  }

  /**
   * Start health check monitoring with 30-second intervals.
   *
   * Automatically runs health checks in the background to detect
   * connection issues early.
   */
  private startHealthCheckMonitoring(): void {
    // Run health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      void this.healthCheck().catch(() => {
        // Health check failed, will be retried on next interval
        this.isHealthy = false;
      });
    }, 30000);
  }

  /**
   * Get a Neo4j session for executing queries.
   *
   * Sessions should be closed after use. Consider using executeQuery()
   * or executeTransaction() for automatic session management.
   *
   * @param database - Optional database name (defaults to config database)
   * @returns Neo4j session
   * @throws {Error} If driver not initialized
   *
   * @example
   * ```typescript
   * const session = connection.getSession();
   * try {
   *   const result = await session.run('MATCH (n) RETURN count(n) as count');
   *   console.log(result.records[0].get('count'));
   * } finally {
   *   await session.close();
   * }
   * ```
   */
  getSession(database?: string): Session {
    if (!this.driver) {
      throw new DatabaseError('QUERY', 'Neo4j driver not initialized. Call initialize() first.');
    }

    return this.driver.session({
      database: database ?? this.config?.database ?? 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });
  }

  /**
   * Execute a Cypher query with automatic session management and retry logic.
   *
   * The session is automatically closed after query execution.
   * Failed queries are retried up to 3 times with exponential backoff.
   *
   * @param query - Cypher query string
   * @param params - Query parameters (prevents injection)
   * @param database - Optional database name
   * @returns Query results
   * @throws {Error} If query fails after retries
   *
   * @example
   * ```typescript
   * const result = await connection.executeQuery(
   *   'MATCH (f:Field {uri: $uri}) RETURN f',
   *   { uri: 'at://did:plc:example/pub.chive.graph.field/ml' }
   * );
   *
   * const field = result.records[0]?.get('f');
   * ```
   */
  /**
   * Convert numeric parameters to Neo4j integers.
   *
   * Neo4j requires integer values for SKIP and LIMIT clauses.
   * JavaScript numbers may be represented as floats internally.
   *
   * @param params - Query parameters
   * @returns Parameters with numbers converted to Neo4j integers
   */
  private convertNumericParams(params: Record<string, unknown>): Record<string, unknown> {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        // Convert to Neo4j integer for SKIP/LIMIT compatibility
        converted[key] = neo4j.int(Math.floor(value));
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }

  async executeQuery<T extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    params: Record<string, unknown> = {},
    database?: string
  ): Promise<QueryResult<T>> {
    // Convert numeric parameters to Neo4j integers
    const convertedParams = this.convertNumericParams(params);

    return this.executeWithRetry(async () => {
      const session = this.getSession(database);
      try {
        return await session.run<T>(query, convertedParams);
      } finally {
        await session.close();
      }
    });
  }

  /**
   * Execute work within a managed transaction with automatic commit/rollback.
   *
   * Provides ACID guarantees for multiple operations. The transaction
   * is automatically committed on success or rolled back on error.
   *
   * @param work - Transaction function to execute
   * @param database - Optional database name
   * @returns Result from transaction function
   * @throws {Error} If transaction fails after retries
   *
   * @example
   * ```typescript
   * const result = await connection.executeTransaction(async (tx) => {
   *   // Multiple operations in same transaction
   *   await tx.run('CREATE (f:Field {name: $name})', { name: 'ML' });
   *   await tx.run('CREATE (f2:Field {name: $name})', { name: 'AI' });
   *   await tx.run('MATCH (f1:Field {name: "ML"}), (f2:Field {name: "AI"}) CREATE (f1)-[:RELATED_TO]->(f2)');
   *   return 'success';
   * });
   * ```
   */
  async executeTransaction<T>(work: TransactionWork<T>, database?: string): Promise<T> {
    return this.executeWithRetry(async () => {
      const session = this.getSession(database);
      try {
        return await session.executeWrite(work);
      } finally {
        await session.close();
      }
    });
  }

  /**
   * Execute operation with automatic retry and exponential backoff.
   *
   * Retries transient failures up to 3 times with delays of 1s, 2s, 4s.
   * Does not retry on permanent errors (syntax errors, constraint violations).
   *
   * @param operation - Async operation to execute
   * @returns Result from operation
   * @throws {Error} If operation fails after all retries
   */
  private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry permanent errors
        if (this.isPermanentError(lastError)) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new DatabaseError(
      'QUERY',
      `Neo4j operation failed after ${maxRetries} retries: ${lastError?.message}`,
      lastError ?? undefined
    );
  }

  /**
   * Check if error is permanent (should not retry).
   *
   * @param error - Error to check
   * @returns True if error is permanent
   */
  private isPermanentError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Syntax errors
    if (message.includes('syntax error')) return true;

    // Constraint violations
    if (message.includes('constraint') || message.includes('already exists')) {
      return true;
    }

    // Authentication/authorization
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return true;
    }

    return false;
  }

  /**
   * Perform health check on Neo4j connection.
   *
   * Executes a simple query to verify connectivity and measure latency.
   *
   * @returns Health status with connectivity info and latency
   *
   * @example
   * ```typescript
   * const health = await connection.healthCheck();
   * if (health.healthy) {
   *   console.log(`Neo4j healthy (latency: ${health.latency}ms)`);
   * } else {
   *   console.error(`Neo4j unhealthy: ${health.message}`);
   * }
   * ```
   */
  async healthCheck(): Promise<HealthStatus> {
    if (!this.driver) {
      return {
        healthy: false,
        message: 'Driver not initialized',
      };
    }

    try {
      const start = Date.now();
      await this.executeQuery('RETURN 1 as health');
      const latency = Date.now() - start;

      this.isHealthy = true;

      return {
        healthy: true,
        latency,
      };
    } catch (err) {
      this.isHealthy = false;
      const error = err instanceof Error ? err : new Error(String(err));

      return {
        healthy: false,
        message: error.message,
      };
    }
  }

  /**
   * Check if connection is currently healthy.
   *
   * @returns True if last health check succeeded
   */
  isConnectionHealthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Close the Neo4j driver and cleanup resources.
   *
   * Should be called during application shutdown to gracefully
   * close all active connections.
   *
   * @example
   * ```typescript
   * // During app shutdown
   * await connection.close();
   * ```
   */
  async close(): Promise<void> {
    // Stop health check monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close driver
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.isHealthy = false;
    }
  }
}
