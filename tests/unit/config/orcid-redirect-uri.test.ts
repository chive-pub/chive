/**
 * Unit tests for the ORCID OAuth redirect URI.
 *
 * @remarks
 * The callback is registered at `/v1/auth/orcid/callback`, since REST routes
 * are mounted on the application root. The default redirect URI pointed at
 * `/api/v1/auth/orcid/callback` instead, so the whole ORCID verification flow
 * 404ed wherever a request reaches the application directly — local
 * development, and the `api.DOMAIN` Traefik router, which does not strip a
 * prefix. Only the `Host(DOMAIN) && PathPrefix(/api)` router strips one, and a
 * deployment behind it can set `ORCID_REDIRECT_URI` explicitly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { getOrcidConfig } from '@/config/orcid.js';

const ORIGINAL = { ...process.env };

describe('ORCID redirect URI', () => {
  beforeEach(() => {
    process.env.ORCID_CLIENT_ID = 'test-client';
    process.env.ORCID_CLIENT_SECRET = 'test-secret';
    delete process.env.ORCID_REDIRECT_URI;
    delete process.env.API_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('defaults to the path the callback route is registered at', () => {
    process.env.API_BASE_URL = 'https://api.chive.pub';
    expect(getOrcidConfig().redirectUri).toBe('https://api.chive.pub/v1/auth/orcid/callback');
  });

  it('does not prepend an /api segment the application does not serve', () => {
    process.env.API_BASE_URL = 'https://api.chive.pub';
    expect(getOrcidConfig().redirectUri).not.toContain('/api/v1/');
  });

  // A deployment behind the path-prefixed router sets the URI explicitly.
  it('honours an explicit override', () => {
    process.env.ORCID_REDIRECT_URI = 'https://chive.pub/api/v1/auth/orcid/callback';
    expect(getOrcidConfig().redirectUri).toBe('https://chive.pub/api/v1/auth/orcid/callback');
  });

  it('refuses to load without credentials', () => {
    delete process.env.ORCID_CLIENT_ID;
    expect(() => getOrcidConfig()).toThrow(/ORCID OAuth not configured/);
  });
});
