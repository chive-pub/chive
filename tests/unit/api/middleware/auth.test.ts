/**
 * Unit tests for auth middleware.
 *
 * @remarks
 * Tests authentication and authorization middleware including
 * requireAuth, requireAdmin, and requireAlphaTester.
 */

import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { requireAuth, requireAdmin, requireAlphaTester } from '@/api/middleware/auth.js';
import { errorHandler } from '@/api/middleware/error-handler.js';
import type { ChiveEnv, AuthenticatedUser } from '@/api/types/context.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const createMockUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  did: 'did:plc:testuser123' as DID,
  handle: 'test.user',
  isAdmin: false,
  isPremium: false,
  isAlphaTester: false,
  scopes: [],
  ...overrides,
});

describe('Auth Middleware', () => {
  let app: Hono<ChiveEnv>;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    app = new Hono<ChiveEnv>();

    // Set up context with logger and request ID
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      c.set('requestId', 'req_test123');
      await next();
    });

    // Add error handler
    app.onError(errorHandler);
  });

  describe('requireAuth', () => {
    it('should allow authenticated users', async () => {
      const user = createMockUser();

      app.use('/protected/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/protected/*', requireAuth());
      app.get('/protected/resource', (c) => c.json({ success: true }));

      const res = await app.request('/protected/resource');

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('should reject unauthenticated users', async () => {
      app.use('/protected/*', requireAuth());
      app.get('/protected/resource', (c) => c.json({ success: true }));

      const res = await app.request('/protected/resource');

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(body.error.message).toBe('Authentication required');
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin users', async () => {
      const user = createMockUser({ isAdmin: true });

      app.use('/admin/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/admin/*', requireAdmin());
      app.get('/admin/dashboard', (c) => c.json({ success: true }));

      const res = await app.request('/admin/dashboard');

      expect(res.status).toBe(200);
    });

    it('should reject non-admin users', async () => {
      const user = createMockUser({ isAdmin: false });

      app.use('/admin/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/admin/*', requireAdmin());
      app.get('/admin/dashboard', (c) => c.json({ success: true }));

      const res = await app.request('/admin/dashboard');

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('AUTHORIZATION_ERROR');
      expect(body.error.message).toBe('Admin access required');
    });

    it('should reject unauthenticated users', async () => {
      app.use('/admin/*', requireAdmin());
      app.get('/admin/dashboard', (c) => c.json({ success: true }));

      const res = await app.request('/admin/dashboard');

      expect(res.status).toBe(401);
    });
  });

  describe('requireAlphaTester', () => {
    it('should allow alpha testers', async () => {
      const user = createMockUser({ isAlphaTester: true });

      app.use('/alpha/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/alpha/*', requireAlphaTester());
      app.get('/alpha/feature', (c) => c.json({ success: true }));

      const res = await app.request('/alpha/feature');

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('should allow admins (implicit alpha access)', async () => {
      const user = createMockUser({ isAdmin: true, isAlphaTester: true });

      app.use('/alpha/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/alpha/*', requireAlphaTester());
      app.get('/alpha/feature', (c) => c.json({ success: true }));

      const res = await app.request('/alpha/feature');

      expect(res.status).toBe(200);
    });

    it('should reject non-alpha users', async () => {
      const user = createMockUser({ isAlphaTester: false });

      app.use('/alpha/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/alpha/*', requireAlphaTester());
      app.get('/alpha/feature', (c) => c.json({ success: true }));

      const res = await app.request('/alpha/feature');

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('AUTHORIZATION_ERROR');
      expect(body.error.message).toBe('Alpha tester access required');
    });

    it('should reject unauthenticated users', async () => {
      app.use('/alpha/*', requireAlphaTester());
      app.get('/alpha/feature', (c) => c.json({ success: true }));

      const res = await app.request('/alpha/feature');

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(body.error.message).toBe('Authentication required');
    });

    it('should reject pending alpha applicants', async () => {
      // User has applied but not yet approved
      const user = createMockUser({ isAlphaTester: false });

      app.use('/alpha/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/alpha/*', requireAlphaTester());
      app.get('/alpha/feature', (c) => c.json({ success: true }));

      const res = await app.request('/alpha/feature');

      expect(res.status).toBe(403);
    });
  });

  describe('middleware chaining', () => {
    it('should work with requireAuth before requireAlphaTester', async () => {
      const user = createMockUser({ isAlphaTester: true });

      app.use('/protected/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/protected/*', requireAuth());
      app.use('/protected/*', requireAlphaTester());
      app.get('/protected/alpha', (c) => c.json({ success: true }));

      const res = await app.request('/protected/alpha');

      expect(res.status).toBe(200);
    });

    it('should fail at requireAuth if not authenticated', async () => {
      app.use('/protected/*', requireAuth());
      app.use('/protected/*', requireAlphaTester());
      app.get('/protected/alpha', (c) => c.json({ success: true }));

      const res = await app.request('/protected/alpha');

      expect(res.status).toBe(401);
    });

    it('should fail at requireAlphaTester if authenticated but not alpha', async () => {
      const user = createMockUser({ isAlphaTester: false });

      app.use('/protected/*', async (c, next) => {
        c.set('user', user);
        await next();
      });
      app.use('/protected/*', requireAuth());
      app.use('/protected/*', requireAlphaTester());
      app.get('/protected/alpha', (c) => c.json({ success: true }));

      const res = await app.request('/protected/alpha');

      expect(res.status).toBe(403);
    });
  });
});
