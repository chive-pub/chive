/**
 * Wikidata integration plugin.
 *
 * @remarks
 * Provides entity lookup and knowledge graph integration via the Wikidata API.
 * Wikidata (https://www.wikidata.org) is a free knowledge base that provides
 * structured data about concepts, people, and organizations.
 *
 * This plugin is used to:
 * - Enrich field/concept metadata with Wikidata links
 * - Map between identifiers (DOI, ORCID, VIAF, etc.)
 * - Provide multilingual labels for concepts
 *
 * Uses Wikidata APIs:
 * - REST API: https://www.wikidata.org/w/api.php
 * - SPARQL endpoint: https://query.wikidata.org/sparql
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
 * Wikidata entity metadata.
 *
 * @public
 */
export interface WikidataEntity {
  /**
   * Wikidata ID (Q or P number).
   */
  id: string;

  /**
   * Entity type.
   */
  type: 'item' | 'property';

  /**
   * Labels by language code.
   */
  labels: Record<string, string>;

  /**
   * Descriptions by language code.
   */
  descriptions: Record<string, string>;

  /**
   * Aliases by language code.
   */
  aliases: Record<string, readonly string[]>;

  /**
   * Claims (property-value pairs).
   */
  claims: Record<string, readonly WikidataClaim[]>;

  /**
   * Sitelinks to Wikipedia and other Wikimedia projects.
   */
  sitelinks?: Record<
    string,
    {
      site: string;
      title: string;
      url: string;
    }
  >;

  /**
   * Last modified timestamp.
   */
  modified?: string;

  /**
   * Source of the metadata.
   */
  source: 'wikidata';
}

/**
 * Wikidata claim (statement).
 *
 * @public
 */
export interface WikidataClaim {
  /**
   * Claim ID.
   */
  id: string;

  /**
   * Rank (preferred, normal, deprecated).
   */
  rank: 'preferred' | 'normal' | 'deprecated';

  /**
   * Main value.
   */
  mainsnak: WikidataValue;

  /**
   * Qualifiers.
   */
  qualifiers?: Record<string, readonly WikidataValue[]>;
}

/**
 * Wikidata value.
 *
 * @public
 */
export interface WikidataValue {
  /**
   * Property ID.
   */
  property: string;

  /**
   * Value type.
   */
  datatype: string;

  /**
   * Parsed value.
   */
  value:
    | string
    | number
    | { id: string }
    | { time: string; precision: number }
    | { latitude: number; longitude: number }
    | { amount: string; unit: string };
}

/**
 * Wikidata API entity response.
 *
 * @internal
 */
interface WikidataApiEntity {
  id?: string;
  type?: string;
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  aliases?: Record<string, { value?: string }[]>;
  claims?: Record<string, WikidataApiClaim[]>;
  sitelinks?: Record<string, { site?: string; title?: string; url?: string }>;
  modified?: string;
}

/**
 * Wikidata API claim.
 *
 * @internal
 */
interface WikidataApiClaim {
  id?: string;
  rank?: string;
  mainsnak?: WikidataApiSnak;
  qualifiers?: Record<string, WikidataApiSnak[]>;
}

/**
 * Wikidata API snak (value holder).
 *
 * @internal
 */
interface WikidataApiSnak {
  property?: string;
  datatype?: string;
  datavalue?: {
    type?: string;
    value?: unknown;
  };
}

/**
 * SPARQL query result.
 *
 * @internal
 */
interface SparqlResult {
  head: { vars: string[] };
  results: {
    bindings: Record<string, { type: string; value: string; 'xml:lang'?: string }>[];
  };
}

/**
 * Wikidata integration plugin.
 *
 * @remarks
 * Provides entity lookup and SPARQL queries against Wikidata.
 * Used for knowledge graph enrichment and identifier mapping.
 *
 * @example
 * ```typescript
 * const plugin = new WikidataPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Look up entity
 * const entity = await plugin.getEntity('Q42'); // Douglas Adams
 *
 * // Search for entities
 * const results = await plugin.searchEntities('machine learning');
 *
 * // Run SPARQL query
 * const sparqlResults = await plugin.sparqlQuery(`
 *   SELECT ?item ?label WHERE {
 *     ?item wdt:P31 wd:Q7397.
 *     ?item rdfs:label ?label.
 *     FILTER(LANG(?label) = "en")
 *   } LIMIT 10
 * `);
 * ```
 *
 * @public
 */
export class WikidataPlugin extends BasePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.wikidata';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.wikidata',
    name: 'Wikidata Integration',
    version: '0.1.0',
    description: 'Provides entity lookup and knowledge graph integration via Wikidata',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['www.wikidata.org', 'query.wikidata.org'],
      },
      storage: {
        maxSize: 100 * 1024 * 1024, // 100MB for caching
      },
    },
    entrypoint: 'wikidata.js',
  };

  /**
   * Wikidata API base URL.
   */
  private readonly API_BASE_URL = 'https://www.wikidata.org/w/api.php';

  /**
   * SPARQL endpoint URL.
   */
  private readonly SPARQL_URL = 'https://query.wikidata.org/sparql';

  /**
   * User agent for requests.
   */
  private readonly USER_AGENT = 'Chive-AppView/1.0 (https://chive.pub; contact@chive.pub)';

  /**
   * Cache TTL in seconds (7 days).
   */
  private readonly CACHE_TTL = 86400 * 7;

  /**
   * Minimum delay between requests (ms).
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
    this.logger.info('Wikidata plugin initialized', {
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
   * Gets entity by Wikidata ID.
   *
   * @param id - Wikidata ID (Q or P number)
   * @param options - Fetch options
   * @returns Entity metadata or null
   *
   * @public
   */
  async getEntity(
    id: string,
    options?: { languages?: readonly string[] }
  ): Promise<WikidataEntity | null> {
    const normalizedId = this.normalizeId(id);
    if (!normalizedId) {
      return null;
    }

    const languages = options?.languages ?? ['en'];
    const cacheKey = `wikidata:entity:${normalizedId}:${languages.join(',')}`;
    const cached = await this.cache.get<WikidataEntity>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: normalizedId,
        format: 'json',
        languages: languages.join('|'),
        props: 'labels|descriptions|aliases|claims|sitelinks',
      });

      const response = await fetch(`${this.API_BASE_URL}?${params.toString()}`, {
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('Wikidata API error', {
          id: normalizedId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as { entities: Record<string, WikidataApiEntity> };
      const entityData = data.entities[normalizedId];

      if (entityData?.id === undefined) {
        return null;
      }

      const entity = this.parseEntity(entityData);

      if (entity) {
        await this.cache.set(cacheKey, entity, this.CACHE_TTL);
      }

      return entity;
    } catch (err) {
      this.logger.warn('Error fetching Wikidata entity', {
        id: normalizedId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets multiple entities by IDs.
   *
   * @param ids - Array of Wikidata IDs
   * @param options - Fetch options
   * @returns Map of ID to entity
   *
   * @public
   */
  async getEntities(
    ids: readonly string[],
    options?: { languages?: readonly string[] }
  ): Promise<Map<string, WikidataEntity>> {
    const result = new Map<string, WikidataEntity>();

    // Wikidata API allows up to 50 IDs per request
    const batchSize = 50;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const normalizedIds = batch.map((id) => this.normalizeId(id)).filter(Boolean) as string[];

      if (normalizedIds.length === 0) continue;

      await this.rateLimit();

      const languages = options?.languages ?? ['en'];
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: normalizedIds.join('|'),
        format: 'json',
        languages: languages.join('|'),
        props: 'labels|descriptions|aliases|claims|sitelinks',
      });

      try {
        const response = await fetch(`${this.API_BASE_URL}?${params.toString()}`, {
          headers: {
            'User-Agent': this.USER_AGENT,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          this.logger.warn('Wikidata batch API error', {
            status: response.status,
          });
          continue;
        }

        const data = (await response.json()) as { entities: Record<string, WikidataApiEntity> };

        for (const [entityId, entityData] of Object.entries(data.entities)) {
          if (entityData.id) {
            const entity = this.parseEntity(entityData);
            if (entity) {
              result.set(entityId, entity);
            }
          }
        }
      } catch (err) {
        this.logger.warn('Error fetching Wikidata entities batch', {
          error: (err as Error).message,
        });
      }
    }

    return result;
  }

  /**
   * Searches for entities.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Matching entities
   *
   * @public
   */
  async searchEntities(
    query: string,
    options?: { limit?: number; language?: string; type?: 'item' | 'property' }
  ): Promise<readonly WikidataEntity[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 10, 50);
    const language = options?.language ?? 'en';
    const type = options?.type ?? 'item';

    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: query,
      format: 'json',
      language,
      type,
      limit: limit.toString(),
    });

    try {
      const response = await fetch(`${this.API_BASE_URL}?${params.toString()}`, {
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('Wikidata search error', {
          query,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as {
        search: { id?: string; label?: string; description?: string }[];
      };

      // Get full entity data for search results
      const ids = data.search.map((r) => r.id).filter(Boolean) as string[];

      if (ids.length === 0) {
        return [];
      }

      const entitiesMap = await this.getEntities(ids, { languages: [language] });
      return Array.from(entitiesMap.values());
    } catch (err) {
      this.logger.warn('Error searching Wikidata', {
        query,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Executes a SPARQL query.
   *
   * @param query - SPARQL query string
   * @returns Query results
   *
   * @public
   */
  async sparqlQuery(query: string): Promise<SparqlResult | null> {
    await this.rateLimit();

    try {
      const response = await fetch(this.SPARQL_URL, {
        method: 'POST',
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `query=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        this.logger.warn('SPARQL query error', {
          status: response.status,
        });
        return null;
      }

      return (await response.json()) as SparqlResult;
    } catch (err) {
      this.logger.warn('Error executing SPARQL query', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets entity by external identifier.
   *
   * @param property - Property ID (e.g., P356 for DOI, P496 for ORCID)
   * @param value - External ID value
   * @returns Entity or null
   *
   * @public
   */
  async getEntityByExternalId(property: string, value: string): Promise<WikidataEntity | null> {
    const query = `
      SELECT ?item WHERE {
        ?item wdt:${property} "${value}".
      } LIMIT 1
    `;

    const result = await this.sparqlQuery(query);
    if (!result || result.results.bindings.length === 0) {
      return null;
    }

    const itemUri = result.results.bindings[0]?.item?.value;
    if (!itemUri) {
      return null;
    }

    // Extract Q number from URI
    const match = /Q\d+$/.exec(itemUri);
    if (!match) {
      return null;
    }

    return this.getEntity(match[0]);
  }

  /**
   * Common property IDs for external identifiers.
   */
  static readonly PROPERTIES = {
    DOI: 'P356',
    ORCID: 'P496',
    VIAF: 'P214',
    ISNI: 'P213',
    ROR: 'P6782',
    GRID: 'P2427',
    DBLP_AUTHOR: 'P2456',
    SEMANTIC_SCHOLAR: 'P4012',
    GOOGLE_SCHOLAR: 'P1960',
    SCOPUS_AUTHOR: 'P1153',
    ARXIV: 'P818',
    PUBMED: 'P698',
    ISSN: 'P236',
    ISBN_13: 'P212',
    INSTANCE_OF: 'P31',
    SUBCLASS_OF: 'P279',
  };

  /**
   * Normalizes a Wikidata ID.
   */
  private normalizeId(id: string): string | null {
    let normalized = id.trim().toUpperCase();

    // Remove common prefixes
    if (normalized.startsWith('HTTP://WWW.WIKIDATA.ORG/ENTITY/')) {
      normalized = normalized.slice(31);
    } else if (normalized.startsWith('HTTPS://WWW.WIKIDATA.ORG/ENTITY/')) {
      normalized = normalized.slice(32);
    }

    // Validate format
    if (!/^[QP]\d+$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  /**
   * Parses API entity to WikidataEntity.
   */
  private parseEntity(data: WikidataApiEntity): WikidataEntity | null {
    if (!data.id) {
      return null;
    }

    // Parse labels
    const labels: Record<string, string> = {};
    for (const [lang, labelData] of Object.entries(data.labels ?? {})) {
      if (labelData.value) {
        labels[lang] = labelData.value;
      }
    }

    // Parse descriptions
    const descriptions: Record<string, string> = {};
    for (const [lang, descData] of Object.entries(data.descriptions ?? {})) {
      if (descData.value) {
        descriptions[lang] = descData.value;
      }
    }

    // Parse aliases
    const aliases: Record<string, string[]> = {};
    for (const [lang, aliasData] of Object.entries(data.aliases ?? {})) {
      aliases[lang] = aliasData.map((a) => a.value ?? '').filter(Boolean);
    }

    // Parse claims
    const claims: Record<string, WikidataClaim[]> = {};
    for (const [prop, claimData] of Object.entries(data.claims ?? {})) {
      claims[prop] = claimData.map((c) => this.parseClaim(c)).filter(Boolean) as WikidataClaim[];
    }

    // Parse sitelinks
    const sitelinks: Record<string, { site: string; title: string; url: string }> = {};
    for (const [site, linkData] of Object.entries(data.sitelinks ?? {})) {
      if (linkData.site && linkData.title) {
        sitelinks[site] = {
          site: linkData.site,
          title: linkData.title,
          url: linkData.url ?? '',
        };
      }
    }

    return {
      id: data.id,
      type: data.type === 'property' ? 'property' : 'item',
      labels,
      descriptions,
      aliases,
      claims,
      sitelinks: Object.keys(sitelinks).length > 0 ? sitelinks : undefined,
      modified: data.modified,
      source: 'wikidata',
    };
  }

  /**
   * Parses API claim.
   */
  private parseClaim(data: WikidataApiClaim): WikidataClaim | null {
    if (!data.id || !data.mainsnak) {
      return null;
    }

    const mainsnak = this.parseSnak(data.mainsnak);
    if (!mainsnak) {
      return null;
    }

    const qualifiers: Record<string, WikidataValue[]> = {};
    for (const [prop, qualData] of Object.entries(data.qualifiers ?? {})) {
      qualifiers[prop] = qualData.map((q) => this.parseSnak(q)).filter(Boolean) as WikidataValue[];
    }

    return {
      id: data.id,
      rank: (data.rank ?? 'normal') as WikidataClaim['rank'],
      mainsnak,
      qualifiers: Object.keys(qualifiers).length > 0 ? qualifiers : undefined,
    };
  }

  /**
   * Parses API snak to value.
   */
  private parseSnak(data: WikidataApiSnak): WikidataValue | null {
    if (!data.property || !data.datatype) {
      return null;
    }

    // Parse specific value types
    let value: WikidataValue['value'];

    if (data.datavalue?.type === 'wikibase-entityid') {
      const entityValue = data.datavalue.value as { id?: string };
      value = { id: entityValue.id ?? '' };
    } else if (data.datavalue?.type === 'time') {
      const timeValue = data.datavalue.value as { time?: string; precision?: number };
      value = { time: timeValue.time ?? '', precision: timeValue.precision ?? 0 };
    } else if (data.datavalue?.type === 'globecoordinate') {
      const coordValue = data.datavalue.value as { latitude?: number; longitude?: number };
      value = { latitude: coordValue.latitude ?? 0, longitude: coordValue.longitude ?? 0 };
    } else if (data.datavalue?.type === 'quantity') {
      const quantValue = data.datavalue.value as { amount?: string; unit?: string };
      value = { amount: quantValue.amount ?? '0', unit: quantValue.unit ?? '1' };
    } else if (data.datavalue?.type === 'string' || data.datavalue?.type === 'monolingualtext') {
      const stringValue = data.datavalue.value;
      if (typeof stringValue === 'object' && stringValue !== null && 'text' in stringValue) {
        value = (stringValue as { text: string }).text;
      } else {
        value = String(stringValue);
      }
    } else if (
      typeof data.datavalue?.value === 'string' ||
      typeof data.datavalue?.value === 'number'
    ) {
      value = data.datavalue.value;
    } else {
      // Unknown value type; return null
      return null;
    }

    return {
      property: data.property,
      datatype: data.datatype,
      value,
    };
  }
}

export default WikidataPlugin;
