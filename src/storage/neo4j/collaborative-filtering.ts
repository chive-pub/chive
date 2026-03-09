/**
 * Collaborative filtering storage for Neo4j.
 *
 * @remarks
 * Implements item-based collaborative filtering using Neo4j GDS nodeSimilarity
 * on a user-paper bipartite graph. User interactions (views, bookmarks,
 * endorsements) are aggregated into weighted INTERACTED_WITH edges, and GDS
 * computes weighted Jaccard similarity between Eprint nodes to produce
 * CF_SIMILAR edges for fast recommendation queries.
 *
 * **ATProto Compliance**: All data stored here is derived from indexed
 * interactions and is fully rebuildable. The CF_SIMILAR edges are an index,
 * not a source of truth.
 *
 * @example
 * ```typescript
 * const cfStore = new CollaborativeFilteringStore({ connection, logger });
 *
 * // Sync aggregated interactions
 * await cfStore.syncInteractions(interactions);
 *
 * // Compute item similarity
 * const { relationshipsCreated } = await cfStore.computeSimilarity();
 *
 * // Query similar papers
 * const similar = await cfStore.getSimilarPapers(eprintUri);
 *
 * // Get user recommendations
 * const recs = await cfStore.getRecommendationsForUser(userDid);
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import neo4j from 'neo4j-driver';

import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type { Neo4jConnection } from './connection.js';

/**
 * Pre-aggregated user-paper interaction with a confidence weight.
 *
 * @remarks
 * The weight represents the aggregated confidence from multiple interaction
 * types (views, bookmarks, endorsements) for a single user-paper pair.
 */
export interface AggregatedInteraction {
  readonly userDid: string;
  readonly eprintUri: string;
  readonly weight: number;
}

/**
 * A paper matched by collaborative filtering similarity.
 */
export interface CollaborativeMatch {
  readonly uri: string;
  readonly score: number;
}

/**
 * Options for similarity computation.
 */
export interface SimilarityOptions {
  /** Maximum similar items per node (default: 20). */
  readonly topK?: number;
  /** Minimum similarity threshold (default: 0.05). */
  readonly similarityCutoff?: number;
}

/**
 * Constructor dependencies for CollaborativeFilteringStore.
 */
export interface CollaborativeFilteringDeps {
  readonly connection: Neo4jConnection;
  readonly logger: ILogger;
}

/** Batch size for UNWIND operations. */
const BATCH_SIZE = 500;

/** Default topK for similarity computation. */
const DEFAULT_TOP_K = 20;

/** Default similarity cutoff. */
const DEFAULT_SIMILARITY_CUTOFF = 0.05;

/** Default limit for query results. */
const DEFAULT_LIMIT = 20;

/** GDS graph projection name for collaborative filtering. */
const CF_GRAPH_NAME = 'cf-user-paper';

/**
 * Collaborative filtering storage using Neo4j GDS nodeSimilarity.
 *
 * @remarks
 * Manages a user-paper bipartite graph with weighted INTERACTED_WITH edges.
 * Uses GDS nodeSimilarity to compute item-item similarity (CF_SIMILAR edges)
 * between Eprint nodes based on shared user interaction patterns.
 *
 * Typical workflow:
 * 1. Sync aggregated interactions with {@link syncInteractions}
 * 2. Compute similarity with {@link computeSimilarity}
 * 3. Query results with {@link getSimilarPapers} or {@link getRecommendationsForUser}
 *
 * @public
 */
export class CollaborativeFilteringStore {
  private readonly connection: Neo4jConnection;
  private readonly logger: ILogger;

  /**
   * Creates a new CollaborativeFilteringStore.
   *
   * @param deps - Neo4j connection and logger
   */
  constructor(deps: CollaborativeFilteringDeps) {
    this.connection = deps.connection;
    this.logger = deps.logger;
  }

  /**
   * Syncs pre-aggregated user-paper interactions to Neo4j.
   *
   * @param interactions - aggregated interactions to upsert
   *
   * @remarks
   * Upserts `(:User)-[:INTERACTED_WITH {weight}]->(:Eprint)` relationships
   * using MERGE. Processes in batches of 500 with UNWIND to avoid transaction
   * timeouts on large datasets.
   *
   * User and Eprint nodes are created via MERGE if they do not already exist.
   *
   * @example
   * ```typescript
   * await cfStore.syncInteractions([
   *   { userDid: 'did:plc:abc', eprintUri: 'at://did:plc:xyz/pub.chive.eprint.submission/1', weight: 0.8 },
   *   { userDid: 'did:plc:abc', eprintUri: 'at://did:plc:xyz/pub.chive.eprint.submission/2', weight: 0.3 },
   * ]);
   * ```
   */
  async syncInteractions(interactions: readonly AggregatedInteraction[]): Promise<void> {
    if (interactions.length === 0) {
      return;
    }

    const query = `
      UNWIND $interactions AS interaction
      MERGE (u:User {did: interaction.userDid})
      MERGE (e:Node:Object:Eprint {uri: interaction.eprintUri})
      ON CREATE SET e.subkind = 'eprint'
      MERGE (u)-[r:INTERACTED_WITH]->(e)
      ON CREATE SET r.weight = interaction.weight,
                    r.createdAt = datetime()
      ON MATCH SET r.weight = interaction.weight,
                   r.updatedAt = datetime()
    `;

    try {
      for (let i = 0; i < interactions.length; i += BATCH_SIZE) {
        const batch = interactions.slice(i, i + BATCH_SIZE);
        const batchData = batch.map((ia) => ({
          userDid: ia.userDid,
          eprintUri: ia.eprintUri,
          weight: ia.weight,
        }));

        await this.connection.executeQuery(query, { interactions: batchData });
      }

      this.logger.info('Synced collaborative filtering interactions', {
        count: interactions.length,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('QUERY', `Failed to sync CF interactions: ${error.message}`, error);
    }
  }

  /**
   * Computes item similarity between Eprint nodes using GDS nodeSimilarity.
   *
   * @param options - similarity computation options
   * @returns the number of CF_SIMILAR relationships created
   *
   * @remarks
   * Steps:
   * 1. Drops any existing graph projection
   * 2. Projects a bipartite graph of User and Eprint nodes connected by
   *    INTERACTED_WITH edges (with weight property)
   * 3. Runs `gds.nodeSimilarity.write` with weighted Jaccard similarity
   * 4. Writes CF_SIMILAR relationships with a `score` property
   * 5. Drops the graph projection
   *
   * @example
   * ```typescript
   * const { relationshipsCreated } = await cfStore.computeSimilarity({
   *   topK: 30,
   *   similarityCutoff: 0.1,
   * });
   * console.log(`Created ${relationshipsCreated} similarity edges`);
   * ```
   */
  async computeSimilarity(options?: SimilarityOptions): Promise<{ relationshipsCreated: number }> {
    const topK = options?.topK ?? DEFAULT_TOP_K;
    const similarityCutoff = options?.similarityCutoff ?? DEFAULT_SIMILARITY_CUTOFF;

    const session = this.connection.getSession();

    try {
      // Step 1: Drop existing projection if it exists
      await session.run('CALL gds.graph.drop($name, false) YIELD graphName RETURN graphName', {
        name: CF_GRAPH_NAME,
      });

      // Step 2: Create bipartite graph projection with weight property
      await session.run(
        `
        CALL gds.graph.project(
          $name,
          ['User', 'Eprint'],
          {
            INTERACTED_WITH: {
              type: 'INTERACTED_WITH',
              properties: {
                weight: { property: 'weight', defaultValue: 1.0 }
              }
            }
          }
        )
        YIELD graphName, nodeCount, relationshipCount
        RETURN graphName, nodeCount, relationshipCount
        `,
        { name: CF_GRAPH_NAME }
      );

      // Step 3: Run nodeSimilarity.write with weighted Jaccard
      const result = await session.run(
        `
        CALL gds.nodeSimilarity.write($name, {
          topK: $topK,
          similarityCutoff: $similarityCutoff,
          relationshipWeightProperty: 'weight',
          writeRelationshipType: 'CF_SIMILAR',
          writeProperty: 'score'
        })
        YIELD nodesCompared, relationshipsWritten
        RETURN nodesCompared, relationshipsWritten
        `,
        {
          name: CF_GRAPH_NAME,
          topK: neo4j.int(topK),
          similarityCutoff,
        }
      );

      const record = result.records[0];
      const relationshipsCreated = record ? Number(record.get('relationshipsWritten')) : 0;
      const nodesCompared = record ? Number(record.get('nodesCompared')) : 0;

      this.logger.info('Computed collaborative filtering similarity', {
        nodesCompared,
        relationshipsCreated,
        topK,
        similarityCutoff,
      });

      return { relationshipsCreated };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('QUERY', `Failed to compute CF similarity: ${error.message}`, error);
    } finally {
      // Step 4: Drop the projection (cleanup even on error)
      try {
        await session.run('CALL gds.graph.drop($name, false) YIELD graphName RETURN graphName', {
          name: CF_GRAPH_NAME,
        });
      } catch {
        // Projection may not exist if creation failed; ignore
      }
      await session.close();
    }
  }

  /**
   * Queries papers similar to a given eprint via collaborative filtering.
   *
   * @param eprintUri - AT-URI of the source eprint
   * @param limit - maximum results (default: 20)
   * @returns similar papers ordered by score descending
   *
   * @example
   * ```typescript
   * const similar = await cfStore.getSimilarPapers(
   *   'at://did:plc:abc/pub.chive.eprint.submission/1',
   *   10
   * );
   * for (const match of similar) {
   *   console.log(`${match.uri}: ${match.score.toFixed(3)}`);
   * }
   * ```
   */
  async getSimilarPapers(
    eprintUri: string,
    limit: number = DEFAULT_LIMIT
  ): Promise<readonly CollaborativeMatch[]> {
    const query = `
      MATCH (source:Node:Object:Eprint {uri: $eprintUri})-[r:CF_SIMILAR]->(similar:Node:Object:Eprint)
      WHERE source.subkind = 'eprint' AND similar.subkind = 'eprint'
      RETURN similar.uri AS uri, r.score AS score
      ORDER BY r.score DESC
      LIMIT $limit
    `;

    try {
      const result = await this.connection.executeQuery<Record<string, unknown>>(query, {
        eprintUri,
        limit: neo4j.int(limit),
      });

      return result.records.map((record) => ({
        uri: record.get('uri') as string,
        score: record.get('score') as number,
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError('QUERY', `Failed to get CF similar papers: ${error.message}`, error);
    }
  }

  /**
   * Gets collaborative filtering recommendations for a user.
   *
   * @param userDid - DID of the user
   * @param limit - maximum results (default: 20)
   * @returns recommended papers ordered by combined score descending
   *
   * @remarks
   * Finds papers similar to papers the user has interacted with, excluding
   * papers they have already engaged with. The score combines the CF_SIMILAR
   * similarity score with a path diversity boost: papers reached through
   * multiple engaged papers are ranked higher.
   *
   * @example
   * ```typescript
   * const recs = await cfStore.getRecommendationsForUser('did:plc:abc', 10);
   * for (const rec of recs) {
   *   console.log(`Recommended: ${rec.uri} (score: ${rec.score.toFixed(3)})`);
   * }
   * ```
   */
  async getRecommendationsForUser(
    userDid: string,
    limit: number = DEFAULT_LIMIT
  ): Promise<readonly CollaborativeMatch[]> {
    const query = `
      MATCH (user:User {did: $userDid})-[:INTERACTED_WITH]->(engaged:Eprint)
            -[r:CF_SIMILAR]->(candidate:Eprint)
      WHERE NOT (user)-[:INTERACTED_WITH]->(candidate)
      WITH candidate, max(r.score) AS cfScore, count(DISTINCT engaged) AS pathCount
      RETURN candidate.uri AS uri, cfScore * (1 + log(1 + pathCount)) AS score
      ORDER BY score DESC
      LIMIT $limit
    `;

    try {
      const result = await this.connection.executeQuery<Record<string, unknown>>(query, {
        userDid,
        limit: neo4j.int(limit),
      });

      return result.records.map((record) => ({
        uri: record.get('uri') as string,
        score: record.get('score') as number,
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError(
        'QUERY',
        `Failed to get CF recommendations for user: ${error.message}`,
        error
      );
    }
  }

  /**
   * Deletes all CF_SIMILAR relationships from the graph.
   *
   * @remarks
   * Use before recomputing similarity to ensure stale edges are removed.
   * The {@link computeSimilarity} method writes new edges but does not
   * remove edges from previous runs that may no longer meet the cutoff.
   *
   * @example
   * ```typescript
   * await cfStore.clearSimilarityEdges();
   * await cfStore.computeSimilarity();
   * ```
   */
  async clearSimilarityEdges(): Promise<void> {
    const query = `
      MATCH ()-[r:CF_SIMILAR]->()
      DELETE r
    `;

    try {
      await this.connection.executeQuery(query);
      this.logger.info('Cleared all CF_SIMILAR edges');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new DatabaseError(
        'QUERY',
        `Failed to clear CF similarity edges: ${error.message}`,
        error
      );
    }
  }
}
