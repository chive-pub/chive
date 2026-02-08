/**
 * Tests for well-known endpoint handlers.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  registerWellKnownRoutes,
  standardPublicationHandler,
} from '@/api/handlers/rest/well-known.js';
import type { ChiveEnv } from '@/api/types/context.js';

// =============================================================================
// TESTS
// =============================================================================

describe('well-known endpoints', () => {
  let app: Hono<ChiveEnv>;
  const originalEnv = process.env;

  beforeEach(() => {
    app = new Hono<ChiveEnv>();
    registerWellKnownRoutes(app);
    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /.well-known/site.standard.publication', () => {
    it('returns AT-URI pointing to publication record', async () => {
      process.env.CHIVE_SERVICE_DID = 'did:web:test.chive.pub';

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('at://did:web:test.chive.pub/site.standard.publication/self');
    });

    it('uses default DID when env not set', async () => {
      delete process.env.CHIVE_SERVICE_DID;

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('at://did:web:chive.pub/site.standard.publication/self');
    });

    it('returns plain text content type', async () => {
      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/plain');
    });

    it('sets cache control header', async () => {
      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.status).toBe(200);
      const cacheControl = res.headers.get('Cache-Control');
      expect(cacheControl).toContain('public');
      expect(cacheControl).toContain('max-age=86400');
    });

    it('handles did:plc format', async () => {
      process.env.CHIVE_SERVICE_DID = 'did:plc:abc123xyz';

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('at://did:plc:abc123xyz/site.standard.publication/self');
    });
  });
});

describe('standardPublicationHandler', () => {
  it('is exported and callable', () => {
    expect(typeof standardPublicationHandler).toBe('function');
  });
});
