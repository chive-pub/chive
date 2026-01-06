/**
 * ROR (Research Organization Registry) integration plugin.
 *
 * @remarks
 * Provides organization/institution lookup via the ROR API.
 * ROR (https://ror.org) is a community-led registry of research organizations
 * providing persistent identifiers and metadata.
 *
 * This plugin is used to:
 * - Verify institutional affiliations for claiming
 * - Enrich author affiliations with structured data
 * - Map between organization identifiers (GRID, ISNI, Wikidata)
 *
 * Uses ROR REST API (free, open access):
 * - Base URL: https://api.ror.org/organizations
 * - No authentication required
 * - No rate limits documented (be polite)
 *
 * ROR-verified institutional affiliations are a verification authority
 * for the multi-authority claiming system.
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
 * ROR organization metadata.
 *
 * @public
 */
export interface RorOrganization {
  /**
   * ROR ID (https://ror.org/0xxxxxx format).
   */
  id: string;

  /**
   * Organization name.
   */
  name: string;

  /**
   * Alternative names.
   */
  aliases: readonly string[];

  /**
   * Acronyms.
   */
  acronyms: readonly string[];

  /**
   * Labels in other languages.
   */
  labels: readonly {
    label: string;
    iso639: string;
  }[];

  /**
   * Organization types.
   */
  types: readonly (
    | 'Education'
    | 'Healthcare'
    | 'Company'
    | 'Archive'
    | 'Nonprofit'
    | 'Government'
    | 'Facility'
    | 'Other'
  )[];

  /**
   * Country information.
   */
  country: {
    countryCode: string;
    countryName: string;
  };

  /**
   * Location information.
   */
  addresses: readonly {
    city?: string;
    state?: string;
    stateCode?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
  }[];

  /**
   * External identifiers.
   */
  externalIds: {
    GRID?: string;
    ISNI?: readonly string[];
    FundRef?: readonly string[];
    Wikidata?: string;
  };

  /**
   * Related organizations.
   */
  relationships: readonly {
    type: 'Parent' | 'Child' | 'Related' | 'Successor' | 'Predecessor';
    id: string;
    label: string;
  }[];

  /**
   * Website URLs.
   */
  links: readonly string[];

  /**
   * Wikipedia URL.
   */
  wikipedia?: string;

  /**
   * Organization status.
   */
  status: 'active' | 'inactive' | 'withdrawn';

  /**
   * Established year.
   */
  established?: number;

  /**
   * Source of the metadata.
   */
  source: 'ror';
}

/**
 * ROR API response structure.
 *
 * @internal
 */
interface RorApiOrganization {
  id?: string;
  name?: string;
  aliases?: string[];
  acronyms?: string[];
  labels?: { label?: string; iso639?: string }[];
  types?: string[];
  country?: {
    country_code?: string;
    country_name?: string;
  };
  addresses?: {
    city?: string;
    state?: string;
    state_code?: string;
    country_geonames_id?: number;
    lat?: number;
    lng?: number;
  }[];
  external_ids?: {
    GRID?: { preferred?: string; all?: string[] };
    ISNI?: { preferred?: string; all?: string[] };
    FundRef?: { preferred?: string; all?: string[] };
    Wikidata?: { preferred?: string; all?: string[] };
  };
  relationships?: {
    type?: string;
    id?: string;
    label?: string;
  }[];
  links?: string[];
  wikipedia_url?: string;
  status?: string;
  established?: number;
}

/**
 * ROR search result.
 *
 * @internal
 */
interface RorSearchResult {
  number_of_results: number;
  time_taken: number;
  items: RorApiOrganization[];
}

/**
 * ROR integration plugin.
 *
 * @remarks
 * Provides organization lookup from the Research Organization Registry.
 * ROR-verified institutional affiliations provide medium-confidence
 * identity verification for the multi-authority claiming system.
 *
 * @example
 * ```typescript
 * const plugin = new RorPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Look up organization by ROR ID
 * const org = await plugin.getOrganization('https://ror.org/042nb2s44');
 *
 * // Search for organizations
 * const results = await plugin.searchOrganizations('MIT');
 *
 * // Verify institutional email domain
 * const isVerified = await plugin.verifyEmailDomain('mit.edu');
 * ```
 *
 * @public
 */
export class RorPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.ror';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.ror',
    name: 'ROR Integration',
    version: '0.1.0',
    description: 'Provides organization lookup and institutional verification via ROR',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.ror.org'],
      },
      storage: {
        maxSize: 50 * 1024 * 1024, // 50MB for caching
      },
    },
    entrypoint: 'ror.js',
  };

  /**
   * ROR API base URL.
   */
  private readonly API_BASE_URL = 'https://api.ror.org/organizations';

  /**
   * Cache TTL in seconds (30 days - ROR data is stable).
   */
  private readonly CACHE_TTL = 86400 * 30;

  /**
   * Minimum delay between requests (ms) - be polite.
   */
  private rateLimitDelayMs = 200;

  /**
   * Last request timestamp.
   */
  private lastRequestTime = 0;

  /**
   * Initializes the plugin.
   */
  protected onInitialize(): Promise<void> {
    this.logger.info('ROR plugin initialized', {
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
   * Gets organization by ROR ID.
   *
   * @param rorId - ROR ID (with or without https://ror.org/ prefix)
   * @returns Organization metadata or null
   *
   * @public
   */
  async getOrganization(rorId: string): Promise<RorOrganization | null> {
    const normalizedId = this.normalizeRorId(rorId);
    if (!normalizedId) {
      return null;
    }

    const cacheKey = `ror:org:${normalizedId}`;
    const cached = await this.cache.get<RorOrganization>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/${normalizedId}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.warn('ROR API error', {
          rorId: normalizedId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as RorApiOrganization;
      const org = this.parseOrganization(data);

      if (org) {
        await this.cache.set(cacheKey, org, this.CACHE_TTL);
      }

      return org;
    } catch (err) {
      this.logger.warn('Error fetching ROR organization', {
        rorId: normalizedId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Searches for organizations.
   *
   * @param query - Search query (name, alias, acronym)
   * @param options - Search options
   * @returns Matching organizations
   *
   * @public
   */
  async searchOrganizations(
    query: string,
    options?: { limit?: number; filter?: string }
  ): Promise<readonly RorOrganization[]> {
    await this.rateLimit();

    const params = new URLSearchParams({
      query: query,
    });

    if (options?.filter) {
      params.set('filter', options.filter);
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('ROR search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as RorSearchResult;
      const limit = options?.limit ?? 20;
      const orgs: RorOrganization[] = [];

      for (const item of data.items.slice(0, limit)) {
        const org = this.parseOrganization(item);
        if (org) {
          orgs.push(org);
        }
      }

      return orgs;
    } catch (err) {
      this.logger.warn('Error searching ROR', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Searches for organizations that match an email domain.
   *
   * @remarks
   * Used for institutional email verification in the claiming system.
   * For example, an email ending in @mit.edu would match MIT's ROR record.
   *
   * @param domain - Email domain to search
   * @returns Matching organizations (usually 0-1)
   *
   * @public
   */
  async findByEmailDomain(domain: string): Promise<readonly RorOrganization[]> {
    // Extract root domain (handle subdomains)
    const parts = domain.split('.');
    const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : domain;

    // Search by domain (ROR indexes website links)
    const results = await this.searchOrganizations(rootDomain, { limit: 5 });

    // Filter to organizations whose links match the domain
    return results.filter((org) =>
      org.links.some((link) => {
        try {
          const url = new URL(link);
          return url.hostname.endsWith(rootDomain);
        } catch {
          return false;
        }
      })
    );
  }

  /**
   * Verifies if an email domain belongs to a known research organization.
   *
   * @remarks
   * Used for institutional verification in the claiming system.
   *
   * @param domain - Email domain to verify
   * @returns Organization if found, null otherwise
   *
   * @public
   */
  async verifyEmailDomain(domain: string): Promise<RorOrganization | null> {
    const orgs = await this.findByEmailDomain(domain);
    return orgs[0] ?? null;
  }

  /**
   * Gets organization by external ID (GRID, ISNI, Wikidata).
   *
   * @param type - External ID type
   * @param id - External ID value
   * @returns Organization or null
   *
   * @public
   */
  async getByExternalId(
    type: 'GRID' | 'ISNI' | 'FundRef' | 'Wikidata',
    id: string
  ): Promise<RorOrganization | null> {
    await this.rateLimit();

    const filterKey = type.toLowerCase();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}?filter=${filterKey}:${encodeURIComponent(id)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('ROR external ID lookup error', {
          type,
          id,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as RorSearchResult;

      const item = data.items[0];
      if (!item) {
        return null;
      }

      return this.parseOrganization(item);
    } catch (err) {
      this.logger.warn('Error looking up ROR by external ID', {
        type,
        id,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Normalizes a ROR ID.
   */
  private normalizeRorId(rorId: string): string | null {
    let normalized = rorId.trim();

    if (normalized.startsWith('https://ror.org/')) {
      normalized = normalized.slice(16);
    } else if (normalized.startsWith('http://ror.org/')) {
      normalized = normalized.slice(15);
    }

    // Validate ROR ID format (0xxxxxxxx)
    if (!/^0[a-z0-9]{8}$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  /**
   * Parses API organization to RorOrganization.
   */
  private parseOrganization(data: RorApiOrganization): RorOrganization | null {
    if (!data.id || !data.name) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      aliases: data.aliases ?? [],
      acronyms: data.acronyms ?? [],
      labels: (data.labels ?? []).map((l) => ({
        label: l.label ?? '',
        iso639: l.iso639 ?? '',
      })),
      types: (data.types ?? []) as RorOrganization['types'],
      country: {
        countryCode: data.country?.country_code ?? '',
        countryName: data.country?.country_name ?? '',
      },
      addresses: (data.addresses ?? []).map((a) => ({
        city: a.city,
        state: a.state,
        stateCode: a.state_code,
        countryCode: data.country?.country_code,
        lat: a.lat,
        lng: a.lng,
      })),
      externalIds: {
        GRID: data.external_ids?.GRID?.preferred,
        ISNI: data.external_ids?.ISNI?.all,
        FundRef: data.external_ids?.FundRef?.all,
        Wikidata: data.external_ids?.Wikidata?.preferred,
      },
      relationships: (data.relationships ?? []).map((r) => ({
        type: (r.type ?? 'Related') as RorOrganization['relationships'][number]['type'],
        id: r.id ?? '',
        label: r.label ?? '',
      })),
      links: data.links ?? [],
      wikipedia: data.wikipedia_url,
      status: (data.status ?? 'active') as RorOrganization['status'],
      established: data.established,
      source: 'ror',
    };
  }
}

export default RorPlugin;
