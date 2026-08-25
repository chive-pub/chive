/**
 * Tests for the liveness and readiness probe handlers.
 *
 * @remarks
 * The readiness probe gates Kubernetes traffic and deploy verification, so these
 * tests pin down both halves of its contract: a dependency that rejects (fast or
 * slow) must be recorded as a failing check, and the response shape — the `checks`
 * map, the healthy/degraded/unhealthy status and the 200/503 split — must not drift.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import type { Redis } from 'ioredis';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { registerHealthRoutes } from '@/api/handlers/rest/health.js';
import type { ChiveEnv, ChiveServices } from '@/api/types/context.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// HELPERS
// =============================================================================

interface HealthBody {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks?: Record<string, { status: 'pass' | 'fail'; latencyMs?: number; message?: string }>;
}

type Probe = () => Promise<unknown>;

interface AppOptions {
  redisPing?: Probe;
  eprintProbe?: Probe;
  searchProbe?: Probe;
  nodeProbe?: Probe;
  /** Replaces the whole services container (used for the "not configured" cases). */
  services?: Partial<ChiveServices>;
}

function createLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  } as unknown as ILogger;
}

function buildApp(options: AppOptions = {}): { app: Hono<ChiveEnv>; logger: ILogger } {
  const logger = createLogger();

  const services = (options.services ?? {
    eprint: {
      getEprintsByAuthor: options.eprintProbe ?? ((): Promise<unknown> => Promise.resolve([])),
    },
    search: {
      search: options.searchProbe ?? ((): Promise<unknown> => Promise.resolve({ hits: [] })),
    },
    graph: { getNode: (): Promise<unknown> => Promise.resolve(null) },
    nodeRepository: {
      getNode: options.nodeProbe ?? ((): Promise<unknown> => Promise.resolve(null)),
    },
  }) as unknown as ChiveServices;

  const redis = {
    ping: options.redisPing ?? ((): Promise<unknown> => Promise.resolve('PONG')),
  } as unknown as Redis;

  const app = new Hono<ChiveEnv>();
  app.use('*', async (c, next) => {
    c.set('services', services);
    c.set('redis', redis);
    c.set('logger', logger);
    await next();
  });
  registerHealthRoutes(app);

  return { app, logger };
}

async function readBody(res: Response): Promise<HealthBody> {
  return (await res.json()) as HealthBody;
}

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// TESTS
// =============================================================================

describe('livenessHandler', () => {
  it('returns 200 and healthy while the process is running', async () => {
    const { app } = buildApp();

    const res = await app.request('/health');
    const body = await readBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks).toBeUndefined();
  });
});

describe('readinessHandler', () => {
  it('returns 200 with every dependency passing when all probes resolve', async () => {
    const { app } = buildApp();

    const res = await app.request('/ready');
    const body = await readBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks?.redis?.status).toBe('pass');
    expect(body.checks?.postgresql?.status).toBe('pass');
    expect(body.checks?.elasticsearch?.status).toBe('pass');
    expect(body.checks?.neo4j?.status).toBe('pass');
  });

  it('fails the PostgreSQL check when the probe rejects immediately', async () => {
    const { app, logger } = buildApp({
      eprintProbe: () => Promise.reject(new Error('ECONNREFUSED 127.0.0.1:5432')),
    });

    const res = await app.request('/ready');
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks?.postgresql).toMatchObject({
      status: 'fail',
      message: 'ECONNREFUSED 127.0.0.1:5432',
    });
    expect(body.checks?.redis?.status).toBe('pass');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('fails the Elasticsearch check when the probe rejects immediately', async () => {
    const { app } = buildApp({
      searchProbe: () => Promise.reject(new Error('connect ECONNREFUSED 9200')),
    });

    const res = await app.request('/ready');
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks?.elasticsearch).toMatchObject({
      status: 'fail',
      message: 'connect ECONNREFUSED 9200',
    });
  });

  it('fails the Neo4j check when the probe rejects immediately', async () => {
    const { app } = buildApp({
      nodeProbe: () => Promise.reject(new Error('ServiceUnavailable: bolt://neo4j:7687')),
    });

    const res = await app.request('/ready');
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks?.neo4j).toMatchObject({
      status: 'fail',
      message: 'ServiceUnavailable: bolt://neo4j:7687',
    });
  });

  it('reports unhealthy when Redis fails, outranking a degraded dependency', async () => {
    const { app, logger } = buildApp({
      redisPing: () => Promise.reject(new Error('Redis down')),
      eprintProbe: () => Promise.reject(new Error('PostgreSQL down')),
    });

    const res = await app.request('/ready');
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks?.redis).toMatchObject({ status: 'fail', message: 'Redis down' });
    expect(body.checks?.postgresql?.status).toBe('fail');
    expect(logger.error).toHaveBeenCalled();
  });

  it('normalizes a non-Error rejection into a failing check', async () => {
    const { app } = buildApp({
      // Deliberately not an Error: drivers occasionally reject with a bare string,
      // and the check must still report it rather than pass.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      eprintProbe: () => Promise.reject('pool exhausted'),
    });

    const res = await app.request('/ready');
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.checks?.postgresql).toMatchObject({
      status: 'fail',
      message: 'pool exhausted',
    });
  });

  it('fails the check with a timeout when a probe hangs past 5 seconds', async () => {
    vi.useFakeTimers();
    // A probe that never settles: only the timeout can decide this check.
    const { app } = buildApp({ eprintProbe: () => new Promise(() => {}) });

    const pending = app.request('/ready');
    await vi.advanceTimersByTimeAsync(5000);
    const res = await pending;
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks?.postgresql).toMatchObject({ status: 'fail', message: 'Timeout' });
  });

  it('does not time out a probe that settles before the deadline', async () => {
    vi.useFakeTimers();
    const { app } = buildApp({
      eprintProbe: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([]), 4000);
        }),
    });

    const pending = app.request('/ready');
    await vi.advanceTimersByTimeAsync(4000);
    const res = await pending;
    const body = await readBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks?.postgresql?.status).toBe('pass');
  });

  it('records unconfigured services as passing without probing', async () => {
    const { app } = buildApp({ services: {} });

    const res = await app.request('/ready');
    const body = await readBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks?.postgresql).toMatchObject({
      status: 'pass',
      message: 'Service not configured',
    });
    expect(body.checks?.elasticsearch).toMatchObject({
      status: 'pass',
      message: 'Service not configured',
    });
    expect(body.checks?.neo4j).toMatchObject({
      status: 'pass',
      message: 'Service not configured',
    });
  });

  it('falls back to the graph service when no node repository is injected', async () => {
    const { app } = buildApp({
      services: {
        graph: {
          getNode: () => Promise.reject(new Error('graph probe failed')),
        },
      } as unknown as Partial<ChiveServices>,
    });

    const res = await app.request('/ready');
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.checks?.neo4j).toMatchObject({
      status: 'fail',
      message: 'graph probe failed',
    });
  });
});
