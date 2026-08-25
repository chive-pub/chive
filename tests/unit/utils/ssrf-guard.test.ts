/**
 * Unit tests for the SSRF guard.
 *
 * @remarks
 * The guard stands between a caller-supplied URL and a server-side `fetch`.
 * The cases that matter are the ones an attacker reaches for: the cloud
 * metadata endpoint, loopback, RFC 1918 space, and a hostname that resolves
 * into any of them. Hostname resolution is stubbed so the tests do not depend
 * on DNS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { assertFetchableUrl, isPrivateAddress, SsrfBlockedError } from '@/utils/ssrf-guard.js';

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }));

describe('isPrivateAddress', () => {
  it.each([
    ['169.254.169.254', 'cloud metadata'],
    ['127.0.0.1', 'loopback'],
    ['10.1.2.3', 'RFC 1918 /8'],
    ['172.16.0.1', 'RFC 1918 /12'],
    ['172.31.255.255', 'RFC 1918 /12 upper bound'],
    ['192.168.1.1', 'RFC 1918 /16'],
    ['100.64.0.1', 'carrier-grade NAT'],
    ['0.0.0.0', 'this network'],
    ['224.0.0.1', 'multicast'],
    ['::1', 'IPv6 loopback'],
    ['fd00::1', 'IPv6 unique-local'],
    ['fe80::1', 'IPv6 link-local'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
  ])('treats %s as private (%s)', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([['8.8.8.8'], ['1.1.1.1'], ['2606:4700:4700::1111']])(
    'treats %s as public',
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    }
  );

  // 172.15 and 172.32 sit just outside the /12 and must not be swept up.
  it.each([['172.15.0.1'], ['172.32.0.1']])('does not over-block %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe('assertFetchableUrl', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34' }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a public https URL', async () => {
    await expect(assertFetchableUrl('https://pds.example.com/xrpc/x')).resolves.toBeInstanceOf(URL);
  });

  it('rejects plain http by default', async () => {
    await expect(assertFetchableUrl('http://pds.example.com')).rejects.toThrow(SsrfBlockedError);
  });

  it('permits plain http when explicitly allowed', async () => {
    await expect(
      assertFetchableUrl('http://pds.example.com', { allowHttp: true })
    ).resolves.toBeInstanceOf(URL);
  });

  it.each([['file:///etc/passwd'], ['gopher://example.com'], ['ftp://example.com']])(
    'rejects the %s scheme',
    async (url) => {
      await expect(assertFetchableUrl(url)).rejects.toThrow(SsrfBlockedError);
    }
  );

  it('rejects a URL carrying embedded credentials', async () => {
    await expect(assertFetchableUrl('https://user:pw@pds.example.com')).rejects.toThrow(
      /embedded credentials/
    );
  });

  it('rejects an unparseable URL', async () => {
    await expect(assertFetchableUrl('not a url')).rejects.toThrow(/not parseable/);
  });

  // Literals are checked directly, without a DNS round trip.
  it('rejects the cloud metadata address given as a literal', async () => {
    await expect(assertFetchableUrl('https://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /non-public address/
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects localhost by name', async () => {
    await expect(assertFetchableUrl('https://localhost/admin')).rejects.toThrow(/non-public/);
  });

  it('rejects an IPv6 loopback literal', async () => {
    await expect(assertFetchableUrl('https://[::1]/admin')).rejects.toThrow(/non-public/);
  });

  // The interesting case: a name the attacker controls that points inward.
  it('rejects a public hostname that resolves to a private address', async () => {
    lookupMock.mockResolvedValue([{ address: '169.254.169.254' }]);
    await expect(assertFetchableUrl('https://evil.example.com')).rejects.toThrow(
      /non-public address \(169\.254\.169\.254\)/
    );
  });

  // A split-horizon answer must not be rescued by one public address.
  it('rejects when any resolved address is private', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34' }, { address: '10.0.0.5' }]);
    await expect(assertFetchableUrl('https://evil.example.com')).rejects.toThrow(/10\.0\.0\.5/);
  });

  it('rejects a host that does not resolve', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertFetchableUrl('https://nope.example.com')).rejects.toThrow(
      /Could not resolve/
    );
  });

  it('rejects a host that resolves to nothing', async () => {
    lookupMock.mockResolvedValue([]);
    await expect(assertFetchableUrl('https://empty.example.com')).rejects.toThrow(
      /Could not resolve/
    );
  });
});
