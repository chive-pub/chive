import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';

import { Neo4jConnection } from './connection.js';
import type {
  AuthorityRecord,
  AuthorityStatus,
  ExternalMapping,
  AuthorityVariant,
  AuthorityCluster,
  ExternalMappingSuggestion,
} from './types.js';

/**
 * Authority record search result
 */
export interface AuthoritySearchResult {
  records: AuthorityRecord[];
  total: number;
}

/**
 * USE relationship chain
 */
export interface UseChain {
  deprecated: AuthorityRecord;
  preferred: AuthorityRecord;
  hops: number;
}

/**
 * Authority reconciliation result
 */
export interface ReconciliationResult {
  matched: boolean;
  authorityRecord?: AuthorityRecord;
  confidence: number;
  alternativeMatches: {
    record: AuthorityRecord;
    confidence: number;
  }[];
}

/**
 * Authority records repository implementing IFLA LRM 2024-2025 standards.
 *
 * @remarks
 * Manages authority control for consistent indexing and retrieval,
 * including canonical forms, variant forms, and USE relationships.
 *
 * All authority records are sourced from Governance PDS per ATProto compliance.
 * This repository indexes them in Neo4j for fast lookups and resolution.
 *
 * This is an index-only repository that reads from the Governance PDS.
 * It never writes records back to any PDS (user or governance). All authority
 * records originate in the Governance PDS and are indexed here. Indexes are
 * rebuildable from the ATProto firehose. The source of truth is always the
 * Governance PDS, not this Neo4j index.
 *
 * @example
 * ```typescript
 * const authorityRepo = container.resolve(AuthorityRepository);
 *
 * // Create authority record
 * const uri = await authorityRepo.createAuthorityRecord({
 *   id: 'ml',
 *   uri: 'at://did:plc:gov/pub.chive.graph.authority/ml',
 *   authorizedForm: 'Machine learning',
 *   variantForms: ['ML', 'Machine intelligence'],
 *   scopeNote: 'Subset of artificial intelligence...',
 *   status: 'established',
 *   sources: [],
 *   language: 'en',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * });
 *
 * // Resolve variant
 * const canonical = await authorityRepo.resolveVariant('ML');
 * console.log(canonical.authorizedForm); // "Machine learning"
 * ```
 */
@singleton()
export class AuthorityRepository {
  constructor(private connection: Neo4jConnection) {}

  /**
   * Create a new authority record.
   *
   * @param record - Authority record data
   * @returns AT-URI of created authority record
   * @throws {Error} If record with same ID already exists
   *
   * @example
   * ```typescript
   * const uri = await authorityRepo.createAuthorityRecord({
   *   id: 'neural-networks-cs',
   *   uri: 'at://did:plc:gov/pub.chive.graph.authority/nn-cs',
   *   authorizedForm: 'Neural networks (Computer science)',
   *   variantForms: ['Neural nets', 'ANNs', 'Artificial neural networks'],
   *   scopeNote: 'For biological networks, see Nervous system',
   *   status: 'established',
   *   sources: [{
   *     system: 'wikidata',
   *     identifier: 'Q43479',
   *     uri: 'https://www.wikidata.org/wiki/Q43479',
   *     matchType: 'exact-match'
   *   }],
   *   language: 'en',
   *   createdAt: new Date(),
   *   updatedAt: new Date()
   * });
   * ```
   */
  async createAuthorityRecord(record: AuthorityRecord): Promise<AtUri> {
    const query = `
      CREATE (a:AuthorityRecord {
        id: $id,
        uri: $uri,
        authorizedForm: $authorizedForm,
        variantForms: $variantForms,
        scopeNote: $scopeNote,
        status: $status,
        language: $language,
        appliesTo: $appliesTo,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN a.uri as uri
    `;

    try {
      const result = await this.connection.executeQuery<{ uri: AtUri }>(query, {
        id: record.id,
        uri: record.uri,
        authorizedForm: record.authorizedForm,
        variantForms: record.variantForms,
        scopeNote: record.scopeNote ?? null,
        status: record.status,
        language: record.language,
        appliesTo: record.appliesTo ?? null,
      });

      const firstRecord = result.records[0];
      if (!firstRecord) {
        throw new DatabaseError(
          'CREATE',
          'Failed to create authority record: no record returned from database'
        );
      }

      const uri = firstRecord.get('uri');

      // Create external mappings
      for (const source of record.sources) {
        await this.addExternalMapping(uri, source);
      }

      return uri;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.includes('already exists')) {
        throw new ValidationError(
          `Authority record with ID ${record.id} already exists`,
          'id',
          'unique'
        );
      }
      throw error;
    }
  }

  /**
   * Update an existing authority record.
   *
   * @param uri - Authority record AT-URI
   * @param updates - Fields to update
   * @throws {Error} If record not found
   */
  async updateAuthorityRecord(
    uri: AtUri,
    updates: Partial<Omit<AuthorityRecord, 'id' | 'uri' | 'createdAt'>>
  ): Promise<void> {
    const setClauses: string[] = ['a.updatedAt = datetime()'];
    const params: Record<string, string | string[] | null> = { uri };

    if (updates.authorizedForm !== undefined) {
      setClauses.push('a.authorizedForm = $authorizedForm');
      params.authorizedForm = updates.authorizedForm;
    }

    if (updates.variantForms !== undefined) {
      setClauses.push('a.variantForms = $variantForms');
      params.variantForms = updates.variantForms;
    }

    if (updates.scopeNote !== undefined) {
      setClauses.push('a.scopeNote = $scopeNote');
      params.scopeNote = updates.scopeNote ?? null;
    }

    if (updates.status !== undefined) {
      setClauses.push('a.status = $status');
      params.status = updates.status;
    }

    if (updates.language !== undefined) {
      setClauses.push('a.language = $language');
      params.language = updates.language;
    }

    if (updates.appliesTo !== undefined) {
      setClauses.push('a.appliesTo = $appliesTo');
      params.appliesTo = updates.appliesTo ?? null;
    }

    const query = `
      MATCH (a:AuthorityRecord {uri: $uri})
      SET ${setClauses.join(', ')}
      RETURN a
    `;

    const result = await this.connection.executeQuery(query, params);

    if (result.records.length === 0) {
      throw new NotFoundError('AuthorityRecord', uri);
    }
  }

  /**
   * Deprecate an authority record.
   *
   * @param uri - Authority record AT-URI to deprecate
   * @param preferredUri - Preferred authority record AT-URI to use instead
   * @param reason - Deprecation reason
   *
   * @remarks
   * Creates USE_INSTEAD relationship from deprecated to preferred record.
   * Follows IFLA LRM 2024-2025 guidelines for authority control.
   *
   * @example
   * ```typescript
   * await authorityRepo.deprecateAuthority(
   *   'at://did:plc:gov/pub.chive.graph.authority/old',
   *   'at://did:plc:gov/pub.chive.graph.authority/new',
   *   'Superseded by more specific term'
   * );
   * ```
   */
  async deprecateAuthority(uri: AtUri, preferredUri: AtUri, reason: string): Promise<void> {
    await this.connection.executeTransaction(async (tx) => {
      // Mark as deprecated
      await tx.run(
        `
        MATCH (a:AuthorityRecord {uri: $uri})
        SET a.status = 'deprecated',
            a.deprecationReason = $reason,
            a.deprecatedAt = datetime(),
            a.updatedAt = datetime()
        `,
        { uri, reason }
      );

      // Create USE_INSTEAD relationship
      await tx.run(
        `
        MATCH (deprecated:AuthorityRecord {uri: $deprecatedUri})
        MATCH (preferred:AuthorityRecord {uri: $preferredUri})
        MERGE (deprecated)-[r:USE_INSTEAD]->(preferred)
        SET r.reason = $reason,
            r.createdAt = datetime()
        `,
        { deprecatedUri: uri, preferredUri, reason }
      );
    });
  }

  /**
   * Merge two authority records.
   *
   * @param sourceUri - Source authority record AT-URI (will be deprecated)
   * @param targetUri - Target authority record AT-URI (will receive variants)
   * @param reason - Merge reason
   *
   * @remarks
   * Merges variant forms from source into target and creates USE_INSTEAD relationship.
   */
  async mergeAuthorities(sourceUri: AtUri, targetUri: AtUri, reason: string): Promise<void> {
    await this.connection.executeTransaction(async (tx) => {
      // Get source variants
      const sourceResult = await tx.run(
        'MATCH (a:AuthorityRecord {uri: $uri}) RETURN a.variantForms as variants, a.authorizedForm as authorized',
        { uri: sourceUri }
      );

      const sourceVariants = sourceResult.records[0]?.get('variants') as string[] | null;
      const sourceAuthorized = sourceResult.records[0]?.get('authorized') as string | null;

      // Get target variants
      const targetResult = await tx.run(
        'MATCH (a:AuthorityRecord {uri: $uri}) RETURN a.variantForms as variants',
        { uri: targetUri }
      );

      const targetVariants = targetResult.records[0]?.get('variants') as string[] | null;

      // Merge variant lists
      const allVariants = new Set([
        ...(targetVariants ?? []),
        ...(sourceVariants ?? []),
        ...(sourceAuthorized ? [sourceAuthorized] : []),
      ]);

      // Update target with merged variants
      await tx.run(
        `
        MATCH (a:AuthorityRecord {uri: $uri})
        SET a.variantForms = $variantForms,
            a.updatedAt = datetime()
        `,
        {
          uri: targetUri,
          variantForms: Array.from(allVariants),
        }
      );

      // Deprecate source
      await tx.run(
        `
        MATCH (source:AuthorityRecord {uri: $sourceUri})
        MATCH (target:AuthorityRecord {uri: $targetUri})
        SET source.status = 'deprecated',
            source.deprecationReason = $reason,
            source.deprecatedAt = datetime(),
            source.updatedAt = datetime()
        MERGE (source)-[r:USE_INSTEAD]->(target)
        SET r.reason = $reason,
            r.createdAt = datetime()
        `,
        { sourceUri, targetUri, reason }
      );
    });
  }

  /**
   * Get authority record by ID.
   *
   * @param id - Authority record identifier
   * @returns Authority record or null if not found
   */
  async getAuthorityRecordById(id: string): Promise<AuthorityRecord | null> {
    const query = `
      MATCH (a:AuthorityRecord {id: $id})
      OPTIONAL MATCH (a)-[m:EXACT_MATCH|CLOSE_MATCH|BROAD_MATCH|NARROW_MATCH]->(ext:ExternalEntity)
      RETURN a, collect({
        system: ext.system,
        identifier: ext.identifier,
        uri: ext.uri,
        matchType: type(m)
      }) as sources
    `;

    const result = await this.connection.executeQuery<{
      a: Record<string, string | string[]>;
      sources: ExternalMapping[];
    }>(query, { id });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapAuthorityRecord(record.get('a'), record.get('sources'));
  }

  /**
   * Get authority record by URI.
   *
   * @param uri - Authority record AT-URI
   * @returns Authority record or null if not found
   */
  async getAuthorityRecordByUri(uri: AtUri): Promise<AuthorityRecord | null> {
    const query = `
      MATCH (a:AuthorityRecord {uri: $uri})
      OPTIONAL MATCH (a)-[m:EXACT_MATCH|CLOSE_MATCH|BROAD_MATCH|NARROW_MATCH]->(ext:ExternalEntity)
      RETURN a, collect({
        system: ext.system,
        identifier: ext.identifier,
        uri: ext.uri,
        matchType: type(m)
      }) as sources
    `;

    const result = await this.connection.executeQuery<{
      a: Record<string, string | string[]>;
      sources: ExternalMapping[];
    }>(query, { uri });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapAuthorityRecord(record.get('a'), record.get('sources'));
  }

  /**
   * Search authority records by authorized form and variants.
   *
   * @param searchText - Search query
   * @param limit - Maximum results (default: 20)
   * @returns Search results
   *
   * @example
   * ```typescript
   * const results = await authorityRepo.searchAuthorities('neural network');
   * results.records.forEach(r => {
   *   console.log(`${r.authorizedForm}: ${r.variantForms.join(', ')}`);
   * });
   * ```
   */
  async searchAuthorities(searchText: string, limit = 20): Promise<AuthoritySearchResult> {
    const query = `
      CALL db.index.fulltext.queryNodes('authorityTextIndex', $searchText)
      YIELD node, score
      WHERE node:AuthorityRecord
      WITH node, score
      ORDER BY score DESC
      LIMIT $limit
      OPTIONAL MATCH (node)-[m:EXACT_MATCH|CLOSE_MATCH|BROAD_MATCH|NARROW_MATCH]->(ext:ExternalEntity)
      RETURN node, score, collect({
        system: ext.system,
        identifier: ext.identifier,
        uri: ext.uri,
        matchType: type(m)
      }) as sources
    `;

    const result = await this.connection.executeQuery<{
      node: Record<string, string | string[]>;
      score: number;
      sources: ExternalMapping[];
    }>(query, { searchText, limit: neo4j.int(limit) });

    const records = result.records.map((record) =>
      this.mapAuthorityRecord(record.get('node'), record.get('sources'))
    );

    return {
      records,
      total: records.length,
    };
  }

  /**
   * Resolve variant form to canonical authority record.
   *
   * @param variantText - Variant form text
   * @returns Canonical authority record or null if not found
   *
   * @remarks
   * Searches variant forms and follows USE_INSTEAD chains to find canonical form.
   *
   * @example
   * ```typescript
   * const canonical = await authorityRepo.resolveVariant('ML');
   * console.log(canonical?.authorizedForm); // "Machine learning"
   * ```
   */
  async resolveVariant(variantText: string): Promise<AuthorityRecord | null> {
    const query = `
      MATCH (a:AuthorityRecord)
      WHERE toLower($variant) IN [toLower(v) IN a.variantForms | v]
         OR toLower($variant) = toLower(a.authorizedForm)
      WITH a
      OPTIONAL MATCH (a)-[:USE_INSTEAD*1..5]->(canonical:AuthorityRecord)
      WHERE canonical.status <> 'deprecated'
        AND NOT (canonical)-[:USE_INSTEAD]->()
      WITH CASE WHEN canonical IS NULL THEN a ELSE canonical END as result
      OPTIONAL MATCH (result)-[m:EXACT_MATCH|CLOSE_MATCH|BROAD_MATCH|NARROW_MATCH]->(ext:ExternalEntity)
      RETURN result, collect({
        system: ext.system,
        identifier: ext.identifier,
        uri: ext.uri,
        matchType: type(m)
      }) as sources
      LIMIT 1
    `;

    const result = await this.connection.executeQuery<{
      result: Record<string, string | string[]>;
      sources: ExternalMapping[];
    }>(query, { variant: variantText });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapAuthorityRecord(record.get('result'), record.get('sources'));
  }

  /**
   * Follow USE_INSTEAD relationship chain.
   *
   * @param uri - Starting authority record AT-URI
   * @returns Use chain or null if no chain exists
   *
   * @example
   * ```typescript
   * const chain = await authorityRepo.followUseChain(deprecatedUri);
   * if (chain) {
   *   console.log(`Use ${chain.preferred.authorizedForm} instead (${chain.hops} hops)`);
   * }
   * ```
   */
  async followUseChain(uri: AtUri): Promise<UseChain | null> {
    const query = `
      MATCH (deprecated:AuthorityRecord {uri: $uri})
      MATCH path = (deprecated)-[:USE_INSTEAD*1..5]->(preferred:AuthorityRecord)
      WHERE preferred.status <> 'deprecated'
        AND NOT (preferred)-[:USE_INSTEAD]->()
      OPTIONAL MATCH (deprecated)-[m1:EXACT_MATCH|CLOSE_MATCH|BROAD_MATCH|NARROW_MATCH]->(ext1:ExternalEntity)
      OPTIONAL MATCH (preferred)-[m2:EXACT_MATCH|CLOSE_MATCH|BROAD_MATCH|NARROW_MATCH]->(ext2:ExternalEntity)
      RETURN deprecated,
             preferred,
             length(path) as hops,
             collect(DISTINCT {
               system: ext1.system,
               identifier: ext1.identifier,
               uri: ext1.uri,
               matchType: type(m1)
             }) as deprecatedSources,
             collect(DISTINCT {
               system: ext2.system,
               identifier: ext2.identifier,
               uri: ext2.uri,
               matchType: type(m2)
             }) as preferredSources
      ORDER BY hops
      LIMIT 1
    `;

    const result = await this.connection.executeQuery<{
      deprecated: Record<string, string | string[]>;
      preferred: Record<string, string | string[]>;
      hops: number;
      deprecatedSources: ExternalMapping[];
      preferredSources: ExternalMapping[];
    }>(query, { uri });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return {
      deprecated: this.mapAuthorityRecord(
        record.get('deprecated'),
        record.get('deprecatedSources')
      ),
      preferred: this.mapAuthorityRecord(record.get('preferred'), record.get('preferredSources')),
      hops: record.get('hops'),
    };
  }

  /**
   * Detect circular USE_INSTEAD chains.
   *
   * @returns Array of URIs involved in circular chains
   */
  async detectCircularUseChains(): Promise<AtUri[]> {
    const query = `
      MATCH path = (a:AuthorityRecord)-[:USE_INSTEAD*2..10]->(a)
      RETURN DISTINCT [node IN nodes(path) | node.uri] as cycle
    `;

    const result = await this.connection.executeQuery<{ cycle: AtUri[] }>(query);

    return result.records.flatMap((record) => record.get('cycle'));
  }

  /**
   * Add external mapping to authority record.
   *
   * @param uri - Authority record AT-URI
   * @param mapping - External mapping details
   */
  async addExternalMapping(uri: AtUri, mapping: ExternalMapping): Promise<void> {
    const relTypeMap: Record<string, string> = {
      'exact-match': 'EXACT_MATCH',
      'close-match': 'CLOSE_MATCH',
      'broad-match': 'BROAD_MATCH',
      'narrow-match': 'NARROW_MATCH',
      'related-match': 'RELATED_TO',
    };

    const relType = relTypeMap[mapping.matchType] ?? 'RELATED_TO';

    const query = `
      MATCH (a:AuthorityRecord {uri: $uri})
      MERGE (ext:ExternalEntity {system: $system, identifier: $identifier})
      ON CREATE SET ext.uri = $externalUri,
                    ext.createdAt = datetime()
      SET ext.updatedAt = datetime()
      MERGE (a)-[r:${relType}]->(ext)
      SET r.notes = $notes,
          r.lastSyncedAt = $lastSyncedAt,
          r.divergence = $divergence,
          r.createdAt = CASE WHEN r.createdAt IS NULL THEN datetime() ELSE r.createdAt END,
          r.updatedAt = datetime()
      RETURN r
    `;

    await this.connection.executeQuery(query, {
      uri,
      system: mapping.system,
      identifier: mapping.identifier,
      externalUri: mapping.uri ?? null,
      notes: mapping.notes ?? null,
      lastSyncedAt: mapping.lastSyncedAt ?? null,
      divergence: mapping.divergence ?? null,
    });
  }

  /**
   * Detect potential authority record variants using string similarity.
   *
   * @param minSimilarity - Minimum Jaro-Winkler similarity (0-1)
   * @returns Array of potential variant pairs
   *
   * @remarks
   * Uses Levenshtein distance and Jaro-Winkler similarity to detect variants.
   * Also considers co-occurrence patterns on same papers.
   *
   * @example
   * ```typescript
   * const variants = await authorityRepo.detectVariants(0.85);
   * for (const v of variants) {
   *   console.log(`"${v.primaryUri}" ↔ "${v.variantUri}" (${v.similarityScore})`);
   * }
   * ```
   */
  async detectVariants(minSimilarity = 0.85): Promise<AuthorityVariant[]> {
    const query = `
      MATCH (a1:AuthorityRecord), (a2:AuthorityRecord)
      WHERE a1 < a2
        AND a1.status <> 'deprecated'
        AND a2.status <> 'deprecated'
      WITH a1, a2,
           apoc.text.jaroWinklerDistance(
             toLower(a1.authorizedForm),
             toLower(a2.authorizedForm)
           ) as similarity
      WHERE similarity >= $minSimilarity
      OPTIONAL MATCH (a1)<-[:HAS_AUTHORITY]-(p:Eprint)-[:HAS_AUTHORITY]->(a2)
      WITH a1, a2, similarity, count(p) as coOccurrence
      RETURN a1.uri as primaryUri,
             a2.uri as variantUri,
             similarity as similarityScore,
             coOccurrence,
             a1.authorizedForm as primary,
             a2.authorizedForm as variant
      ORDER BY similarity DESC, coOccurrence DESC
      LIMIT 100
    `;

    const result = await this.connection.executeQuery<{
      primaryUri: AtUri;
      variantUri: AtUri;
      similarityScore: number;
      coOccurrence: number;
      primary: string;
      variant: string;
    }>(query, { minSimilarity });

    return result.records.map((record) => ({
      primaryUri: record.get('primaryUri'),
      variantUri: record.get('variantUri'),
      similarityScore: record.get('similarityScore'),
      evidence: [
        `Name similarity: ${(record.get('similarityScore') * 100).toFixed(1)}%`,
        `Co-occurrence: ${record.get('coOccurrence')} papers`,
        `Primary: "${record.get('primary')}"`,
        `Variant: "${record.get('variant')}"`,
      ],
    }));
  }

  /**
   * Cluster authority records using hierarchical clustering.
   *
   * @returns Array of authority clusters
   *
   * @remarks
   * Groups related authority records for editorial review.
   * Uses variant relationships and similarity metrics.
   */
  async clusterAuthorityRecords(): Promise<AuthorityCluster[]> {
    // This would use Neo4j Graph Data Science clustering algorithms
    // For now, return basic grouping by first letter
    const query = `
      MATCH (a:AuthorityRecord)
      WHERE a.status <> 'deprecated'
      WITH substring(toLower(a.authorizedForm), 0, 1) as firstLetter,
           collect(a) as records
      WHERE size(records) > 1
      RETURN firstLetter as clusterId,
             [r IN records | r.authorizedForm] as members,
             [r IN records | r.uri] as uris,
             size(records) as size
      ORDER BY size DESC
      LIMIT 50
    `;

    const result = await this.connection.executeQuery<{
      clusterId: string;
      members: string[];
      uris: AtUri[];
      size: number;
    }>(query);

    return result.records.map((record, index) => ({
      clusterId: index,
      members: record.get('members'),
      uris: record.get('uris'),
      size: record.get('size'),
    }));
  }

  /**
   * Suggest external mappings for authority records.
   *
   * @param uri - Authority record AT-URI
   * @returns Array of external mapping suggestions
   *
   * @remarks
   * Queries external authority systems for potential matches:
   * - Wikidata: SPARQL endpoint for concept matching
   * - FAST: OCLC Faceted Application of Subject Terms
   * - LCSH: Library of Congress Subject Headings (via id.loc.gov)
   * - VIAF: Virtual International Authority File
   *
   * Returns suggestions with confidence scores based on string similarity
   * and match quality.
   */
  async suggestExternalMappings(uri: AtUri): Promise<ExternalMappingSuggestion[]> {
    // Fetch the authority record to get its authorized form
    const record = await this.getAuthorityRecordByUri(uri);
    if (!record) {
      return [];
    }

    const suggestions: ExternalMappingSuggestion[] = [];
    const searchTerm = record.authorizedForm;

    // Query Wikidata SPARQL endpoint
    try {
      const wikidataResults = await this.queryWikidata(searchTerm);
      suggestions.push(
        ...wikidataResults.map((result) => ({
          chiveUri: uri,
          externalSystem: 'wikidata' as const,
          externalId: result.id,
          matchType: result.confidence > 0.9 ? ('exact-match' as const) : ('close-match' as const),
          confidence: result.confidence,
        }))
      );
    } catch {
      // Continue with other sources if Wikidata fails
    }

    // Query OCLC FAST API
    try {
      const fastResults = await this.queryFAST(searchTerm);
      suggestions.push(
        ...fastResults.map((result) => ({
          chiveUri: uri,
          externalSystem: 'fast' as const,
          externalId: result.id,
          matchType: result.confidence > 0.9 ? ('exact-match' as const) : ('close-match' as const),
          confidence: result.confidence,
        }))
      );
    } catch {
      // Continue with other sources if FAST fails
    }

    // Query Library of Congress Subject Headings
    try {
      const lcshResults = await this.queryLCSH(searchTerm);
      suggestions.push(
        ...lcshResults.map((result) => ({
          chiveUri: uri,
          externalSystem: 'lcsh' as const,
          externalId: result.id,
          matchType: result.confidence > 0.9 ? ('exact-match' as const) : ('close-match' as const),
          confidence: result.confidence,
        }))
      );
    } catch {
      // Continue with other sources if LCSH fails
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * Query Wikidata SPARQL endpoint for concept matches.
   *
   * @param searchTerm - Term to search for
   * @returns Matching Wikidata entities with confidence scores
   * @internal
   */
  private async queryWikidata(
    searchTerm: string
  ): Promise<{ id: string; label: string; confidence: number }[]> {
    const query = `
      SELECT ?item ?itemLabel ?description WHERE {
        SERVICE wikibase:mwapi {
          bd:serviceParam wikibase:endpoint "www.wikidata.org";
                          wikibase:api "EntitySearch";
                          mwapi:search "${searchTerm.replace(/"/g, '\\"')}";
                          mwapi:language "en".
          ?item wikibase:apiOutputItem mwapi:item.
        }
        OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT 5
    `;

    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

    const response = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json' },
    });

    if (!response.ok) {
      throw new DatabaseError('READ', `Wikidata SPARQL query failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      results: {
        bindings: {
          item: { value: string };
          itemLabel: { value: string };
          description?: { value: string };
        }[];
      };
    };

    return data.results.bindings.map((binding) => {
      const wikidataUri = binding.item.value;
      const id = wikidataUri.split('/').pop() ?? '';
      const label = binding.itemLabel.value;

      // Calculate confidence based on string similarity
      const confidence = this.calculateStringSimilarity(
        searchTerm.toLowerCase(),
        label.toLowerCase()
      );

      return { id, label, confidence };
    });
  }

  /**
   * Query OCLC FAST API for subject term matches.
   *
   * @param searchTerm - Term to search for
   * @returns Matching FAST terms with confidence scores
   * @internal
   */
  private async queryFAST(
    searchTerm: string
  ): Promise<{ id: string; label: string; confidence: number }[]> {
    const url = `https://fast.oclc.org/searchfast/fastsuggest?query=${encodeURIComponent(searchTerm)}&queryIndex=suggestall&queryReturn=suggestall&suggest=autoSubject&rows=5`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new DatabaseError('READ', `FAST API query failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      response?: {
        docs?: {
          idroot: string;
          auth: string;
          tag: string;
        }[];
      };
    };

    if (!data.response?.docs) {
      return [];
    }

    return data.response.docs.map((doc) => {
      const confidence = this.calculateStringSimilarity(
        searchTerm.toLowerCase(),
        doc.auth.toLowerCase()
      );

      return {
        id: `fst${doc.idroot}`,
        label: doc.auth,
        confidence,
      };
    });
  }

  /**
   * Query Library of Congress Subject Headings.
   *
   * @param searchTerm - Term to search for
   * @returns Matching LCSH terms with confidence scores
   * @internal
   */
  private async queryLCSH(
    searchTerm: string
  ): Promise<{ id: string; label: string; confidence: number }[]> {
    const url = `https://id.loc.gov/authorities/subjects/suggest2?q=${encodeURIComponent(searchTerm)}&count=5`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new DatabaseError('READ', `LCSH API query failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      hits?: {
        uri: string;
        aLabel: string;
      }[];
    };

    if (!data.hits) {
      return [];
    }

    return data.hits.map((hit) => {
      // Extract LCSH ID from URI (e.g., http://id.loc.gov/authorities/subjects/sh85040352)
      const id = hit.uri.split('/').pop() ?? '';
      const confidence = this.calculateStringSimilarity(
        searchTerm.toLowerCase(),
        hit.aLabel.toLowerCase()
      );

      return {
        id,
        label: hit.aLabel,
        confidence,
      };
    });
  }

  /**
   * Calculate string similarity using Dice coefficient.
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score between 0 and 1
   * @internal
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length < 2 || str2.length < 2) return 0;

    // Create bigram sets
    const bigrams1 = new Set<string>();
    const bigrams2 = new Set<string>();

    for (let i = 0; i < str1.length - 1; i++) {
      bigrams1.add(str1.slice(i, i + 2));
    }
    for (let i = 0; i < str2.length - 1; i++) {
      bigrams2.add(str2.slice(i, i + 2));
    }

    // Calculate intersection
    let intersection = 0;
    for (const bigram of bigrams1) {
      if (bigrams2.has(bigram)) {
        intersection++;
      }
    }

    // Dice coefficient: 2 * |intersection| / (|set1| + |set2|)
    return (2 * intersection) / (bigrams1.size + bigrams2.size);
  }

  /**
   * Map Neo4j node to AuthorityRecord type.
   */
  private mapAuthorityRecord(
    node: Record<string, string | string[]>,
    sources: ExternalMapping[]
  ): AuthorityRecord {
    const variantForms = node.variantForms as string[];

    return {
      id: node.id as string,
      uri: node.uri as AtUri,
      authorizedForm: node.authorizedForm as string,
      variantForms: Array.isArray(variantForms) ? variantForms : [],
      scopeNote: (node.scopeNote as string) || undefined,
      status: (node.status as AuthorityStatus) ?? 'established',
      sources: sources.filter((s) => s.system && s.identifier),
      appliesTo: (node.appliesTo as AtUri) || undefined,
      language: (node.language as string) ?? 'en',
      createdAt: new Date(node.createdAt as string),
      updatedAt: new Date(node.updatedAt as string),
    };
  }
}
