/**
 * ORCID linking plugin for author verification.
 *
 * @remarks
 * Verifies author identities by linking to ORCID profiles.
 * Uses ORCID public API for profile lookup.
 *
 * Features:
 * - Validates ORCID identifiers
 * - Fetches author profiles from ORCID
 * - Caches profiles to reduce API calls
 * - Supports author verification workflow
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { ValidationError, NotFoundError, PluginError } from '../../types/errors.js';
import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';

import { BasePlugin } from './base-plugin.js';

/**
 * ORCID profile data.
 *
 * @public
 */
export interface OrcidProfile {
  /**
   * ORCID identifier (e.g., 0000-0001-2345-6789).
   */
  orcid: string;

  /**
   * Full name.
   */
  name: string;

  /**
   * Given names.
   */
  givenNames: string | null;

  /**
   * Family name.
   */
  familyName: string | null;

  /**
   * Current affiliation.
   */
  affiliation: string | null;

  /**
   * Whether the profile was successfully verified.
   */
  verified: boolean;

  /**
   * Profile URL.
   */
  profileUrl: string;
}

/**
 * ORCID search result for autocomplete.
 *
 * @public
 */
export interface OrcidSearchResult {
  /**
   * ORCID identifier.
   */
  orcid: string;

  /**
   * Given names.
   */
  givenNames: string | null;

  /**
   * Family name.
   */
  familyName: string | null;

  /**
   * Current affiliation (if available).
   */
  affiliation: string | null;
}

/**
 * Preprint indexed event data.
 *
 * @internal
 */
interface PreprintIndexedEvent {
  uri: string;
  authorDid: string;
  orcid?: string;
}

/**
 * Author linked event data.
 *
 * @internal
 */
interface AuthorLinkedEvent {
  did: string;
  orcid: string;
}

/**
 * ORCID API person response structure.
 *
 * @internal
 */
interface OrcidApiResponse {
  name?: {
    'given-names'?: { value?: string };
    'family-name'?: { value?: string };
  };
  affiliations?: {
    'affiliation-group'?: {
      summaries?: {
        'employment-summary'?: {
          organization?: {
            name?: string;
          };
        };
      }[];
    }[];
  };
}

/**
 * ORCID linking plugin.
 *
 * @remarks
 * Automatically verifies author ORCID identifiers when preprints
 * are indexed or when authors link their ORCID accounts.
 *
 * @example
 * ```typescript
 * const plugin = new OrcidLinkingPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
 *
 * @public
 */
export class OrcidLinkingPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.orcid';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.orcid',
    name: 'ORCID Linking',
    version: '0.1.0',
    description: 'Links and verifies author identities via ORCID',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['pub.orcid.org', 'orcid.org'],
      },
      hooks: ['author.linked', 'preprint.indexed'],
      storage: {
        maxSize: 5 * 1024 * 1024, // 5MB
      },
    },
    entrypoint: 'orcid-linking.js',
  };

  /**
   * Cache TTL in seconds (24 hours).
   */
  private readonly CACHE_TTL = 86400;

  /**
   * ORCID API base URL.
   */
  private readonly ORCID_API_URL = 'https://pub.orcid.org/v3.0';

  /**
   * Rate limit delay in milliseconds.
   */
  private readonly RATE_LIMIT_DELAY = 1000;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.context.eventBus.on('preprint.indexed', (...args: readonly unknown[]) => {
      void this.handlePreprintIndexed(args[0] as PreprintIndexedEvent);
    });
    this.context.eventBus.on('author.linked', (...args: readonly unknown[]) => {
      void this.handleAuthorLinked(args[0] as AuthorLinkedEvent);
    });

    this.logger.info('ORCID linking plugin initialized');

    return Promise.resolve();
  }

  /**
   * Handles preprint indexed events.
   */
  private async handlePreprintIndexed(data: PreprintIndexedEvent): Promise<void> {
    if (!data.orcid) {
      return;
    }

    try {
      const profile = await this.fetchOrcidProfile(data.orcid);

      this.logger.info('ORCID profile verified', {
        preprintUri: data.uri,
        orcid: data.orcid,
        name: profile.name,
        verified: profile.verified,
      });

      this.recordCounter('profiles_verified');

      // Emit verification event
      this.context.eventBus.emit('orcid.verified', {
        preprintUri: data.uri,
        authorDid: data.authorDid,
        profile,
      });
    } catch (err) {
      this.logger.warn('Failed to verify ORCID profile', {
        orcid: data.orcid,
        error: (err as Error).message,
      });

      this.recordCounter('verification_errors');
    }
  }

  /**
   * Handles author linked events.
   */
  private async handleAuthorLinked(data: AuthorLinkedEvent): Promise<void> {
    try {
      const profile = await this.fetchOrcidProfile(data.orcid);

      this.logger.info('Author ORCID linked', {
        did: data.did,
        orcid: data.orcid,
        name: profile.name,
      });

      this.recordCounter('authors_linked');
    } catch (err) {
      this.logger.warn('Failed to link ORCID', {
        did: data.did,
        orcid: data.orcid,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Searches for ORCID profiles by name.
   *
   * @param query - Search query (name)
   * @param options - Search options
   * @returns Matching ORCID profiles
   *
   * @public
   */
  async searchAuthors(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly OrcidSearchResult[]> {
    if (query.length < 2) {
      return [];
    }

    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 8, 20);

    try {
      // ORCID search API: search by name fields.
      const searchQuery = encodeURIComponent(`family-name:${query}* OR given-names:${query}*`);
      const response = await fetch(`${this.ORCID_API_URL}/search/?q=${searchQuery}&rows=${limit}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Chive-AppView/1.0 (https://chive.pub)',
        },
      });

      if (!response.ok) {
        this.logger.warn('ORCID search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as {
        result?: {
          'orcid-identifier'?: {
            path?: string;
          };
        }[];
      };

      if (!data.result || data.result.length === 0) {
        return [];
      }

      // Fetch expanded profiles for each result
      const results: OrcidSearchResult[] = [];
      for (const item of data.result.slice(0, limit)) {
        const orcidId = item['orcid-identifier']?.path;
        if (!orcidId) continue;

        try {
          // Fetch expanded data
          const profile = await this.fetchOrcidProfile(orcidId);
          results.push({
            orcid: profile.orcid,
            givenNames: profile.givenNames,
            familyName: profile.familyName,
            affiliation: profile.affiliation,
          });
        } catch {
          // Skip profiles that fail to fetch
          continue;
        }
      }

      return results;
    } catch (err) {
      this.logger.warn('Error searching ORCID', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Fetches an ORCID profile.
   *
   * @param orcid - ORCID identifier
   * @returns ORCID profile
   * @throws Error if invalid ORCID or fetch fails
   *
   * @public
   */
  async fetchOrcidProfile(orcid: string): Promise<OrcidProfile> {
    // Validate ORCID format
    if (!this.isValidOrcid(orcid)) {
      throw new ValidationError(`Invalid ORCID format: ${orcid}`, 'orcid', 'format');
    }

    const cacheKey = `orcid:${orcid}`;

    // Check cache first
    const cached = await this.cache.get<OrcidProfile>(cacheKey);
    if (cached) {
      this.logger.debug('ORCID profile from cache', { orcid });
      return cached;
    }

    // Rate limiting
    await this.rateLimit();

    // Fetch from ORCID API
    const response = await fetch(`${this.ORCID_API_URL}/${orcid}/person`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Chive-AppView/1.0 (https://chive.pub)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError('ORCID Profile', orcid);
      }
      throw new PluginError(this.id, 'EXECUTE', `ORCID API error: ${response.status}`);
    }

    const data = (await response.json()) as OrcidApiResponse;

    // Extract profile data
    const givenNames = data.name?.['given-names']?.value ?? null;
    const familyName = data.name?.['family-name']?.value ?? null;
    const name = [givenNames, familyName].filter(Boolean).join(' ') || 'Unknown';

    // Extract affiliation
    let affiliation: string | null = null;
    const affiliations = data.affiliations?.['affiliation-group'];
    if (affiliations && affiliations.length > 0) {
      const summary = affiliations[0]?.summaries?.[0]?.['employment-summary'];
      affiliation = summary?.organization?.name ?? null;
    }

    const profile: OrcidProfile = {
      orcid,
      name,
      givenNames,
      familyName,
      affiliation,
      verified: true,
      profileUrl: `https://orcid.org/${orcid}`,
    };

    // Cache the result
    await this.cache.set(cacheKey, profile, this.CACHE_TTL);

    return profile;
  }

  /**
   * Validates an ORCID identifier format.
   *
   * @param orcid - ORCID to validate
   * @returns True if valid format
   *
   * @example
   * ```typescript
   * isValidOrcid('0000-0001-2345-6789'); // true
   * isValidOrcid('0000-0001-2345-678X'); // true (X is valid checksum)
   * isValidOrcid('1234-5678'); // false (wrong format)
   * ```
   *
   * @public
   */
  isValidOrcid(orcid: string): boolean {
    // ORCID format: 0000-0001-2345-6789 or 0000-0001-2345-678X
    const pattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
    if (!pattern.test(orcid)) {
      return false;
    }

    // Validate checksum
    return this.validateOrcidChecksum(orcid);
  }

  /**
   * Validates ORCID checksum (Luhn algorithm variant).
   *
   * @param orcid - ORCID to validate
   * @returns True if checksum valid
   */
  private validateOrcidChecksum(orcid: string): boolean {
    const digits = orcid.replace(/-/g, '');
    let total = 0;

    for (let i = 0; i < 15; i++) {
      const digitChar = digits[i];
      if (!digitChar) {
        return false;
      }
      const digit = parseInt(digitChar, 10);
      total = (total + digit) * 2;
    }

    const remainder = total % 11;
    const checksum = (12 - remainder) % 11;
    const expectedChar = checksum === 10 ? 'X' : checksum.toString();

    return digits[15] === expectedChar;
  }

  /**
   * Applies rate limiting between requests.
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }
}

export default OrcidLinkingPlugin;
