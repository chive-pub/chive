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
    // These used to assert the endpoint always answered
    // `at://<serviceDid>/site.standard.publication/self`. That URI could not
    // resolve for two independent reasons: no publication record exists in the
    // service repository, and `self` is not a legal rkey for a lexicon whose
    // key is `tid`. A reader following it saw a broken publication rather than
    // an unconfigured one, so the endpoint now reports honestly.

    it('returns the configured publication URI', async () => {
      process.env.CHIVE_PUBLICATION_URI =
        'at://did:web:test.chive.pub/site.standard.publication/3l';

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('at://did:web:test.chive.pub/site.standard.publication/3l');
    });

    it('answers 404 when no publication record is configured', async () => {
      delete process.env.CHIVE_PUBLICATION_URI;

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.status).toBe(404);
    });

    it('does not invent a URI from the service DID', async () => {
      // The old behaviour: a service DID alone was enough to advertise a
      // record. It is not — the record has to exist.
      process.env.CHIVE_SERVICE_DID = 'did:web:test.chive.pub';
      delete process.env.CHIVE_PUBLICATION_URI;

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain('at://');
    });

    it('returns plain text content type', async () => {
      process.env.CHIVE_PUBLICATION_URI =
        'at://did:web:test.chive.pub/site.standard.publication/3l';

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.headers.get('content-type')).toContain('text/plain');
    });

    it('sets cache control header when it has something to advertise', async () => {
      process.env.CHIVE_PUBLICATION_URI =
        'at://did:web:test.chive.pub/site.standard.publication/3l';

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.headers.get('cache-control')).toContain('max-age');
    });

    it('does not cache the unconfigured answer', async () => {
      // Caching a 404 for a day would outlast the deployment that fixes it.
      delete process.env.CHIVE_PUBLICATION_URI;

      const res = await app.request('/.well-known/site.standard.publication');

      expect(res.headers.get('cache-control')).toBeNull();
    });
  });
});

describe('standardPublicationHandler', () => {
  it('is exported and callable', () => {
    expect(typeof standardPublicationHandler).toBe('function');
  });
});
