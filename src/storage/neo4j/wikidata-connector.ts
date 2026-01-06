/**
 * Wikidata connector for knowledge graph bootstrapping and enrichment.
 *
 * @remarks
 * Provides high-level methods for querying Wikidata and enriching Chive's
 * knowledge graph with authority records, field mappings, and semantic data.
 *
 * Uses SPARQL client for rate-limited queries to Wikidata Query Service.
 *
 * @packageDocumentation
 */

import { inject, singleton } from 'tsyringe';

import type { AtUri } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';

import type { AuthorityRepository } from './authority-repository.js';
import { getGovernanceDid } from './setup.js';
import type { SparqlClient } from './sparql-client.js';
import type { AuthorityRecord, AuthorityStatus, ExternalMapping, MatchType } from './types.js';

/**
 * Wikidata entity basic information.
 */
export interface WikidataEntity {
  qid: string;
  label: string;
  description?: string;
  aliases: string[];
  wikipediaUrl?: string;
}

/**
 * Wikidata entity with relationships.
 */
export interface WikidataEntityFull extends WikidataEntity {
  broader: string[]; // Q-IDs of broader concepts
  narrower: string[]; // Q-IDs of narrower concepts
  related: string[]; // Q-IDs of related concepts
  instanceOf: string[]; // P31 values
  subclassOf: string[]; // P279 values
}

/**
 * Wikidata search result.
 */
export interface WikidataSearchResult {
  qid: string;
  label: string;
  description?: string;
  relevance: number;
}

/**
 * Bootstrap configuration.
 */
export interface BootstrapConfig {
  /**
   * Root Q-IDs to start bootstrapping from.
   * @example ['Q11862829'] // academic discipline
   */
  rootQids: string[];

  /**
   * Maximum depth to traverse.
   * @default 3
   */
  maxDepth: number;

  /**
   * Maximum entities to import.
   * @default 1000
   */
  maxEntities: number;

  /**
   * Include Wikipedia URLs.
   * @default true
   */
  includeWikipedia: boolean;

  /**
   * Language for labels and descriptions.
   * @default 'en'
   */
  language: string;
}

/**
 * Bootstrap progress callback.
 */
export interface BootstrapProgress {
  entitiesProcessed: number;
  entitiesTotal: number;
  currentDepth: number;
  currentQid: string;
  status: 'processing' | 'completed' | 'error';
  message?: string;
}

/**
 * Wikidata connector for knowledge graph integration.
 *
 * @remarks
 * Provides methods for:
 * - Querying Wikidata entities and their properties
 * - Searching Wikidata by label
 * - Bootstrapping authority records from Wikidata taxonomy
 * - Enriching existing Chive fields with Wikidata mappings
 * - Syncing updates from Wikidata
 *
 * All operations use rate-limited SPARQL queries.
 *
 * @example
 * ```typescript
 * const connector = container.resolve(WikidataConnector);
 *
 * // Get entity details
 * const entity = await connector.getEntity('Q5');
 * console.log(entity.label); // "human"
 *
 * // Search for entities
 * const results = await connector.search('quantum computing');
 * console.log(results[0].qid); // "Q484761"
 *
 * // Bootstrap academic disciplines
 * await connector.bootstrap({
 *   rootQids: ['Q11862829'], // academic discipline
 *   maxDepth: 3,
 *   maxEntities: 500
 * });
 * ```
 */
@singleton()
export class WikidataConnector {
  constructor(
    @inject('SparqlClient') private readonly sparql: SparqlClient,
    @inject('AuthorityRepository') private readonly authorityRepo: AuthorityRepository
  ) {}

  /**
   * Get Wikidata entity by Q-ID.
   *
   * @param qid - Wikidata Q-ID (e.g., 'Q5', 'Q484761')
   * @param language - Language code for labels
   * @returns Entity details or null if not found
   *
   * @example
   * ```typescript
   * const entity = await connector.getEntity('Q43479');
   * console.log(entity.label); // "artificial neural network"
   * console.log(entity.aliases); // ["neural network", "ANN", ...]
   * ```
   */
  async getEntity(qid: string, language = 'en'): Promise<WikidataEntity | null> {
    const query = `
      PREFIX wd: <http://www.wikidata.org/entity/>
      PREFIX wdt: <http://www.wikidata.org/prop/direct/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      PREFIX schema: <http://schema.org/>

      SELECT ?label ?description (GROUP_CONCAT(DISTINCT ?alias; separator="|||") AS ?aliases) ?wikipediaUrl
      WHERE {
        BIND(wd:${qid} AS ?item)

        ?item rdfs:label ?label.
        FILTER(LANG(?label) = "${language}")

        OPTIONAL {
          ?item schema:description ?description.
          FILTER(LANG(?description) = "${language}")
        }

        OPTIONAL {
          ?item skos:altLabel ?alias.
          FILTER(LANG(?alias) = "${language}")
        }

        OPTIONAL {
          ?wikipediaUrl schema:about ?item;
                       schema:isPartOf <https://${language}.wikipedia.org/>.
        }
      }
      GROUP BY ?label ?description ?wikipediaUrl
      LIMIT 1
    `;

    const result = await this.sparql.query(query);

    const binding = result.results.bindings[0];
    if (!binding) {
      return null;
    }

    const label = this.sparql.extractString(binding, 'label');

    if (!label) {
      return null;
    }

    const aliasesStr = this.sparql.extractString(binding, 'aliases');
    const aliases = aliasesStr ? aliasesStr.split('|||').filter(Boolean) : [];

    return {
      qid,
      label,
      description: this.sparql.extractString(binding, 'description'),
      aliases,
      wikipediaUrl: this.sparql.extractUri(binding, 'wikipediaUrl'),
    };
  }

  /**
   * Get Wikidata entity with full relationship graph.
   *
   * @param qid - Wikidata Q-ID
   * @param language - Language code for labels
   * @returns Entity with relationships or null
   *
   * @example
   * ```typescript
   * const entity = await connector.getEntityFull('Q11862829');
   * console.log(entity.label); // "academic discipline"
   * console.log(entity.narrower); // ["Q11862829", "Q11862830", ...]
   * ```
   */
  async getEntityFull(qid: string, language = 'en'): Promise<WikidataEntityFull | null> {
    const basicInfo = await this.getEntity(qid, language);

    if (!basicInfo) {
      return null;
    }

    // Get relationships
    const relationshipsQuery = `
      PREFIX wd: <http://www.wikidata.org/entity/>
      PREFIX wdt: <http://www.wikidata.org/prop/direct/>

      SELECT
        (GROUP_CONCAT(DISTINCT ?instanceOf; separator="|||") AS ?instanceOfList)
        (GROUP_CONCAT(DISTINCT ?subclassOf; separator="|||") AS ?subclassOfList)
        (GROUP_CONCAT(DISTINCT ?broader; separator="|||") AS ?broaderList)
        (GROUP_CONCAT(DISTINCT ?narrower; separator="|||") AS ?narrowerList)
        (GROUP_CONCAT(DISTINCT ?related; separator="|||") AS ?relatedList)
      WHERE {
        BIND(wd:${qid} AS ?item)

        OPTIONAL { ?item wdt:P31 ?instanceOf. }
        OPTIONAL { ?item wdt:P279 ?subclassOf. }
        OPTIONAL { ?item wdt:P361 ?broader. }
        OPTIONAL { ?narrower wdt:P361 ?item. }
        OPTIONAL { ?item wdt:P1889 ?related. }
      }
      GROUP BY ?item
      LIMIT 1
    `;

    const relResult = await this.sparql.query(relationshipsQuery);

    const relBinding = relResult.results.bindings[0] ?? {};

    const extractQids = (str: string | undefined): string[] => {
      if (!str) return [];
      return str
        .split('|||')
        .map((uri) => this.sparql.extractQid(uri))
        .filter((qid): qid is string => qid !== undefined);
    };

    return {
      ...basicInfo,
      instanceOf: extractQids(this.sparql.extractString(relBinding, 'instanceOfList')),
      subclassOf: extractQids(this.sparql.extractString(relBinding, 'subclassOfList')),
      broader: extractQids(this.sparql.extractString(relBinding, 'broaderList')),
      narrower: extractQids(this.sparql.extractString(relBinding, 'narrowerList')),
      related: extractQids(this.sparql.extractString(relBinding, 'relatedList')),
    };
  }

  /**
   * Search Wikidata by label.
   *
   * @param searchTerm - Search query
   * @param language - Language code
   * @param limit - Maximum results to return
   * @returns Search results ranked by relevance
   *
   * @example
   * ```typescript
   * const results = await connector.search('machine learning', 'en', 10);
   * for (const result of results) {
   *   console.log(`${result.qid}: ${result.label}`);
   * }
   * ```
   */
  async search(searchTerm: string, language = 'en', limit = 20): Promise<WikidataSearchResult[]> {
    // Escape quotes in search term
    const escapedTerm = searchTerm.replace(/"/g, '\\"');

    const query = `
      PREFIX wd: <http://www.wikidata.org/entity/>
      PREFIX wdt: <http://www.wikidata.org/prop/direct/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX schema: <http://schema.org/>

      SELECT DISTINCT ?item ?label ?description
      WHERE {
        ?item rdfs:label ?label.
        FILTER(LANG(?label) = "${language}")
        FILTER(CONTAINS(LCASE(?label), LCASE("${escapedTerm}")))

        OPTIONAL {
          ?item schema:description ?description.
          FILTER(LANG(?description) = "${language}")
        }

        # Prefer academic disciplines and topics
        OPTIONAL { ?item wdt:P31/wdt:P279* wd:Q11862829. }
      }
      ORDER BY
        # Exact matches first
        IF(LCASE(?label) = LCASE("${escapedTerm}"), 0, 1)
        # Then prefix matches
        IF(STRSTARTS(LCASE(?label), LCASE("${escapedTerm}")), 0, 1)
      LIMIT ${limit}
    `;

    const result = await this.sparql.query(query);

    const results: WikidataSearchResult[] = [];

    for (const binding of result.results.bindings) {
      const uri = this.sparql.extractUri(binding, 'item');
      const label = this.sparql.extractString(binding, 'label');

      if (!uri || !label) continue;

      const qid = this.sparql.extractQid(uri);
      if (!qid) continue;

      // Calculate relevance score
      const labelLower = label.toLowerCase();
      const termLower = searchTerm.toLowerCase();

      let relevance = 0;
      if (labelLower === termLower) {
        relevance = 1.0;
      } else if (labelLower.startsWith(termLower)) {
        relevance = 0.8;
      } else if (labelLower.includes(termLower)) {
        relevance = 0.6;
      } else {
        relevance = 0.4;
      }

      results.push({
        qid,
        label,
        description: this.sparql.extractString(binding, 'description'),
        relevance,
      });
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Bootstrap authority records from Wikidata.
   *
   * @param config - Bootstrap configuration
   * @param onProgress - Progress callback
   * @returns Number of authority records created
   *
   * @remarks
   * Recursively traverses Wikidata taxonomy starting from root Q-IDs,
   * creating authority records and field mappings.
   *
   * @example
   * ```typescript
   * const count = await connector.bootstrap({
   *   rootQids: ['Q11862829'], // academic discipline
   *   maxDepth: 3,
   *   maxEntities: 500
   * }, (progress) => {
   *   console.log(`${progress.entitiesProcessed}/${progress.entitiesTotal}`);
   * });
   * console.log(`Created ${count} authority records`);
   * ```
   */
  async bootstrap(
    config: Partial<BootstrapConfig>,
    onProgress?: (progress: BootstrapProgress) => void
  ): Promise<number> {
    const fullConfig: BootstrapConfig = {
      rootQids: config.rootQids ?? [],
      maxDepth: config.maxDepth ?? 3,
      maxEntities: config.maxEntities ?? 1000,
      includeWikipedia: config.includeWikipedia ?? true,
      language: config.language ?? 'en',
    };

    if (fullConfig.rootQids.length === 0) {
      throw new ValidationError('At least one root Q-ID is required', 'rootQids', 'min_length');
    }

    let entitiesProcessed = 0;
    const visitedQids = new Set<string>();
    const queue: { qid: string; depth: number }[] = fullConfig.rootQids.map((qid) => ({
      qid,
      depth: 0,
    }));

    while (queue.length > 0 && entitiesProcessed < fullConfig.maxEntities) {
      const item = queue.shift();
      if (!item) break;

      const { qid, depth } = item;

      if (visitedQids.has(qid) || depth > fullConfig.maxDepth) {
        continue;
      }

      visitedQids.add(qid);

      onProgress?.({
        entitiesProcessed,
        entitiesTotal: Math.min(queue.length + entitiesProcessed, fullConfig.maxEntities),
        currentDepth: depth,
        currentQid: qid,
        status: 'processing',
      });

      try {
        const entity = await this.getEntityFull(qid, fullConfig.language);

        if (!entity) {
          continue;
        }

        // Create authority record
        const authorityId = `wikidata:${qid}`;
        const status: AuthorityStatus = 'established';

        const mapping: ExternalMapping = {
          system: 'wikidata',
          identifier: qid,
          uri: `https://www.wikidata.org/wiki/${qid}`,
          matchType: 'exact-match' as MatchType,
        };

        const authorityRecord: Omit<AuthorityRecord, 'uri' | 'createdAt' | 'updatedAt'> = {
          id: authorityId,
          authorizedForm: entity.label,
          variantForms: entity.aliases,
          scopeNote: entity.description,
          status,
          sources: [mapping],
          language: fullConfig.language,
        };

        // Create ATUri for the authority record
        const governanceDid = getGovernanceDid();
        const recordWithUri: AuthorityRecord = {
          ...authorityRecord,
          uri: `at://${governanceDid}/pub.chive.graph.authority/${authorityId}` as AtUri,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.authorityRepo.createAuthorityRecord(recordWithUri);

        entitiesProcessed++;

        // Add related entities to queue
        if (depth < fullConfig.maxDepth) {
          for (const relatedQid of [...entity.narrower, ...entity.subclassOf]) {
            if (!visitedQids.has(relatedQid)) {
              queue.push({ qid: relatedQid, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        onProgress?.({
          entitiesProcessed,
          entitiesTotal: Math.min(queue.length + entitiesProcessed, fullConfig.maxEntities),
          currentDepth: depth,
          currentQid: qid,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    onProgress?.({
      entitiesProcessed,
      entitiesTotal: entitiesProcessed,
      currentDepth: 0,
      currentQid: '',
      status: 'completed',
    });

    return entitiesProcessed;
  }

  /**
   * Enrich existing authority record with Wikidata data.
   *
   * @param authorityId - Authority record ID
   * @param qid - Wikidata Q-ID to link
   * @returns True if enriched successfully
   *
   * @example
   * ```typescript
   * await connector.enrichAuthority('neural-networks-cs', 'Q43479');
   * ```
   */
  async enrichAuthority(authorityId: string, qid: string): Promise<boolean> {
    const entity = await this.getEntity(qid);

    if (!entity) {
      return false;
    }

    const authority = await this.authorityRepo.getAuthorityRecordById(authorityId);

    if (!authority) {
      return false;
    }

    // Add Wikidata mapping to existing authority
    const mapping: ExternalMapping = {
      system: 'wikidata',
      identifier: qid,
      uri: `https://www.wikidata.org/wiki/${qid}`,
      matchType: 'exact-match' as MatchType,
    };

    await this.authorityRepo.addExternalMapping(authority.uri, mapping);

    return true;
  }

  /**
   * Find Wikidata Q-ID for a given label.
   *
   * @param label - Label to search for
   * @param language - Language code
   * @returns Q-ID of best match or null
   *
   * @example
   * ```typescript
   * const qid = await connector.findQid('quantum computing');
   * console.log(qid); // "Q484761"
   * ```
   */
  async findQid(label: string, language = 'en'): Promise<string | null> {
    const results = await this.search(label, language, 1);
    return results[0]?.qid ?? null;
  }

  /**
   * Sync authority record with latest Wikidata data.
   *
   * @param qid - Wikidata Q-ID
   * @returns True if synced successfully
   *
   * @example
   * ```typescript
   * await connector.syncFromWikidata('Q43479');
   * ```
   */
  async syncFromWikidata(qid: string): Promise<boolean> {
    const entity = await this.getEntity(qid);

    if (!entity) {
      return false;
    }

    const authorityId = `wikidata:${qid}`;
    const existing = await this.authorityRepo.getAuthorityRecordById(authorityId);

    if (!existing) {
      // Create new authority record
      const mapping: ExternalMapping = {
        system: 'wikidata',
        identifier: qid,
        uri: `https://www.wikidata.org/wiki/${qid}`,
        matchType: 'exact-match' as MatchType,
      };

      const authority: Omit<AuthorityRecord, 'uri' | 'createdAt' | 'updatedAt'> = {
        id: authorityId,
        authorizedForm: entity.label,
        variantForms: entity.aliases,
        scopeNote: entity.description,
        status: 'established',
        sources: [mapping],
        language: 'en',
      };

      const governanceDid = getGovernanceDid();
      const recordWithUri: AuthorityRecord = {
        ...authority,
        uri: `at://${governanceDid}/pub.chive.graph.authority/${authorityId}` as AtUri,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.authorityRepo.createAuthorityRecord(recordWithUri);
      return true;
    }

    // Update existing record using updateAuthorityRecord
    const updated: Partial<AuthorityRecord> = {
      authorizedForm: entity.label,
      variantForms: entity.aliases,
      scopeNote: entity.description ?? existing.scopeNote,
      updatedAt: new Date(),
    };

    await this.authorityRepo.updateAuthorityRecord(existing.uri, updated);
    return true;
  }
}
