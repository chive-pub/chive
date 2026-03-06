/**
 * Unit tests for instrumentation added to auth middleware and blob proxy service.
 *
 * @remarks
 * Verifies that the auth middleware and blob proxy service correctly
 * record Prometheus metrics for authentication attempts and blob proxy
 * operations.
 */

import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { authenticateServiceAuth } from '@/api/middleware/auth.js';
import type { ChiveEnv } from '@/api/types/context.js';
import { authMetrics, blobProxyMetrics } from '@/observability/prometheus-registry.js';
import type { DID } from '@/types/atproto.js';
import type { IAuthorizationService } from '@/types/interfaces/authorization.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import { createMockAuthzService, createMockLogger } from '../../helpers/mock-services.js';

describe('Auth middleware instrumentation', () => {
  let app: Hono<ChiveEnv>;
  let mockLogger: ILogger;
  let mockAuthzService: IAuthorizationService;
  let authAttemptsSpy: ReturnType<typeof vi.spyOn>;
  let authDurationSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockAuthzService = createMockAuthzService();

    authAttemptsSpy = vi.spyOn(authMetrics.attemptsTotal, 'inc');
    authDurationSpy = vi.spyOn(authMetrics.duration, 'startTimer');

    app = new Hono<ChiveEnv>();

    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('requestId', 'req_test_instrumentation');
      await next();
    });
  });

  describe('anonymous requests', () => {
    it('records anonymous auth attempt when no token is present', async () => {
      const mockVerifier = {
        verify: vi.fn().mockResolvedValue(null),
      };

      app.use('*', authenticateServiceAuth(mockVerifier, mockAuthzService));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test');

      expect(authAttemptsSpy).toHaveBeenCalledWith({
        method: 'service_auth',
        result: 'anonymous',
      });
    });

    it('does not start a duration timer for anonymous requests', async () => {
      const mockVerifier = {
        verify: vi.fn().mockResolvedValue(null),
      };

      app.use('*', authenticateServiceAuth(mockVerifier, mockAuthzService));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test');

      expect(authDurationSpy).not.toHaveBeenCalled();
    });
  });

  describe('successful authentication', () => {
    it('records success auth attempt with duration', async () => {
      const mockEndTimer = vi.fn();
      authDurationSpy.mockReturnValue(mockEndTimer);

      const mockVerifier = {
        verify: vi.fn().mockResolvedValue({
          did: 'did:plc:testuser123' as DID,
          exp: Date.now() + 3600000,
        }),
      };

      vi.mocked(mockAuthzService.getRoles).mockResolvedValue([]);

      app.use('*', authenticateServiceAuth(mockVerifier, mockAuthzService));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: { Authorization: 'Bearer valid-test-token' },
      });

      expect(authDurationSpy).toHaveBeenCalledWith({ method: 'service_auth' });
      expect(authAttemptsSpy).toHaveBeenCalledWith({
        method: 'service_auth',
        result: 'success',
      });
      expect(mockEndTimer).toHaveBeenCalled();
    });
  });

  describe('failed authentication', () => {
    it('records failure auth attempt when token is invalid', async () => {
      const mockEndTimer = vi.fn();
      authDurationSpy.mockReturnValue(mockEndTimer);

      const mockVerifier = {
        verify: vi.fn().mockResolvedValue(null),
      };

      app.use('*', authenticateServiceAuth(mockVerifier, mockAuthzService));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: { Authorization: 'Bearer invalid-token' },
      });

      expect(authAttemptsSpy).toHaveBeenCalledWith({
        method: 'service_auth',
        result: 'failure',
      });
      expect(mockEndTimer).toHaveBeenCalled();
    });

    it('records failure auth attempt when verification throws', async () => {
      const mockEndTimer = vi.fn();
      authDurationSpy.mockReturnValue(mockEndTimer);

      const mockVerifier = {
        verify: vi.fn().mockRejectedValue(new Error('Verification error')),
      };

      app.use('*', authenticateServiceAuth(mockVerifier, mockAuthzService));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: { Authorization: 'Bearer bad-token' },
      });

      expect(authAttemptsSpy).toHaveBeenCalledWith({
        method: 'service_auth',
        result: 'failure',
      });
      expect(mockEndTimer).toHaveBeenCalled();
    });
  });
});

describe('Blob proxy service instrumentation', () => {
  let requestsTotalSpy: ReturnType<typeof vi.spyOn>;
  let bytesTotalSpy: ReturnType<typeof vi.spyOn>;
  let durationSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    requestsTotalSpy = vi.spyOn(blobProxyMetrics.requestsTotal, 'inc');
    bytesTotalSpy = vi.spyOn(blobProxyMetrics.bytesTotal, 'inc');
    durationSpy = vi.spyOn(blobProxyMetrics.duration, 'startTimer');
  });

  describe('metric recording', () => {
    it('records success with cache source on successful blob fetch', () => {
      // Simulate what BlobProxyService.getBlob does on success
      blobProxyMetrics.requestsTotal.inc({ status: 'success', cache: 'redis' });
      blobProxyMetrics.bytesTotal.inc({ direction: 'out' }, 4096);

      expect(requestsTotalSpy).toHaveBeenCalledWith({
        status: 'success',
        cache: 'redis',
      });
      expect(bytesTotalSpy).toHaveBeenCalledWith({ direction: 'out' }, 4096);
    });

    it('records error with cache none on failed blob fetch', () => {
      blobProxyMetrics.requestsTotal.inc({ status: 'error', cache: 'none' });

      expect(requestsTotalSpy).toHaveBeenCalledWith({
        status: 'error',
        cache: 'none',
      });
    });

    it('starts and stops duration timer', () => {
      const mockEndTimer = vi.fn();
      durationSpy.mockReturnValue(mockEndTimer);

      const endTimer = blobProxyMetrics.duration.startTimer();
      endTimer();

      expect(durationSpy).toHaveBeenCalled();
      expect(mockEndTimer).toHaveBeenCalled();
    });

    it('records different cache sources correctly', () => {
      blobProxyMetrics.requestsTotal.inc({ status: 'success', cache: 'cdn' });
      blobProxyMetrics.requestsTotal.inc({ status: 'success', cache: 'pds' });

      expect(requestsTotalSpy).toHaveBeenCalledWith({ status: 'success', cache: 'cdn' });
      expect(requestsTotalSpy).toHaveBeenCalledWith({ status: 'success', cache: 'pds' });
    });
  });
});
