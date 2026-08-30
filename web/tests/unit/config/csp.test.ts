/**
 * Tests for the frontend Content-Security-Policy.
 *
 * @remarks
 * These exist because a `connect-src` of `'self' <api>` shipped to production
 * and broke sign-in. An ATProto client in the browser connects to hosts it
 * learns at runtime — the user's PDS, a DoH resolver, `plc.directory` — so a
 * host list cannot be correct here. The point of these tests is that narrowing
 * it back fails loudly in CI rather than quietly at a user's login screen.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import nextConfig from '../../../next.config';

/** Pull one directive out of the policy the config produces. */
async function directive(name: string): Promise<string> {
  const headers = await nextConfig.headers!();
  const entry = headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy');
  expect(entry, 'no CSP header').toBeDefined();

  const found = entry!.value
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  expect(found, `no ${name} directive`).toBeDefined();
  return found!;
}

const originalEnv = process.env.NODE_ENV;

describe('Content-Security-Policy', () => {
  beforeEach(() => {
    // @ts-expect-error NODE_ENV is readonly in the Next types, writable at runtime
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    // @ts-expect-error see above
    process.env.NODE_ENV = originalEnv;
  });

  describe('connect-src', () => {
    it('allows any HTTPS origin, because the PDS host is not known in advance', async () => {
      // Every record this app writes is a browser-to-PDS call, and the PDS
      // comes from the user's DID document. Anyone may run one.
      expect(await directive('connect-src')).toMatch(/(^|\s)https:(\s|$)/);
    });

    it('still allows the app origin', async () => {
      expect(await directive('connect-src')).toContain("'self'");
    });

    it('allows secure websockets', async () => {
      expect(await directive('connect-src')).toMatch(/(^|\s)wss:(\s|$)/);
    });

    it('does not open plaintext HTTP in production', async () => {
      // What `https:` still buys: no cleartext exfiltration channel.
      const connect = await directive('connect-src');
      expect(connect).not.toMatch(/(^|\s)http:(\s|$)/);
      expect(connect).not.toMatch(/(^|\s)ws:(\s|$)/);
    });
  });

  describe('the directives that actually contain XSS', () => {
    it('forbids plugins and embedded objects', async () => {
      expect(await directive('object-src')).toBe("object-src 'none'");
    });

    it('pins the document base URI', async () => {
      expect(await directive('base-uri')).toBe("base-uri 'self'");
    });

    it('stops a form being retargeted at another origin', async () => {
      expect(await directive('form-action')).toBe("form-action 'self'");
    });

    it('refuses to be framed', async () => {
      expect(await directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    });

    it('does not allow eval in production', async () => {
      expect(await directive('script-src')).not.toContain("'unsafe-eval'");
    });

    it('keeps a default-src fallback of self', async () => {
      expect(await directive('default-src')).toBe("default-src 'self'");
    });
  });
});
