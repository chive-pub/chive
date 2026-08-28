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

import type { AtUri, DID } from '../../../types/atproto.js';
import { getAppVersion } from '../../../utils/app-version.js';
import { HEALTH_PATHS } from '../../config.js';
import type { ChiveEnv } from '../../types/context.js';

/**
 * DID used for health check queries.
 *
 * @remarks
 * This is a synthetic DID used only for testing database connectivity.
 * Queries with this DID are expected to return no results.
 */
const HEALTH_CHECK_DID = 'did:plc:health-check' as DID;

/**
 * Node URI used for Neo4j connectivity checks.
 *
 * @remarks
 * Synthetic URI that is never expected to match a node; the probe exists only
 * to force a round trip to Neo4j.
 */
const HEALTH_CHECK_NODE_URI = 'health-check-field' as AtUri;

/**
 * Timeout applied to each dependency probe in the readiness check.
 */
const DEPENDENCY_CHECK_TIMEOUT_MS = 5000;

/**
 * Settlement of a dependency probe, captured without discarding a rejection.
 */
type ProbeOutcome = { ok: true } | { ok: false; error: unknown };

/**
 * Runs a dependency probe under a timeout and surfaces its failure to the caller.
 *
 * @param probe - In-flight probe, or `undefined` when the injected service does not
 *   expose the probe method (partial test doubles)
 * @returns Resolves once the probe succeeds within {@link DEPENDENCY_CHECK_TIMEOUT_MS}
 * @throws The probe's rejection reason, or `Error('Timeout')` when it does not settle in time
 *
 * @remarks
 * The probe's settlement is captured with a `then(onFulfilled, onRejected)` pair
 * before the race rather than a `.catch(() => undefined)` applied to the racer. A
 * discarded rejection made a dependency that refuses connections outright — which
 * rejects fast, well inside the timeout — resolve to `undefined` and get recorded
 * as a passing check, so `/ready` answered 200 while PostgreSQL, Elasticsearch or
 * Neo4j was down and Kubernetes kept routing traffic to the pod. Only a hang past
 * the timeout could trip the old race.
 *
 * Capturing rather than discarding also keeps the timeout path free of unhandled
 * rejections when a probe rejects after losing the race.
 */
async function runDependencyProbe(probe: Promise<unknown> | undefined): Promise<void> {
  if (probe === undefined) {
    return;
  }

  const settled: Promise<ProbeOutcome> = probe.then(
    (): ProbeOutcome => ({ ok: true }),
    (error: unknown): ProbeOutcome => ({ ok: false, error })
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    settled,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timeout')), DEPENDENCY_CHECK_TIMEOUT_MS);
    }),
  ]).finally(() => {
    // Release the timer so a fast probe does not hold the event loop for 5s.
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });

  if (!outcome.ok) {
    throw outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error));
  }
}

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
 * The only failure detail `/ready` reports.
 *
 * @remarks
 * The checks used to return `error.message` verbatim. A driver's message names
 * what it could not reach — a connection string with a username, a host and
 * port, an index name — and `/ready` is unauthenticated, rate-limit exempt, and
 * reachable from the internet, so anyone could read Chive's internal topology
 * by taking a datastore down or simply asking during an incident.
 *
 * The operator's copy is not lost: every branch already logs the real error
 * with its stack, where it belongs.
 */
const CHECK_FAILED_MESSAGE = 'Check failed';

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
    version: getAppVersion(),
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
      message: CHECK_FAILED_MESSAGE,
    };
    overallStatus = 'unhealthy';
    logger.error('Redis health check failed', error instanceof Error ? error : undefined);
  }

  // Check PostgreSQL connectivity vian eprint service (which uses PostgreSQL adapter)
  try {
    const services = c.get('services');
    if (services?.eprint) {
      const pgStart = performance.now();
      // A simple existence check: if the service is available and responds, PostgreSQL is up.
      // An unknown author yields an empty list rather than an error, so any rejection here
      // means the database itself is unreachable and must fail the check.
      await runDependencyProbe(
        services.eprint.getEprintsByAuthor?.(HEALTH_CHECK_DID, { limit: 1 })
      );
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
      message: CHECK_FAILED_MESSAGE,
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
      await runDependencyProbe(services.search.search?.({ q: '', limit: 1 }));
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
      message: CHECK_FAILED_MESSAGE,
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
      // A simple node lookup that validates Neo4j connectivity. The probe goes through
      // NodeRepository rather than KnowledgeGraphService because the latter's getNode
      // catches its own driver errors and returns null, which would report a healthy
      // Neo4j no matter what. Fall back to the service only when the repository is
      // absent (partial test doubles).
      await runDependencyProbe(
        services.nodeRepository?.getNode?.(HEALTH_CHECK_NODE_URI) ??
          services.graph.getNode?.(HEALTH_CHECK_NODE_URI)
      );
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
      message: CHECK_FAILED_MESSAGE,
    };
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    logger.warn('Neo4j health check failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: getAppVersion(),
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
