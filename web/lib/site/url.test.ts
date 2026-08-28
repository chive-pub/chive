import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { absoluteUrl, siteUrl } from './url';

describe('siteUrl', () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  });

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('falls back to the production origin', () => {
    expect(siteUrl()).toBe('https://chive.pub');
  });

  it('uses a configured origin', () => {
    // Without this, staging pages advertised production as their canonical
    // home, which invites a search engine to treat one as a duplicate of the
    // other — or to index the wrong one.
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.chive.pub';
    expect(siteUrl()).toBe('https://staging.chive.pub');
  });

  it('strips a trailing slash so paths do not double up', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.chive.pub/';
    expect(siteUrl()).toBe('https://staging.chive.pub');
    expect(absoluteUrl('/og')).toBe('https://staging.chive.pub/og');
  });

  it('strips several trailing slashes', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.chive.pub///';
    expect(siteUrl()).toBe('https://staging.chive.pub');
  });

  it('ignores a blank value rather than producing a relative URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   ';
    expect(siteUrl()).toBe('https://chive.pub');
  });

  it('joins a path that has no leading slash', () => {
    expect(absoluteUrl('og')).toBe('https://chive.pub/og');
  });

  it('produces a URL the URL constructor accepts', () => {
    // `metadataBase` is `new URL(siteUrl())`, which throws on a malformed value
    // and would fail the build rather than the page.
    expect(() => new URL(siteUrl())).not.toThrow();
  });
});
