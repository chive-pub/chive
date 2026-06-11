/**
 * HTTP health endpoint and liveness watchdog for the firehose indexer.
 *
 * @remarks
 * The indexer process otherwise runs no HTTP server, so a wedged firehose
 * consumer was previously invisible: the container's healthcheck was a no-op
 * and Docker reported "healthy" while ingestion had been dead for weeks.
 *
 * This module closes that gap on two fronts:
 *
 * - **Detection** — exposes `GET /health`, returning `200` while every relay
 *   consumer is connected (or only briefly disconnected) and `503` once a relay
 *   has been disconnected longer than {@link FirehoseHealthServerOptions.unhealthyAfterMs}.
 *   The container healthcheck polls this endpoint.
 * - **Recovery** — a watchdog re-evaluates liveness on an interval. The
 *   consumer reconnects itself with backoff, but if a relay stays unhealthy
 *   past {@link FirehoseHealthServerOptions.restartAfterMs} the watchdog invokes
 *   `onUnrecoverable` (a process restart via the container's restart policy) as
 *   a last resort.
 *
 * @packageDocumentation
 * @public
 */

import http from 'node:http';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type { IndexingHealth, IndexingService } from './indexing-service.js';

/**
 * Configuration for {@link startFirehoseHealthServer}.
 *
 * @public
 */
export interface FirehoseHealthServerOptions {
  /**
   * Indexing service whose liveness is reported.
   */
  readonly indexingService: IndexingService;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * TCP port for the health endpoint.
   */
  readonly port: number;

  /**
   * How long a relay may stay disconnected before it is reported unhealthy.
   *
   * @remarks
   * Tolerates the brief disconnects of normal backoff reconnection without
   * flapping the healthcheck.
   *
   * @defaultValue 300000 (5 minutes)
   */
  readonly unhealthyAfterMs?: number;

  /**
   * How long the firehose may stay continuously unhealthy before the watchdog
   * triggers recovery via {@link FirehoseHealthServerOptions.onUnrecoverable}.
   *
   * @defaultValue 900000 (15 minutes)
   */
  readonly restartAfterMs?: number;

  /**
   * Watchdog evaluation interval.
   *
   * @defaultValue 30000 (30 seconds)
   */
  readonly checkIntervalMs?: number;

  /**
   * Invoked when the firehose has been unhealthy past
   * {@link FirehoseHealthServerOptions.restartAfterMs}.
   *
   * @remarks
   * Defaults to exiting the process with a non-zero code so the container
   * restart policy brings up a fresh consumer. Injectable for tests and to
   * route recovery through a graceful shutdown.
   */
  readonly onUnrecoverable?: () => void;
}

/**
 * Handle for stopping the health server and watchdog.
 *
 * @public
 */
export interface FirehoseHealthServer {
  /**
   * Stops the watchdog and closes the HTTP server.
   */
  close(): Promise<void>;
}

/**
 * Result of a liveness evaluation.
 *
 * @public
 */
export interface FirehoseHealthEvaluation {
  /**
   * Whether the firehose is considered healthy.
   */
  readonly healthy: boolean;

  /**
   * Human-readable reason when unhealthy.
   */
  readonly reason?: string;
}

/**
 * Pure liveness decision used by both the HTTP endpoint and the watchdog.
 *
 * @param health - Snapshot from {@link IndexingService.getHealth}
 * @param unhealthyAfterMs - Disconnect tolerance window
 * @param now - Current epoch milliseconds
 * @returns Whether the firehose is healthy, with a reason when not
 *
 * @public
 */
export function evaluateFirehoseHealth(
  health: IndexingHealth,
  unhealthyAfterMs: number,
  now: number
): FirehoseHealthEvaluation {
  if (!health.running) {
    return { healthy: false, reason: 'indexing service not running' };
  }

  if (health.relays.length === 0) {
    return { healthy: false, reason: 'no relays configured' };
  }

  for (const relay of health.relays) {
    if (relay.connected) {
      continue;
    }

    // Tolerate brief disconnects while the consumer reconnects with backoff.
    if (relay.lastConnectedAt !== null && now - relay.lastConnectedAt < unhealthyAfterMs) {
      continue;
    }

    const detail =
      relay.lastConnectedAt === null
        ? 'never connected'
        : `disconnected for ${Math.round((now - relay.lastConnectedAt) / 1000)}s`;
    return { healthy: false, reason: `relay ${relay.relay} ${detail}` };
  }

  return { healthy: true };
}

/**
 * Starts the firehose health endpoint and liveness watchdog.
 *
 * @param options - Server configuration
 * @returns Handle for stopping the server and watchdog
 *
 * @example
 * ```typescript
 * const health = startFirehoseHealthServer({
 *   indexingService,
 *   logger,
 *   port: 3001,
 *   onUnrecoverable: () => void shutdown(state, 'firehose-watchdog'),
 * });
 * ```
 *
 * @public
 */
export function startFirehoseHealthServer(
  options: FirehoseHealthServerOptions
): FirehoseHealthServer {
  const unhealthyAfterMs = options.unhealthyAfterMs ?? 300_000;
  const restartAfterMs = options.restartAfterMs ?? 900_000;
  const checkIntervalMs = options.checkIntervalMs ?? 30_000;
  const onUnrecoverable =
    options.onUnrecoverable ??
    ((): void => {
      process.exit(1);
    });

  let unhealthySince: number | null = null;
  let recovering = false;

  const server = http.createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (req.method === 'GET' && (path === '/health' || path === '/healthz')) {
      const health = options.indexingService.getHealth();
      const evaluation = evaluateFirehoseHealth(health, unhealthyAfterMs, Date.now());
      const body = JSON.stringify({
        status: evaluation.healthy ? 'ok' : 'unhealthy',
        reason: evaluation.reason,
        running: health.running,
        relays: health.relays,
      });
      res.writeHead(evaluation.healthy ? 200 : 503, { 'content-type': 'application/json' });
      res.end(body);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":"not found"}');
  });

  server.on('error', (error: Error) => {
    options.logger.error('Firehose health server error', error);
  });

  server.listen(options.port, () => {
    options.logger.info('Firehose health server listening', { port: options.port });
  });

  const watchdog = setInterval(() => {
    const now = Date.now();
    const health = options.indexingService.getHealth();
    const evaluation = evaluateFirehoseHealth(health, unhealthyAfterMs, now);

    if (evaluation.healthy) {
      unhealthySince = null;
      return;
    }

    if (unhealthySince === null) {
      unhealthySince = now;
      options.logger.warn('Firehose unhealthy; reconnection in progress', {
        reason: evaluation.reason,
      });
      return;
    }

    const unhealthyMs = now - unhealthySince;
    if (unhealthyMs >= restartAfterMs && !recovering) {
      recovering = true;
      options.logger.error(
        'Firehose unhealthy past recovery threshold; restarting process',
        new Error(evaluation.reason ?? 'firehose unhealthy'),
        { unhealthyMs, restartAfterMs }
      );
      onUnrecoverable();
      return;
    }

    options.logger.warn('Firehose still unhealthy', {
      reason: evaluation.reason,
      unhealthyMs,
    });
  }, checkIntervalMs);

  // The watchdog must not by itself keep the process alive.
  watchdog.unref?.();

  return {
    async close(): Promise<void> {
      clearInterval(watchdog);
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
