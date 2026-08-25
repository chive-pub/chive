/**
 * Unit tests for batched, cached profile hydration.
 *
 * @remarks
 * Handle, display name and avatar came from the public Bluesky appview at
 * fourteen call sites, two of them byte-identical private methods in the review
 * and annotation services. None cached, so a page of reviews re-fetched the
 * same authors on every request, and a list showing one author twenty times
 * asked about that author twenty times.
 *
 * Profiles are other people's data on someone else's service, so the contract
 * is best-effort throughout: a failure yields no entry rather than an error,
 * because callers already render the DID when a profile is missing. A profile
 * service being down should degrade a page, not break it — which is what these
 * tests pin.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

import { ProfileHydrator } from '@/services/profile/profile-hydrator.js';
import type { DID } from '@/types/atproto.js';

const DID_A = 'did:plc:izttpdp3l6vss5crelt5kcux' as DID;
const DID_B = 'did:plc:5wzpn4a4nbqtz3q45hyud6hd' as DID;

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const profileResponse = (dids: readonly string[]): Response =>
  ({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        profiles: dids.map((did) => ({
          did,
          handle: `${did.slice(-4)}.test`,
          displayName: 'Name',
        })),
      }),
  }) as unknown as Response;

describe('ProfileHydrator', () => {
  let fetchMock: Mock;
  let cache: { get: Mock; setex: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn().mockResolvedValue(profileResponse([DID_A, DID_B]));
    vi.stubGlobal('fetch', fetchMock);
    cache = { get: vi.fn().mockResolvedValue(null), setex: vi.fn().mockResolvedValue('OK') };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const hydrator = (): ProfileHydrator =>
    new ProfileHydrator({ logger: logger as never, cache: cache as never });

  it('resolves profiles for the requested DIDs', async () => {
    const result = await hydrator().hydrate([DID_A, DID_B]);
    expect(result.get(DID_A)?.handle).toBe('kcux.test');
    expect(result.size).toBe(2);
  });

  it('asks the appview once for the whole set', async () => {
    await hydrator().hydrate([DID_A, DID_B]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('collapses duplicate DIDs', async () => {
    await hydrator().hydrate([DID_A, DID_A, DID_A, DID_B]);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect([...url.matchAll(/actors=/g)]).toHaveLength(2);
  });

  it('does not call the network for an empty list', async () => {
    const result = await hydrator().hydrate([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  // The appview accepts 25 actors per request.
  it('splits a large set into batches of 25', async () => {
    const many = Array.from({ length: 60 }, (_, i) => `did:plc:test${i}` as DID);
    fetchMock.mockResolvedValue(profileResponse([]));

    await hydrator().hydrate(many);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  describe('caching', () => {
    it('serves a cached profile without touching the network', async () => {
      cache.get.mockResolvedValue(JSON.stringify({ handle: 'cached.test' }));

      const result = await hydrator().hydrate([DID_A]);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.get(DID_A)?.handle).toBe('cached.test');
    });

    it('writes what it fetched back to the cache', async () => {
      await hydrator().hydrate([DID_A, DID_B]);
      expect(cache.setex).toHaveBeenCalledTimes(2);
    });

    it('requests only the DIDs that missed', async () => {
      cache.get.mockImplementation((key: string) =>
        Promise.resolve(key.includes(DID_A) ? JSON.stringify({ handle: 'cached.test' }) : null)
      );
      fetchMock.mockResolvedValue(profileResponse([DID_B]));

      await hydrator().hydrate([DID_A, DID_B]);

      const url = String(fetchMock.mock.calls[0]?.[0]);
      expect(url).toContain(encodeURIComponent(DID_B));
      expect(url).not.toContain(encodeURIComponent(DID_A));
    });

    // A cache that is down must cost a fetch, not the whole request.
    it('falls back to fetching when the cache read throws', async () => {
      cache.get.mockRejectedValue(new Error('redis down'));

      const result = await hydrator().hydrate([DID_A]);

      expect(fetchMock).toHaveBeenCalled();
      expect(result.get(DID_A)).toBeDefined();
    });

    it('still returns profiles when the cache write throws', async () => {
      cache.setex.mockRejectedValue(new Error('redis down'));

      const result = await hydrator().hydrate([DID_A, DID_B]);

      expect(result.size).toBe(2);
    });

    it('works with no cache configured at all', async () => {
      const uncached = new ProfileHydrator({ logger: logger as never });
      const result = await uncached.hydrate([DID_A, DID_B]);
      expect(result.size).toBe(2);
    });
  });

  describe('degrading rather than failing', () => {
    it('returns no entries when the appview errors', async () => {
      fetchMock.mockRejectedValue(new Error('network unreachable'));

      const result = await hydrator().hydrate([DID_A]);

      expect(result.size).toBe(0);
    });

    it('returns no entries on a non-OK response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 } as unknown as Response);

      const result = await hydrator().hydrate([DID_A]);

      expect(result.size).toBe(0);
    });

    it('tolerates a response with no profiles field', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as unknown as Response);

      const result = await hydrator().hydrate([DID_A]);

      expect(result.size).toBe(0);
    });

    // A DID the appview does not know is simply absent; callers render the DID.
    it('omits DIDs the appview does not return', async () => {
      fetchMock.mockResolvedValue(profileResponse([DID_A]));

      const result = await hydrator().hydrate([DID_A, DID_B]);

      expect(result.has(DID_A)).toBe(true);
      expect(result.has(DID_B)).toBe(false);
    });
  });
});
