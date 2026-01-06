/**
 * Citation graph storage for Neo4j.
 *
 * @remarks
 * This module implements the {@link ICitationGraph} interface for storing
 * and querying citation relationships between Chive preprints in Neo4j.
 *
 * **Critical Constraint**: Only stores citations where BOTH the citing and
 * cited papers are indexed in Chive. External citations from Semantic Scholar
 * or OpenAlex are used as signals to discover these relationships, but we
 * only persist Chive-to-Chive edges.
 *
 * **ATProto Compliance**: All citation data is rebuildable from external
 * sources (Semantic Scholar, OpenAlex). The Neo4j graph is an index,
 * not a source of truth.
 *
 * @example
 * ```typescript
 * const citationGraph = container.resolve(CitationGraph);
 *
 * // Index citations discovered from S2
 * await citationGraph.upsertCitationsBatch([
 *   {
 *     citingUri: 'at://did:plc:abc/pub.chive.preprint.submission/1',
 *     citedUri: 'at://did:plc:xyz/pub.chive.preprint.submission/2',
 *     isInfluential: true,
 *     source: 'semantic-scholar',
 *   },
 * ]);
 *
 * // Query co-cited papers
 * const coCited = await citationGraph.findCoCitedPapers(preprintUri, 3);
 * ```
 *
 * @see {@link https://api.semanticscholar.org/api-docs/graph#tag/Paper-Data | Semantic Scholar Citations API}
 * @see {@link https://docs.openalex.org/api-entities/works/work-object#cited_by_count | OpenAlex Citations}
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type {
  CitationQueryOptions,
  CitationQueryResult,
  CitationRelationship,
  CoCitedPaper,
  ICitationGraph,
} from '../../types/interfaces/discovery.interface.js';

import { Neo4jConnection } from './connection.js';

/**
 * Neo4j record value type.
 *
 * @remarks
 * With `disableLosslessIntegers: true` configured on the driver,
 * all integers are returned as native JavaScript numbers.
 */
type Neo4jValue = string | number | boolean | null | string[];

/**
 * Citation graph storage implementation for Neo4j.
 *
 * @remarks
 * Manages CITES relationships between Preprint nodes in Neo4j. Provides
 * efficient queries for:
 * - Direct citations (citing papers, references)
 * - Co-citation analysis (papers frequently cited together)
 * - Citation statistics
 *
 * **Schema**:
 * ```cypher
 * (:Preprint {uri: string})-[:CITES {
 *   isInfluential: boolean,
 *   source: string,
 *   discoveredAt: datetime
 * }]->(:Preprint {uri: string})
 * ```
 *
 * **Indexes** (created by setup.ts):
 * - `CREATE INDEX preprint_uri FOR (p:Preprint) ON (p.uri)`
 * - `CREATE INDEX preprint_doi FOR (p:Preprint) ON (p.doi)`
 *
 * @example
 * Batch upsert citations:
 * ```typescript
 * await citationGraph.upsertCitationsBatch([
 *   { citingUri, citedUri, isInfluential: true, source: 'semantic-scholar' },
 *   { citingUri, citedUri: anotherUri, source: 'openalex' },
 * ]);
 * ```
 *
 * @example
 * Find co-cited papers:
 * ```typescript
 * const coCited = await citationGraph.findCoCitedPapers(preprintUri, 3);
 * for (const paper of coCited) {
 *   console.log(`${paper.title}: ${paper.coCitationCount} co-citations`);
 * }
 * ```
 *
 * @public
 * @since 0.1.0
 */
@singleton()
export class CitationGraph implements ICitationGraph {
  /**
   * Creates a new CitationGraph instance.
   *
   * @param connection - Neo4j connection manager
   */
  constructor(private readonly connection: Neo4jConnection) {}

  /**
   * Upserts a batch of citations into the graph.
   *
   * @param citations - Citations to upsert
   *
   * @remarks
   * Uses MERGE to create or update CITES edges. Deduplicates based on
   * (citingUri, citedUri) pair. If both papers don't exist as Preprint
   * nodes, the citation is silently skipped (we only store Chive-to-Chive).
   *
   * For large batches (1000+), consider calling in chunks to avoid
   * transaction timeouts.
   *
   * @example
   * ```typescript
   * await citationGraph.upsertCitationsBatch([
   *   {
   *     citingUri: 'at://did:plc:abc/pub.chive.preprint.submission/1',
   *     citedUri: 'at://did:plc:xyz/pub.chive.preprint.submission/2',
   *     isInfluential: true,
   *     source: 'semantic-scholar',
   *   },
   * ]);
   * ```
   */
  async upsertCitationsBatch(citations: readonly CitationRelationship[]): Promise<void> {
    if (citations.length === 0) {
      return;
    }

    // Use UNWIND for efficient batch processing
    // Only create edge if BOTH preprints exist in Chive
    const query = `
      UNWIND $citations AS citation
      MATCH (citing:Preprint {uri: citation.citingUri})
      MATCH (cited:Preprint {uri: citation.citedUri})
      MERGE (citing)-[r:CITES]->(cited)
      SET r.isInfluential = citation.isInfluential,
          r.source = citation.source,
          r.discoveredAt = CASE
            WHEN r.discoveredAt IS NULL THEN datetime()
            ELSE r.discoveredAt
          END,
          r.updatedAt = datetime()
    `;

    const citationData = citations.map((c) => ({
      citingUri: c.citingUri,
      citedUri: c.citedUri,
      isInfluential: c.isInfluential ?? false,
      source: c.source,
    }));

    try {
      await this.connection.executeQuery(query, { citations: citationData });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('QUERY', `Failed to upsert citations: ${error.message}`, error);
    }
  }

  /**
   * Gets papers that cite a given preprint.
   *
   * @param paperUri - AT-URI of the cited preprint
   * @param options - Query options
   * @returns Papers that cite the given preprint
   *
   * @remarks
   * Returns all Chive preprints that have a CITES edge pointing to
   * the specified paper. Results are ordered by discovery date (newest first).
   *
   * @example
   * ```typescript
   * const result = await citationGraph.getCitingPapers(preprintUri, {
   *   limit: 20,
   *   onlyInfluential: true,
   * });
   *
   * console.log(`${result.total} papers cite this preprint`);
   * for (const citation of result.citations) {
   *   console.log(`Cited by: ${citation.citingUri}`);
   * }
   * ```
   */
  async getCitingPapers(
    paperUri: AtUri,
    options?: CitationQueryOptions
  ): Promise<CitationQueryResult> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const influentialFilter = options?.onlyInfluential ? 'AND r.isInfluential = true' : '';

    const query = `
      MATCH (citing:Preprint)-[r:CITES]->(cited:Preprint {uri: $paperUri})
      WHERE true ${influentialFilter}
      WITH citing, r, cited
      ORDER BY r.discoveredAt DESC
      SKIP $offset
      LIMIT $limit
      RETURN citing.uri AS citingUri,
             cited.uri AS citedUri,
             r.isInfluential AS isInfluential,
             r.source AS source,
             toString(r.discoveredAt) AS discoveredAt
    `;

    const countQuery = `
      MATCH (citing:Preprint)-[r:CITES]->(cited:Preprint {uri: $paperUri})
      WHERE true ${influentialFilter}
      RETURN count(r) AS total
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        this.connection.executeQuery<Record<string, Neo4jValue>>(query, {
          paperUri,
          limit: neo4j.int(limit),
          offset: neo4j.int(offset),
        }),
        this.connection.executeQuery<Record<string, Neo4jValue>>(countQuery, { paperUri }),
      ]);

      const citations = dataResult.records.map((record) => this.mapCitationRecord(record));

      const total = (countResult.records[0]?.get('total') as number) ?? 0;

      return {
        citations,
        total,
        hasMore: offset + citations.length < total,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('QUERY', `Failed to get citing papers: ${error.message}`, error);
    }
  }

  /**
   * Gets papers that a given preprint cites (references).
   *
   * @param paperUri - AT-URI of the citing preprint
   * @param options - Query options
   * @returns Papers referenced by the given preprint
   *
   * @remarks
   * Returns all Chive preprints that the specified paper has a CITES
   * edge pointing to. Results are ordered by discovery date (newest first).
   *
   * @example
   * ```typescript
   * const result = await citationGraph.getReferences(preprintUri, { limit: 50 });
   *
   * console.log(`This preprint cites ${result.total} other preprints`);
   * ```
   */
  async getReferences(
    paperUri: AtUri,
    options?: CitationQueryOptions
  ): Promise<CitationQueryResult> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const influentialFilter = options?.onlyInfluential ? 'AND r.isInfluential = true' : '';

    const query = `
      MATCH (citing:Preprint {uri: $paperUri})-[r:CITES]->(cited:Preprint)
      WHERE true ${influentialFilter}
      WITH citing, r, cited
      ORDER BY r.discoveredAt DESC
      SKIP $offset
      LIMIT $limit
      RETURN citing.uri AS citingUri,
             cited.uri AS citedUri,
             r.isInfluential AS isInfluential,
             r.source AS source,
             toString(r.discoveredAt) AS discoveredAt
    `;

    const countQuery = `
      MATCH (citing:Preprint {uri: $paperUri})-[r:CITES]->(cited:Preprint)
      WHERE true ${influentialFilter}
      RETURN count(r) AS total
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        this.connection.executeQuery<Record<string, Neo4jValue>>(query, {
          paperUri,
          limit: neo4j.int(limit),
          offset: neo4j.int(offset),
        }),
        this.connection.executeQuery<Record<string, Neo4jValue>>(countQuery, { paperUri }),
      ]);

      const citations = dataResult.records.map((record) => this.mapCitationRecord(record));

      const total = (countResult.records[0]?.get('total') as number) ?? 0;

      return {
        citations,
        total,
        hasMore: offset + citations.length < total,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('QUERY', `Failed to get references: ${error.message}`, error);
    }
  }

  /**
   * Finds papers frequently cited together with a given preprint.
   *
   * @param paperUri - AT-URI of the source preprint
   * @param minCoCitations - Minimum co-citation count threshold (default: 2)
   * @returns Papers co-cited with the source, sorted by strength
   *
   * @remarks
   * Uses bibliographic coupling algorithm to find papers that share
   * citing papers with the query paper. The strength score is normalized
   * based on the total citations of both papers.
   *
   * **Algorithm**:
   * 1. Find all papers P that cite the query paper Q
   * 2. For each P, find other papers R that P also cites
   * 3. Count how many times Q and R are cited together
   * 4. Normalize by sqrt(citations(Q) * citations(R))
   *
   * @example
   * ```typescript
   * const coCited = await citationGraph.findCoCitedPapers(preprintUri, 3);
   *
   * for (const paper of coCited) {
   *   console.log(`${paper.title}: co-cited ${paper.coCitationCount} times`);
   *   console.log(`  Strength: ${paper.strength.toFixed(3)}`);
   * }
   * ```
   */
  async findCoCitedPapers(paperUri: AtUri, minCoCitations = 2): Promise<readonly CoCitedPaper[]> {
    // Find papers that share citing papers with the query paper
    // This is co-citation analysis: papers frequently cited together
    const query = `
      MATCH (q:Preprint {uri: $paperUri})<-[:CITES]-(citingPaper:Preprint)-[:CITES]->(coCited:Preprint)
      WHERE q <> coCited
      WITH coCited, count(DISTINCT citingPaper) AS coCitationCount
      WHERE coCitationCount >= $minCoCitations

      // Get citation counts for normalization
      OPTIONAL MATCH (q:Preprint {uri: $paperUri})<-[qCites:CITES]-()
      WITH coCited, coCitationCount, count(DISTINCT qCites) AS qCitedBy

      OPTIONAL MATCH (coCited)<-[cCites:CITES]-()
      WITH coCited, coCitationCount, qCitedBy, count(DISTINCT cCites) AS coCitedBy

      // Calculate normalized strength (Salton's cosine)
      WITH coCited,
           coCitationCount,
           CASE
             WHEN qCitedBy * coCitedBy = 0 THEN 0.0
             ELSE toFloat(coCitationCount) / sqrt(toFloat(qCitedBy * coCitedBy))
           END AS strength

      ORDER BY coCitationCount DESC, strength DESC
      LIMIT 50

      RETURN coCited.uri AS uri,
             coCited.title AS title,
             coCited.abstract AS abstract,
             coCited.categories AS categories,
             toString(coCited.publicationDate) AS publicationDate,
             coCitationCount,
             strength
    `;

    try {
      const result = await this.connection.executeQuery<Record<string, Neo4jValue>>(query, {
        paperUri,
        minCoCitations: neo4j.int(minCoCitations),
      });

      return result.records.map((record) => this.mapCoCitedRecord(record));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('QUERY', `Failed to find co-cited papers: ${error.message}`, error);
    }
  }

  /**
   * Gets citation counts for a preprint.
   *
   * @param paperUri - AT-URI of the preprint
   * @returns Citation statistics
   *
   * @remarks
   * Returns counts for:
   * - `citedByCount`: Number of Chive preprints citing this paper
   * - `referencesCount`: Number of Chive preprints this paper cites
   * - `influentialCitedByCount`: Influential citations (from Semantic Scholar)
   *
   * @example
   * ```typescript
   * const counts = await citationGraph.getCitationCounts(preprintUri);
   * console.log(`Cited by: ${counts.citedByCount}`);
   * console.log(`References: ${counts.referencesCount}`);
   * console.log(`Influential: ${counts.influentialCitedByCount}`);
   * ```
   */
  async getCitationCounts(paperUri: AtUri): Promise<{
    readonly citedByCount: number;
    readonly referencesCount: number;
    readonly influentialCitedByCount: number;
  }> {
    const query = `
      MATCH (p:Preprint {uri: $paperUri})
      OPTIONAL MATCH (p)<-[citedBy:CITES]-()
      OPTIONAL MATCH (p)-[refs:CITES]->()
      OPTIONAL MATCH (p)<-[influential:CITES {isInfluential: true}]-()
      RETURN count(DISTINCT citedBy) AS citedByCount,
             count(DISTINCT refs) AS referencesCount,
             count(DISTINCT influential) AS influentialCitedByCount
    `;

    try {
      const result = await this.connection.executeQuery<Record<string, Neo4jValue>>(query, {
        paperUri,
      });

      const record = result.records[0];
      if (!record) {
        return {
          citedByCount: 0,
          referencesCount: 0,
          influentialCitedByCount: 0,
        };
      }

      return {
        citedByCount: (record.get('citedByCount') as number) ?? 0,
        referencesCount: (record.get('referencesCount') as number) ?? 0,
        influentialCitedByCount: (record.get('influentialCitedByCount') as number) ?? 0,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('QUERY', `Failed to get citation counts: ${error.message}`, error);
    }
  }

  /**
   * Deletes all citations for a preprint.
   *
   * @param paperUri - AT-URI of the preprint
   *
   * @remarks
   * Removes all CITES edges where the paper is either citing or cited.
   * Used when a preprint is removed from Chive's index.
   *
   * **Note**: This only deletes the edges, not the Preprint node itself.
   * Node deletion is handled by the indexing pipeline.
   *
   * @example
   * ```typescript
   * // When a preprint is removed from the index
   * await citationGraph.deleteCitationsForPaper(preprintUri);
   * ```
   */
  async deleteCitationsForPaper(paperUri: AtUri): Promise<void> {
    const query = `
      MATCH (p:Preprint {uri: $paperUri})
      OPTIONAL MATCH (p)-[r:CITES]-()
      DELETE r
    `;

    try {
      await this.connection.executeQuery(query, { paperUri });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError(
        'QUERY',
        `Failed to delete citations for paper: ${error.message}`,
        error
      );
    }
  }

  /**
   * Maps a Neo4j citation record to CitationRelationship.
   */
  private mapCitationRecord(record: { get: (key: string) => Neo4jValue }): CitationRelationship {
    const discoveredAt = record.get('discoveredAt') as string | null;

    return {
      citingUri: record.get('citingUri') as AtUri,
      citedUri: record.get('citedUri') as AtUri,
      isInfluential: (record.get('isInfluential') as boolean | null) ?? undefined,
      source: record.get('source') as 'semantic-scholar' | 'openalex' | 'user-provided',
      discoveredAt: discoveredAt ? new Date(discoveredAt) : undefined,
    };
  }

  /**
   * Maps a Neo4j co-cited record to CoCitedPaper.
   */
  private mapCoCitedRecord(record: { get: (key: string) => Neo4jValue }): CoCitedPaper {
    const categories = record.get('categories') as string[] | null;
    const publicationDateStr = record.get('publicationDate') as string | null;

    return {
      uri: record.get('uri') as AtUri,
      title: record.get('title') as string,
      abstract: (record.get('abstract') as string | null) ?? undefined,
      categories: categories ?? undefined,
      publicationDate: publicationDateStr ? new Date(publicationDateStr) : undefined,
      coCitationCount: record.get('coCitationCount') as number,
      strength: record.get('strength') as number,
    };
  }
}
