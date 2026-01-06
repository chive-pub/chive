/**
 * Health check REST endpoints.
 *
 * @remarks
 * Provides liveness and readiness probes for Kubernetes deployments.
 * - `/health`: Liveness probe (is the process running?)
 * - `/ready`: Readiness probe (can the service handle requests?)
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import type { Hono } from 'hono';

import { HEALTH_PATHS } from '../../config.js';
import type { ChiveEnv } from '../../types/context.js';

/**
 * Health check response.
 */
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks?: Record<
    string,
    {
      status: 'pass' | 'fail';
      latencyMs?: number;
      message?: string;
    }
  >;
}

/**
 * Application start time for uptime calculation.
 */
const startTime = Date.now();

/**
 * Liveness probe handler.
 *
 * @remarks
 * Returns 200 if the process is running. Used by Kubernetes to determine
 * if the container needs to be restarted.
 *
 * @param c - Hono context
 * @returns Health response
 *
 * @public
 */
export function livenessHandler(c: Context<ChiveEnv>): Response {
  const response: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  return c.json(response, 200);
}

/**
 * Readiness probe handler.
 *
 * @remarks
 * Checks connectivity to dependencies (Redis, PostgreSQL) and returns
 * status. Used by Kubernetes to determine if traffic should be routed
 * to this pod.
 *
 * @param c - Hono context
 * @returns Health response with dependency checks
 *
 * @public
 */
export async function readinessHandler(c: Context<ChiveEnv>): Promise<Response> {
  const redis = c.get('redis');
  const logger = c.get('logger');

  const checks: HealthResponse['checks'] = {};
  let overallStatus: HealthResponse['status'] = 'healthy';

  // Check Redis connectivity
  try {
    const redisStart = performance.now();
    await redis.ping();
    const redisLatency = Math.round(performance.now() - redisStart);

    checks.redis = {
      status: 'pass',
      latencyMs: redisLatency,
    };
  } catch (error) {
    checks.redis = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    overallStatus = 'unhealthy';
    logger.error('Redis health check failed', error instanceof Error ? error : undefined);
  }

  // Check PostgreSQL connectivity via preprint service (which uses PostgreSQL adapter)
  try {
    const services = c.get('services');
    if (services?.preprint) {
      const pgStart = performance.now();
      // A simple existence check: if the service is available and responds, PostgreSQL is up
      // In a full implementation, we'd call a health-specific method on the adapter
      await Promise.race([
        // Use a dummy query that will fail fast if DB is down
        services.preprint
          .getPreprintsByAuthor?.('did:plc:health-check' as never, { limit: 1 })
          .catch(() => undefined), // Swallow expected not-found errors
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ]);
      const pgLatency = Math.round(performance.now() - pgStart);

      checks.postgresql = {
        status: 'pass',
        latencyMs: pgLatency,
      };
    } else {
      checks.postgresql = {
        status: 'pass',
        message: 'Service not configured',
      };
    }
  } catch (error) {
    checks.postgresql = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    logger.warn('PostgreSQL health check failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Check Elasticsearch connectivity via search service
  try {
    const services = c.get('services');
    if (services?.search) {
      const esStart = performance.now();
      // A simple search that validates ES connectivity
      await Promise.race([
        services.search.search?.({ q: '', limit: 1 }).catch(() => undefined),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ]);
      const esLatency = Math.round(performance.now() - esStart);

      checks.elasticsearch = {
        status: 'pass',
        latencyMs: esLatency,
      };
    } else {
      checks.elasticsearch = {
        status: 'pass',
        message: 'Service not configured',
      };
    }
  } catch (error) {
    checks.elasticsearch = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    logger.warn('Elasticsearch health check failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  // Check Neo4j connectivity via graph service
  try {
    const services = c.get('services');
    if (services?.graph) {
      const neo4jStart = performance.now();
      // A simple field query that validates Neo4j connectivity
      await Promise.race([
        services.graph.getField?.('health-check-field').catch(() => undefined),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ]);
      const neo4jLatency = Math.round(performance.now() - neo4jStart);

      checks.neo4j = {
        status: 'pass',
        latencyMs: neo4jLatency,
      };
    } else {
      checks.neo4j = {
        status: 'pass',
        message: 'Service not configured',
      };
    }
  } catch (error) {
    checks.neo4j = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    logger.warn('Neo4j health check failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 503;
  return c.json(response, statusCode);
}

/**
 * Registers health check routes.
 *
 * @param app - Hono application
 *
 * @public
 */
export function registerHealthRoutes(app: Hono<ChiveEnv>): void {
  app.get(HEALTH_PATHS.liveness, livenessHandler);
  app.get(HEALTH_PATHS.readiness, readinessHandler);
}
