/**
 * PostgreSQL connection pool lifecycle management.
 *
 * @remarks
 * Manages pg Pool instances for efficient connection pooling. Provides health
 * checking, graceful shutdown, and connection statistics for monitoring.
 *
 * Connection pooling prevents connection exhaustion and improves performance
 * by reusing database connections across requests. Pool size is configured
 * per environment (development vs production).
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { Pool, type PoolConfig } from 'pg';

import type { DatabaseConfig } from './config.js';

/**
 * Connection pool statistics.
 *
 * @remarks
 * Statistics for monitoring pool health and diagnosing connection issues.
 * Expose these metrics to Prometheus for alerting on connection exhaustion
 * or performance degradation.
 *
 * @public
 */
export interface PoolStats {
  /**
   * Total number of connections in pool (idle + active).
   */
  readonly totalConnections: number;

  /**
   * Number of idle connections waiting for use.
   */
  readonly idleConnections: number;

  /**
   * Number of clients waiting for a connection.
   *
   * @remarks
   * Non-zero indicates connection pool exhaustion. Consider increasing
   * pool size or optimizing query performance.
   */
  readonly waitingClients: number;
}

/**
 * Creates PostgreSQL connection pool with configured settings.
 *
 * @param config - Database configuration from getDatabaseConfig()
 * @returns Initialized connection pool
 *
 * @remarks
 * Pool configuration:
 * - **min**: 10 (keep minimum connections warm)
 * - **max**: 50 for direct connections, 25 for PgBouncer
 * - **connectionTimeoutMillis**: 10000 (fail fast on unavailable database)
 * - **idleTimeoutMillis**: 30000 (close idle connections)
 * - **keepAlive**: true (detect stale connections)
 *
 * The pool automatically handles connection failures, retries, and cleanup.
 * Call `closePool()` during graceful shutdown to release connections.
 *
 * @example
 * ```typescript
 * import { getDatabaseConfig } from './config.js';
 * import { createPool, closePool } from './connection.js';
 *
 * const config = getDatabaseConfig();
 * const pool = createPool(config);
 *
 * // Use pool for queries
 * const result = await pool.query('SELECT * FROM eprint_index LIMIT 10');
 * console.log(result.rows);
 *
 * // Graceful shutdown
 * process.on('SIGTERM', async () => {
 *   await closePool(pool);
 *   process.exit(0);
 * });
 * ```
 *
 * @see {@link closePool}
 * @public
 * @since 0.1.0
 */
export function createPool(config: DatabaseConfig): Pool {
  const poolConfig: PoolConfig = {
    ...config,
    min: 10,
    max: config.max ?? 50,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 10000,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    // Enable TCP keepalive to detect broken connections
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };

  const pool = new Pool(poolConfig);

  // Log unexpected errors (e.g., connection drop)
  pool.on('error', (err: Error) => {
    console.error('Unexpected database error on idle client', {
      error: err.message,
      stack: err.stack,
    });
  });

  return pool;
}

/**
 * Checks if database connection is healthy.
 *
 * @param pool - Connection pool to check
 * @returns True if database is reachable, false otherwise
 *
 * @remarks
 * Executes simple query (`SELECT 1`) to verify database connectivity.
 * Returns false on error instead of throwing to support graceful degradation
 * and health check endpoints.
 *
 * Use this for:
 * - Kubernetes readiness probes
 * - Health check endpoints (/health)
 * - Pre-deployment verification
 * - Circuit breaker state checks
 *
 * @example
 * ```typescript
 * import { healthCheck } from './connection.js';
 *
 * // Kubernetes readiness probe
 * app.get('/health/ready', async (req, res) => {
 *   const healthy = await healthCheck(pool);
 *   if (healthy) {
 *     res.status(200).json({ status: 'ready' });
 *   } else {
 *     res.status(503).json({ status: 'unavailable' });
 *   }
 * });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export async function healthCheck(pool: Pool): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Retrieves connection pool statistics.
 *
 * @param pool - Connection pool
 * @returns Current pool statistics
 *
 * @remarks
 * Statistics include total connections, idle connections, and waiting clients.
 * Expose these to monitoring systems (Prometheus, Datadog) for alerting.
 *
 * **Alerts to configure:**
 * - `waitingClients > 0` for >30s → pool exhaustion
 * - `idleConnections = 0` for >1m → connection leak
 * - `totalConnections > max * 0.9` → approaching limit
 *
 * @example
 * ```typescript
 * import { getPoolStats } from './connection.js';
 * import { register as prometheusRegister } from 'prom-client';
 *
 * // Expose metrics to Prometheus
 * setInterval(() => {
 *   const stats = getPoolStats(pool);
 *   postgresPoolSizeGauge.set(stats.totalConnections);
 *   postgresPoolIdleGauge.set(stats.idleConnections);
 *   postgresPoolWaitingGauge.set(stats.waitingClients);
 * }, 5000);
 * ```
 *
 * @public
 * @since 0.1.0
 */
export function getPoolStats(pool: Pool): PoolStats {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  };
}

/**
 * Closes connection pool gracefully.
 *
 * @param pool - Connection pool to close
 *
 * @remarks
 * Waits for all active queries to complete before closing connections.
 * Call this during graceful shutdown (SIGTERM) to prevent connection leaks
 * and ensure data consistency.
 *
 * **Shutdown sequence:**
 * 1. Stop accepting new requests (close HTTP server)
 * 2. Wait for in-flight requests to complete
 * 3. Close database pool (this function)
 * 4. Exit process
 *
 * @example
 * ```typescript
 * import { closePool } from './connection.js';
 *
 * // Graceful shutdown on SIGTERM
 * process.on('SIGTERM', async () => {
 *   console.log('SIGTERM received, closing connections...');
 *
 *   // Close HTTP server first
 *   await server.close();
 *
 *   // Close database pool
 *   await closePool(pool);
 *
 *   console.log('Graceful shutdown complete');
 *   process.exit(0);
 * });
 * ```
 *
 * @see {@link createPool}
 * @public
 * @since 0.1.0
 */
export async function closePool(pool: Pool): Promise<void> {
  await pool.end();
}
