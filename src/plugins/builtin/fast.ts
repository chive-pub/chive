/**
 * FAST (Faceted Application of Subject Terminology) integration plugin.
 *
 * @remarks
 * Provides subject heading lookup via the OCLC FAST API.
 * FAST (https://fast.oclc.org) is a simplified subject heading schema
 * derived from Library of Congress Subject Headings (LCSH).
 *
 * This plugin is used to:
 * - Provide autocomplete suggestions for research keywords
 * - Link keywords to controlled vocabulary IDs
 * - Support faceted classification of preprints
 *
 * Uses FAST searchFAST API (free, open access):
 * - Base URL: https://fast.oclc.org/searchfast/select
 * - No authentication required
 * - Supports autocomplete-style searches
 *
 * ATProto Compliance:
 * - All data is AppView cache (ephemeral, rebuildable)
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';

import { BasePlugin } from './base-plugin.js';

/**
 * FAST subject heading result.
 *
 * @public
 */
export interface FastSubject {
  /**
   * FAST ID (numeric identifier root).
   */
  id: string;

  /**
   * Authorized heading (preferred label).
   */
  label: string;

  /**
   * Heading type (Topic, Geographic, Personal, Corporate, etc.).
   */
  type: FastSubjectType;

  /**
   * Alternative forms of the heading.
   */
  altLabels: readonly string[];

  /**
   * Usage count in WorldCat records.
   */
  usageCount: number;

  /**
   * Full FAST URI.
   */
  uri: string;

  /**
   * Source of the metadata.
   */
  source: 'fast';
}

/**
 * FAST subject types.
 *
 * @public
 */
export type FastSubjectType =
  | 'Topic'
  | 'Geographic'
  | 'Personal'
  | 'Corporate'
  | 'Event'
  | 'Title'
  | 'Chronological'
  | 'Form';

/**
 * FAST API response structure.
 *
 * @internal
 */
interface FastApiResponse {
  response?: {
    numFound?: number;
    docs?: FastApiDoc[];
  };
}

/**
 * FAST API document structure.
 *
 * @internal
 */
interface FastApiDoc {
  idroot?: string;
  auth?: string;
  type?: string;
  suggestall?: string[];
  usage?: number;
}

/**
 * FAST integration plugin.
 *
 * @remarks
 * Provides subject heading lookup from OCLC's FAST controlled vocabulary.
 * FAST contains 1.7M+ subject headings derived from Library of Congress
 * Subject Headings (LCSH) with simplified syntax.
 *
 * @example
 * ```typescript
 * const plugin = new FastPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Search for subject headings
 * const results = await plugin.searchSubjects('machine learning');
 *
 * // Get subject by FAST ID
 * const subject = await plugin.getSubject('fst01715496');
 * ```
 *
 * @public
 */
export class FastPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.fast';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.fast',
    name: 'FAST Subject Headings',
    version: '0.1.0',
    description: 'Provides subject heading lookup via OCLC FAST controlled vocabulary',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['fast.oclc.org'],
      },
      storage: {
        maxSize: 20 * 1024 * 1024, // 20MB for caching
      },
    },
    entrypoint: 'fast.js',
  };

  /**
   * FAST searchFAST API base URL.
   */
  private readonly API_BASE_URL = 'https://fast.oclc.org/searchfast/select';

  /**
   * Cache TTL in seconds (30 days - FAST data is very stable).
   */
  private readonly CACHE_TTL = 86400 * 30;

  /**
   * Minimum delay between requests (ms) - be polite.
   */
  private rateLimitDelayMs = 100;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('FAST plugin initialized', {
      rateLimit: `${this.rateLimitDelayMs}ms between requests`,
    });

    return Promise.resolve();
  }

  /**
   * Enforces rate limiting.
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.rateLimitDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs - elapsed));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Searches for subject headings.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching subject headings
   *
   * @public
   */
  async searchSubjects(
    query: string,
    options?: { limit?: number; type?: FastSubjectType }
  ): Promise<readonly FastSubject[]> {
    if (query.length < 2) {
      return [];
    }

    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 8, 50);

    // Build query parameters for searchFAST
    const params = new URLSearchParams({
      q: `cql.any all "${query}"`,
      rows: limit.toString(),
      wt: 'json',
      fl: 'idroot,auth,type,suggestall,usage',
      sort: 'usage desc',
    });

    // Filter by type if specified
    if (options?.type) {
      params.set('fq', `type:${options.type}`);
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('FAST search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as FastApiResponse;
      const docs = data.response?.docs ?? [];

      return docs.map((doc) => this.parseSubject(doc)).filter((s): s is FastSubject => s !== null);
    } catch (err) {
      this.logger.warn('Error searching FAST', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Autocomplete subject headings (optimized for typeahead).
   *
   * @param query - Partial query string
   * @param options - Autocomplete options
   * @returns Matching subject headings sorted by usage
   *
   * @public
   */
  async autocompleteSubjects(
    query: string,
    options?: { limit?: number }
  ): Promise<readonly FastSubject[]> {
    if (query.length < 2) {
      return [];
    }

    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 8, 20);

    // Use keyword index for autocomplete (faster)
    const params = new URLSearchParams({
      q: `suggestall:${query}*`,
      rows: limit.toString(),
      wt: 'json',
      fl: 'idroot,auth,type,suggestall,usage',
      sort: 'usage desc',
    });

    try {
      const response = await fetch(`${this.API_BASE_URL}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('FAST autocomplete error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as FastApiResponse;
      const docs = data.response?.docs ?? [];

      return docs.map((doc) => this.parseSubject(doc)).filter((s): s is FastSubject => s !== null);
    } catch (err) {
      this.logger.warn('Error autocompleting FAST', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Gets subject by FAST ID.
   *
   * @param fastId - FAST ID (e.g., "fst01715496" or "1715496")
   * @returns Subject heading or null
   *
   * @public
   */
  async getSubject(fastId: string): Promise<FastSubject | null> {
    const normalizedId = this.normalizeFastId(fastId);
    if (!normalizedId) {
      return null;
    }

    const cacheKey = `fast:subject:${normalizedId}`;
    const cached = await this.cache.get<FastSubject>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    const params = new URLSearchParams({
      q: `idroot:${normalizedId}`,
      rows: '1',
      wt: 'json',
      fl: 'idroot,auth,type,suggestall,usage',
    });

    try {
      const response = await fetch(`${this.API_BASE_URL}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('FAST lookup error', {
          fastId: normalizedId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as FastApiResponse;
      const doc = data.response?.docs?.[0];

      if (!doc) {
        return null;
      }

      const subject = this.parseSubject(doc);

      if (subject) {
        await this.cache.set(cacheKey, subject, this.CACHE_TTL);
      }

      return subject;
    } catch (err) {
      this.logger.warn('Error fetching FAST subject', {
        fastId: normalizedId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Normalizes a FAST ID.
   */
  private normalizeFastId(fastId: string): string | null {
    let normalized = fastId.trim().toLowerCase();

    // Remove "fst" prefix if present
    if (normalized.startsWith('fst')) {
      normalized = normalized.slice(3);
    }

    // Validate format (should be numeric)
    if (!/^\d+$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  /**
   * Parses API document to FastSubject.
   */
  private parseSubject(doc: FastApiDoc): FastSubject | null {
    if (!doc.idroot || !doc.auth) {
      return null;
    }

    const type = this.parseSubjectType(doc.type);

    return {
      id: doc.idroot,
      label: doc.auth,
      type,
      altLabels: doc.suggestall?.filter((s) => s !== doc.auth) ?? [],
      usageCount: doc.usage ?? 0,
      uri: `http://id.worldcat.org/fast/${doc.idroot}`,
      source: 'fast',
    };
  }

  /**
   * Parses subject type string.
   */
  private parseSubjectType(type: string | undefined): FastSubjectType {
    switch (type?.toLowerCase()) {
      case 'geographic':
        return 'Geographic';
      case 'personal':
        return 'Personal';
      case 'corporate':
        return 'Corporate';
      case 'event':
        return 'Event';
      case 'title':
        return 'Title';
      case 'chronological':
        return 'Chronological';
      case 'form':
        return 'Form';
      default:
        return 'Topic';
    }
  }
}

export default FastPlugin;
