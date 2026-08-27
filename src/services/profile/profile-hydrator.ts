/**
 * Batched, cached hydration of Bluesky actor profiles.
 *
 * @remarks
 * Handle, display name and avatar for a DID came from the public Bluesky
 * appview, fetched independently at fourteen call sites — including two
 * byte-identical private methods in the review and annotation services. None of
 * them cached, so rendering a page of reviews re-fetched the same authors'
 * profiles on every request, and a list showing one author twenty times asked
 * about that author twenty times.
 *
 * This is the one implementation. It reads Redis first, requests only the DIDs
 * that miss, and writes what it learns back. Callers hand it every DID they
 * need and receive a map.
 *
 * Profiles are other people's data on someone else's service, so everything
 * here is best-effort: a failed lookup yields no entry rather than an error,
 * and callers already treat a missing profile as "show the DID". A profile
 * service being down should degrade a page, not break it.
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../../types/atproto.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Minimal profile fields Chive renders.
 *
 * @public
 */
export interface ProfileSummary {
  readonly handle?: string;
  readonly displayName?: string;
  readonly avatar?: string;
}

/**
 * Redis operations the hydrator needs.
 *
 * @remarks
 * Narrower than the full client so tests need not stand up Redis, and so it is
 * obvious this only reads and writes single keys with a TTL.
 */
export interface ProfileCache {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
}

/**
 * Construction options.
 *
 * @public
 */
export interface ProfileHydratorOptions {
  readonly logger: ILogger;
  readonly cache?: ProfileCache;
  /** Seconds a cached profile stays fresh. Defaults to one hour. */
  readonly cacheTtlSeconds?: number;
  /** Appview base URL. Defaults to the public Bluesky appview. */
  readonly appviewUrl?: string;
}

/** The appview accepts at most 25 actors per request. */
const BATCH_SIZE = 25;

/** Matches the timeout the previous per-site implementations used. */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Fetches actor profiles in batches, backed by a cache.
 *
 * @public
 */
export class ProfileHydrator {
  private readonly logger: ILogger;
  private readonly cache: ProfileCache | undefined;
  private readonly cacheTtlSeconds: number;
  private readonly appviewUrl: string;

  constructor(options: ProfileHydratorOptions) {
    this.logger = options.logger;
    this.cache = options.cache;
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 3600;
    this.appviewUrl = options.appviewUrl ?? 'https://public.api.bsky.app';
  }

  /**
   * Resolves profiles for a set of DIDs.
   *
   * @param dids - DIDs to resolve; duplicates are collapsed
   * @returns Map of DID to profile, omitting DIDs that could not be resolved
   *
   * @remarks
   * Cached entries never reach the network. A DID that cannot be resolved is
   * absent from the map rather than raising: callers render the DID itself.
   *
   * @public
   */
  async hydrate(dids: readonly DID[]): Promise<Map<DID, ProfileSummary>> {
    const resolved = new Map<DID, ProfileSummary>();
    const unique = [...new Set(dids)];

    if (unique.length === 0) {
      return resolved;
    }

    const misses: DID[] = [];

    for (const did of unique) {
      const cached = await this.readCache(did);
      if (cached) {
        resolved.set(did, cached);
      } else {
        misses.push(did);
      }
    }

    for (let i = 0; i < misses.length; i += BATCH_SIZE) {
      const batch = misses.slice(i, i + BATCH_SIZE);
      const fetched = await this.fetchBatch(batch);

      for (const [did, profile] of fetched) {
        resolved.set(did, profile);
        await this.writeCache(did, profile);
      }
    }

    return resolved;
  }

  /**
   * Reads one profile from the cache.
   *
   * @param did - DID to look up
   * @returns The cached profile, or null on a miss or unreadable entry
   */
  private async readCache(did: DID): Promise<ProfileSummary | null> {
    if (!this.cache) {
      return null;
    }

    try {
      const raw = await this.cache.get(this.cacheKey(did));
      return raw ? (JSON.parse(raw) as ProfileSummary) : null;
    } catch (error) {
      // A cache that is down or holding a malformed entry must not stop the
      // lookup; it just means a fetch.
      this.logger.debug('Profile cache read failed', {
        did,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Writes one profile to the cache.
   *
   * @param did - DID the profile belongs to
   * @param profile - Profile to store
   */
  private async writeCache(did: DID, profile: ProfileSummary): Promise<void> {
    if (!this.cache) {
      return;
    }

    try {
      await this.cache.setex(this.cacheKey(did), this.cacheTtlSeconds, JSON.stringify(profile));
    } catch (error) {
      this.logger.debug('Profile cache write failed', {
        did,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Fetches one batch of profiles from the appview.
   *
   * @param batch - At most {@link BATCH_SIZE} DIDs
   * @returns Profiles the appview returned, keyed by DID
   */
  private async fetchBatch(batch: readonly DID[]): Promise<Map<DID, ProfileSummary>> {
    const found = new Map<DID, ProfileSummary>();

    try {
      const params = new URLSearchParams();
      for (const did of batch) {
        params.append('actors', did);
      }

      const response = await fetch(
        `${this.appviewUrl}/xrpc/app.bsky.actor.getProfiles?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        this.logger.debug('Profile lookup returned a non-OK response', {
          status: response.status,
          batchSize: batch.length,
        });
        return found;
      }

      const data = (await response.json()) as {
        profiles?: { did: string; handle: string; displayName?: string; avatar?: string }[];
      };

      for (const profile of data.profiles ?? []) {
        found.set(profile.did as DID, {
          handle: profile.handle,
          displayName: profile.displayName,
          avatar: profile.avatar,
        });
      }
    } catch (error) {
      this.logger.debug('Failed to fetch profiles', {
        error: error instanceof Error ? error.message : String(error),
        batchSize: batch.length,
      });
    }

    return found;
  }

  /**
   * Cache key for a DID.
   *
   * @param did - DID to key
   * @returns Namespaced Redis key
   */
  private cacheKey(did: DID): string {
    return `chive:profile:bsky:${did}`;
  }
}
