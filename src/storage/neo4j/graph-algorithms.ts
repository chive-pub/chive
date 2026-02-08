/**
 * Graph algorithms using Neo4j Graph Data Science (GDS) library.
 *
 * @remarks
 * Provides wrappers around Neo4j GDS library procedures for:
 * - Pathfinding (Dijkstra, A*, shortest path)
 * - Centrality measures (PageRank, betweenness, degree)
 * - Recommendations (node similarity, collaborative filtering)
 * - Community detection (Louvain, label propagation)
 * - Similarity computation (Jaccard, cosine, overlap)
 *
 * All algorithms use Neo4j GDS library for optimal performance.
 * See: https://neo4j.com/docs/graph-data-science/current/
 *
 * @packageDocumentation
 */

import neo4j from 'neo4j-driver';
import { inject, singleton } from 'tsyringe';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';

import type { Neo4jConnection } from './connection.js';
import type { RelationshipSlug } from './types.js';

/**
 * Path between two nodes.
 */
export interface Path {
  start: AtUri;
  end: AtUri;
  length: number;
  nodes: AtUri[];
  relationships: PathRelationship[];
  totalCost: number;
}

/**
 * Relationship in a path.
 */
export interface PathRelationship {
  from: AtUri;
  to: AtUri;
  type: RelationshipSlug;
  weight: number;
}

/**
 * PageRank result.
 */
export interface PageRankResult {
  uri: AtUri;
  score: number;
  rank: number;
}

/**
 * Betweenness centrality result.
 */
export interface BetweennessCentrality {
  uri: AtUri;
  score: number;
  rank: number;
}

/**
 * Degree centrality result.
 */
export interface DegreeCentrality {
  uri: AtUri;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

/**
 * Recommendation result.
 */
export interface Recommendation {
  uri: AtUri;
  label: string;
  score: number;
  reason: string;
}

/**
 * Community detection result.
 */
export interface Community {
  communityId: number;
  members: AtUri[];
  size: number;
}

/**
 * Community membership.
 */
export interface CommunityMembership {
  uri: AtUri;
  communityId: number;
}

/**
 * Similarity result.
 */
export interface SimilarityResult {
  node1: AtUri;
  node2: AtUri;
  similarity: number;
}

/**
 * Paper similarity result based on co-citation analysis.
 */
export interface PaperSimilarity {
  paperUri: AtUri;
  title: string;
  similarity: number;
  coCitationCount: number;
}

/**
 * Link prediction result.
 */
export interface LinkPrediction {
  node1: AtUri;
  node2: AtUri;
  score: number;
  algorithm: 'adamic-adar' | 'common-neighbors' | 'preferential-attachment';
}

/**
 * Collaboration prediction result.
 */
export interface CollaborationPrediction {
  author1Did: DID;
  author1Name: string;
  author2Did: DID;
  author2Name: string;
  score: number;
  commonCoauthors: number;
  commonFields: number;
}

/**
 * Graph projection configuration.
 */
export interface GraphProjection {
  name: string;
  nodeLabels: string[];
  relationshipTypes: string[];
  relationshipProperties?: string[];
}

/**
 * Graph algorithms service using Neo4j GDS library.
 *
 * @remarks
 * Wraps Neo4j Graph Data Science library procedures for graph analysis.
 * All algorithms operate on in-memory graph projections for performance.
 *
 * Typical workflow:
 * 1. Create graph projection with projectGraph()
 * 2. Run algorithms on projection
 * 3. Drop projection with dropGraph()
 *
 * @example
 * ```typescript
 * const algorithms = container.resolve(GraphAlgorithms);
 *
 * // Create graph projection
 * await algorithms.projectGraph({
 *   name: 'fields-graph',
 *   nodeLabels: ['FieldNode'],
 *   relationshipTypes: ['RELATED_TO', 'SUBFIELD_OF']
 * });
 *
 * // Calculate PageRank
 * const rankings = await algorithms.pageRank('fields-graph');
 *
 * // Clean up
 * await algorithms.dropGraph('fields-graph');
 * ```
 */
@singleton()
export class GraphAlgorithms {
  constructor(@inject('Neo4jConnection') private readonly connection: Neo4jConnection) {}

  /**
   * Create in-memory graph projection.
   *
   * @param config - Graph projection configuration
   * @returns Graph projection info
   *
   * @example
   * ```typescript
   * await algorithms.projectGraph({
   *   name: 'knowledge-graph',
   *   nodeLabels: ['Field', 'Eprint'],
   *   relationshipTypes: ['RELATED_TO', 'CLASSIFIED_AS'],
   *   relationshipProperties: ['weight']
   * });
   * ```
   */
  async projectGraph(config: GraphProjection): Promise<{
    graphName: string;
    nodeCount: number;
    relationshipCount: number;
  }> {
    const { name, nodeLabels, relationshipTypes, relationshipProperties = [] } = config;

    const nodeProjection = nodeLabels.join('|');
    const relProjection = relationshipTypes
      .map((type) => {
        if (relationshipProperties.length > 0) {
          const props = relationshipProperties.map((p) => `${p}: {property: '${p}'}`).join(', ');
          return `${type}: {type: '${type}', properties: {${props}}}`;
        }
        return `${type}: {type: '${type}'}`;
      })
      .join(', ');

    const query = `
      CALL gds.graph.project(
        $graphName,
        '${nodeProjection}',
        {${relProjection}}
      )
      YIELD graphName, nodeCount, relationshipCount
      RETURN graphName, nodeCount, relationshipCount
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName: name });
      const record = result.records[0];

      if (!record) {
        throw new DatabaseError('CREATE', `Failed to create graph projection: ${name}`);
      }

      return {
        graphName: record.get('graphName') as string,
        nodeCount: Number(record.get('nodeCount')),
        relationshipCount: Number(record.get('relationshipCount')),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Drop graph projection from memory.
   *
   * @param graphName - Name of graph projection
   *
   * @example
   * ```typescript
   * await algorithms.dropGraph('knowledge-graph');
   * ```
   */
  async dropGraph(graphName: string): Promise<void> {
    const query = `
      CALL gds.graph.drop($graphName, false)
      YIELD graphName
      RETURN graphName
    `;

    const session = this.connection.getSession();

    try {
      await session.run(query, { graphName });
    } finally {
      await session.close();
    }
  }

  /**
   * List existing graph projections.
   *
   * @returns List of graph projections
   */
  async listGraphs(): Promise<{ name: string; nodeCount: number; relationshipCount: number }[]> {
    const query = `
      CALL gds.graph.list()
      YIELD graphName, nodeCount, relationshipCount
      RETURN graphName AS name, nodeCount, relationshipCount
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query);

      return result.records.map((record) => ({
        name: record.get('name') as string,
        nodeCount: Number(record.get('nodeCount')),
        relationshipCount: Number(record.get('relationshipCount')),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Calculate PageRank using Neo4j GDS.
   *
   * @param graphName - Graph projection name
   * @param config - PageRank configuration
   * @returns PageRank scores
   *
   * @example
   * ```typescript
   * const rankings = await algorithms.pageRank('fields-graph', {
   *   maxIterations: 20,
   *   dampingFactor: 0.85
   * });
   * console.log(`Top field: ${rankings[0].uri}`);
   * ```
   */
  async pageRank(
    graphName: string,
    config: { maxIterations?: number; dampingFactor?: number; tolerance?: number } = {}
  ): Promise<PageRankResult[]> {
    const { maxIterations = 20, dampingFactor = 0.85, tolerance = 0.0000001 } = config;

    const query = `
      CALL gds.pageRank.stream($graphName, {
        maxIterations: $maxIterations,
        dampingFactor: $dampingFactor,
        tolerance: $tolerance
      })
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId) AS node, score
      RETURN node.uri AS uri, score
      ORDER BY score DESC
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, {
        graphName,
        maxIterations: neo4j.int(maxIterations),
        dampingFactor,
        tolerance,
      });

      return result.records.map((record, index) => ({
        uri: record.get('uri') as AtUri,
        score: Number(record.get('score')),
        rank: index + 1,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Calculate betweenness centrality using Neo4j GDS.
   *
   * @param graphName - Graph projection name
   * @returns Betweenness centrality scores
   *
   * @example
   * ```typescript
   * const centrality = await algorithms.betweenness('fields-graph');
   * ```
   */
  async betweenness(graphName: string): Promise<BetweennessCentrality[]> {
    const query = `
      CALL gds.betweenness.stream($graphName)
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId) AS node, score
      RETURN node.uri AS uri, score
      ORDER BY score DESC
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName });

      return result.records.map((record, index) => ({
        uri: record.get('uri') as AtUri,
        score: Number(record.get('score')),
        rank: index + 1,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Calculate degree centrality using Neo4j GDS.
   *
   * @param graphName - Graph projection name
   * @returns Degree centrality scores
   *
   * @example
   * ```typescript
   * const degrees = await algorithms.degreeCentrality('fields-graph');
   * ```
   */
  async degreeCentrality(graphName: string): Promise<DegreeCentrality[]> {
    const query = `
      CALL gds.degree.stream($graphName)
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId) AS node, score
      MATCH (node)
      OPTIONAL MATCH (node)<-[incoming]-()
      WITH node, score, count(incoming) AS inDegree
      OPTIONAL MATCH (node)-[outgoing]->()
      WITH node, score, inDegree, count(outgoing) AS outDegree
      RETURN
        node.uri AS uri,
        inDegree,
        outDegree,
        toInteger(score) AS totalDegree
      ORDER BY totalDegree DESC
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName });

      return result.records.map((record) => ({
        uri: record.get('uri') as AtUri,
        inDegree: Number(record.get('inDegree')),
        outDegree: Number(record.get('outDegree')),
        totalDegree: Number(record.get('totalDegree')),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Find shortest path using Dijkstra algorithm.
   *
   * @param graphName - Graph projection name
   * @param sourceUri - Source node URI
   * @param targetUri - Target node URI
   * @returns Shortest path
   *
   * @example
   * ```typescript
   * const path = await algorithms.shortestPath(
   *   'fields-graph',
   *   'at://did:plc:graph-pds/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71',
   *   'at://did:plc:graph-pds/pub.chive.graph.node/e42c83de-6d16-5876-b276-38712ac4112a'
   * );
   * console.log(`Path length: ${path.length}`);
   * ```
   */
  async shortestPath(graphName: string, sourceUri: AtUri, targetUri: AtUri): Promise<Path | null> {
    const query = `
      MATCH (source {uri: $sourceUri})
      MATCH (target {uri: $targetUri})

      CALL gds.shortestPath.dijkstra.stream($graphName, {
        sourceNode: id(source),
        targetNode: id(target)
      })
      YIELD index, sourceNode, targetNode, totalCost, nodeIds, costs, path

      WITH path, nodeIds, totalCost
      UNWIND nodeIds AS nodeId
      WITH path, totalCost, collect(gds.util.asNode(nodeId).uri) AS nodeUris

      WITH path, totalCost, nodeUris, relationships(path) AS rels
      RETURN
        nodeUris,
        [rel IN rels | {
          from: startNode(rel).uri,
          to: endNode(rel).uri,
          type: type(rel),
          weight: COALESCE(rel.weight, 1.0)
        }] AS relationships,
        size(rels) AS pathLength,
        totalCost
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName, sourceUri, targetUri });

      const record = result.records[0];
      if (!record) {
        return null;
      }

      const nodeUris = record.get('nodeUris') as string[];
      const relationships = record.get('relationships') as {
        from: string;
        to: string;
        type: string;
        weight: number;
      }[];
      const pathLength = Number(record.get('pathLength'));
      const totalCost = Number(record.get('totalCost'));

      return {
        start: sourceUri,
        end: targetUri,
        length: pathLength,
        nodes: nodeUris as AtUri[],
        relationships: relationships.map((rel) => ({
          from: rel.from as AtUri,
          to: rel.to as AtUri,
          type: rel.type as RelationshipSlug,
          weight: rel.weight,
        })),
        totalCost,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Detect communities using Louvain algorithm.
   *
   * @param graphName - Graph projection name
   * @returns Communities
   *
   * @example
   * ```typescript
   * const communities = await algorithms.louvain('fields-graph');
   * console.log(`Found ${communities.length} communities`);
   * ```
   */
  async louvain(graphName: string): Promise<Community[]> {
    const query = `
      CALL gds.louvain.stream($graphName)
      YIELD nodeId, communityId
      WITH communityId, collect(gds.util.asNode(nodeId).uri) AS members
      RETURN
        communityId,
        members,
        size(members) AS communitySize
      ORDER BY communitySize DESC
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName });

      return result.records.map((record) => ({
        communityId: Number(record.get('communityId')),
        members: record.get('members') as AtUri[],
        size: Number(record.get('communitySize')),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Calculate node similarity using Jaccard index.
   *
   * @param graphName - Graph projection name
   * @param topK - Number of similar nodes per node
   * @returns Similarity pairs
   *
   * @example
   * ```typescript
   * const similarities = await algorithms.nodeSimilarity('fields-graph', 10);
   * ```
   */
  async nodeSimilarity(graphName: string, topK = 10): Promise<SimilarityResult[]> {
    const query = `
      CALL gds.nodeSimilarity.stream($graphName, {
        topK: $topK
      })
      YIELD node1, node2, similarity
      WITH gds.util.asNode(node1) AS n1, gds.util.asNode(node2) AS n2, similarity
      RETURN
        n1.uri AS node1,
        n2.uri AS node2,
        similarity
      ORDER BY similarity DESC
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName, topK: neo4j.int(topK) });

      return result.records.map((record) => ({
        node1: record.get('node1') as AtUri,
        node2: record.get('node2') as AtUri,
        similarity: Number(record.get('similarity')),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get field recommendations for a user based on graph proximity.
   *
   * @param userDid - User DID
   * @param limit - Maximum recommendations
   * @returns Recommended fields
   *
   * @example
   * ```typescript
   * const recommendations = await algorithms.recommendFields(
   *   'did:plc:example123',
   *   10
   * );
   * ```
   */
  async recommendFields(userDid: DID, limit = 20): Promise<Recommendation[]> {
    const query = `
      MATCH (user:User {did: $userDid})-[:INTERESTED_IN|EXPERT_IN]->(userField:FieldNode)

      // Find similar fields using graph proximity
      MATCH (userField)-[:RELATED_TO|SUBFIELD_OF*1..2]-(candidate:FieldNode)
      WHERE NOT (user)-[:INTERESTED_IN|EXPERT_IN]->(candidate)

      WITH candidate, count(*) AS proximity

      // Find users with similar interests
      MATCH (user)-[:INTERESTED_IN]->(userField)<-[:INTERESTED_IN]-(otherUser:User)
      WHERE otherUser <> user
      MATCH (otherUser)-[:INTERESTED_IN]->(candidate)

      WITH candidate, proximity, count(DISTINCT otherUser) AS collaborativeScore

      WITH candidate,
           (toFloat(proximity) * 0.6 + toFloat(collaborativeScore) * 0.4) AS score
      WHERE score > 0

      RETURN
        candidate.uri AS uri,
        candidate.label AS label,
        score,
        'graph-proximity' AS reason
      ORDER BY score DESC
      LIMIT $limit
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { userDid, limit: neo4j.int(limit) });

      return result.records.map((record) => ({
        uri: record.get('uri') as AtUri,
        label: record.get('label') as string,
        score: Number(record.get('score')),
        reason: record.get('reason') as string,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get community membership for a node.
   *
   * @param graphName - Graph projection name
   * @param uri - Node URI
   * @returns Community membership
   *
   * @example
   * ```typescript
   * const membership = await algorithms.getCommunityMembership(
   *   'fields-graph',
   *   fieldUri
   * );
   * console.log(`Node is in community ${membership.communityId}`);
   * ```
   */
  async getCommunityMembership(graphName: string, uri: AtUri): Promise<CommunityMembership | null> {
    const query = `
      MATCH (node {uri: $uri})

      CALL gds.louvain.stream($graphName)
      YIELD nodeId, communityId
      WHERE gds.util.asNode(nodeId).uri = $uri

      RETURN
        $uri AS uri,
        communityId
      LIMIT 1
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName, uri });

      const record = result.records[0];
      if (!record) {
        return null;
      }

      return {
        uri: record.get('uri') as AtUri,
        communityId: Number(record.get('communityId')),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Detect communities using Label Propagation algorithm.
   *
   * @remarks
   * Label Propagation is faster than Louvain but may produce different results.
   * Useful as an alternative community detection method.
   *
   * @param graphName - Graph projection name
   * @returns Communities
   *
   * @example
   * ```typescript
   * const communities = await algorithms.labelPropagation('fields-graph');
   * ```
   */
  async labelPropagation(graphName: string): Promise<Community[]> {
    const query = `
      CALL gds.labelPropagation.stream($graphName)
      YIELD nodeId, communityId
      WITH communityId, collect(gds.util.asNode(nodeId).uri) AS members
      RETURN
        communityId,
        members,
        size(members) AS communitySize
      ORDER BY communitySize DESC
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName });

      return result.records.map((record) => ({
        communityId: Number(record.get('communityId')),
        members: record.get('members') as AtUri[],
        size: Number(record.get('communitySize')),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Find similar papers based on co-citation analysis.
   *
   * @remarks
   * Papers that are frequently cited together are considered similar.
   * Uses bibliographic coupling and co-citation counts.
   *
   * @param paperUri - Target paper URI
   * @param limit - Maximum results
   * @returns Similar papers ordered by similarity
   *
   * @example
   * ```typescript
   * const similar = await algorithms.paperSimilarity(
   *   'at://did:plc:example/pub.chive.eprint.submission/a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6',
   *   10
   * );
   * ```
   */
  async paperSimilarity(paperUri: AtUri, limit = 10): Promise<PaperSimilarity[]> {
    // Co-citation similarity: papers that cite the same papers
    const query = `
      MATCH (paper:Node:Object:Eprint {uri: $paperUri})-[:CITES]->(cited:Node:Object:Eprint)
      WHERE paper.subkind = 'eprint' AND cited.subkind = 'eprint'
      WITH paper, collect(cited) AS paperCitations

      // Find papers that cite the same works
      MATCH (similar:Node:Object:Eprint)-[:CITES]->(sharedCitation)
      WHERE similar.subkind = 'eprint'
        AND similar <> paper AND sharedCitation IN paperCitations

      WITH similar, count(sharedCitation) AS coCitationCount, size(paperCitations) AS totalCitations

      // Calculate Jaccard-like similarity
      OPTIONAL MATCH (similar)-[:CITES]->(similarCitations)
      WITH similar, coCitationCount, totalCitations, count(similarCitations) AS similarTotalCitations

      WITH similar,
           coCitationCount,
           toFloat(coCitationCount) / (totalCitations + similarTotalCitations - coCitationCount) AS similarity

      RETURN
        similar.uri AS paperUri,
        similar.title AS title,
        similarity,
        coCitationCount
      ORDER BY similarity DESC, coCitationCount DESC
      LIMIT $limit
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { paperUri, limit: neo4j.int(limit) });

      return result.records.map((record) => ({
        paperUri: record.get('paperUri') as AtUri,
        title: (record.get('title') as string) ?? 'Untitled',
        similarity: Number(record.get('similarity')),
        coCitationCount: Number(record.get('coCitationCount')),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Predict links using Adamic-Adar index.
   *
   * @remarks
   * Adamic-Adar measures the closeness of nodes based on their shared neighbors,
   * weighted by the inverse log of the degree of common neighbors.
   * Useful for suggesting field relationships.
   *
   * @param graphName - Graph projection name
   * @param topK - Top K predictions to return
   * @returns Link predictions ordered by score
   *
   * @example
   * ```typescript
   * const predictions = await algorithms.linkPrediction('fields-graph', 20);
   * ```
   */
  async linkPrediction(graphName: string, topK = 20): Promise<LinkPrediction[]> {
    const query = `
      CALL gds.alpha.linkprediction.adamicAdar.stream($graphName, {
        topK: $topK
      })
      YIELD node1, node2, score
      WHERE score > 0
      WITH gds.util.asNode(node1) AS n1, gds.util.asNode(node2) AS n2, score
      RETURN
        n1.uri AS node1,
        n2.uri AS node2,
        score
      ORDER BY score DESC
      LIMIT $topK
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { graphName, topK: neo4j.int(topK) });

      return result.records.map((record) => ({
        node1: record.get('node1') as AtUri,
        node2: record.get('node2') as AtUri,
        score: Number(record.get('score')),
        algorithm: 'adamic-adar' as const,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Predict potential collaborators for an author.
   *
   * @remarks
   * Uses network analysis to identify researchers who share:
   * - Common co-authors
   * - Common research fields
   * - Similar citation patterns
   *
   * @param authorDid - Author DID
   * @param limit - Maximum predictions
   * @returns Collaboration predictions
   *
   * @example
   * ```typescript
   * const collaborators = await algorithms.collaborationPrediction(
   *   'did:plc:author123',
   *   10
   * );
   * ```
   */
  async collaborationPrediction(authorDid: DID, limit = 10): Promise<CollaborationPrediction[]> {
    const query = `
      MATCH (author:Node:Object:Person)
      WHERE author.subkind = 'author' AND author.metadata.did = $authorDid

      MATCH (author)-[:COAUTHORED_WITH]-(coauthor:Node:Object:Person)-[:COAUTHORED_WITH]-(candidate:Node:Object:Person)
      WHERE coauthor.subkind = 'author' AND candidate.subkind = 'author'
        AND candidate <> author
        AND NOT (author)-[:COAUTHORED_WITH]-(candidate)

      WITH author, candidate, count(DISTINCT coauthor) AS commonCoauthors

      OPTIONAL MATCH (author)-[:EXPERT_IN]->(field:Node:Field)<-[:EXPERT_IN]-(candidate)
      WITH author, candidate, commonCoauthors, count(DISTINCT field) AS commonFields

      WITH candidate,
           commonCoauthors,
           commonFields,
           (toFloat(commonCoauthors) * 0.7 + toFloat(commonFields) * 0.3) AS score

      WHERE score > 0

      RETURN
        $authorDid AS author1Did,
        '' AS author1Name,
        candidate.metadata.did AS author2Did,
        candidate.label AS author2Name,
        score,
        commonCoauthors,
        commonFields
      ORDER BY score DESC
      LIMIT $limit
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { authorDid, limit: neo4j.int(limit) });

      return result.records.map((record) => ({
        author1Did: record.get('author1Did') as DID,
        author1Name: (record.get('author1Name') as string) ?? '',
        author2Did: record.get('author2Did') as DID,
        author2Name: (record.get('author2Name') as string) ?? '',
        score: Number(record.get('score')),
        commonCoauthors: Number(record.get('commonCoauthors')),
        commonFields: Number(record.get('commonFields')),
      }));
    } finally {
      await session.close();
    }
  }

  // ===========================================================================
  // WRITE METHODS - Store algorithm results in Neo4j node properties
  // ===========================================================================

  /**
   * Writes PageRank scores to node properties.
   *
   * @remarks
   * Updates nodes with their computed PageRank scores, enabling
   * Cypher queries that filter or sort by importance.
   *
   * @param results - PageRank computation results
   * @returns Number of nodes updated
   */
  async writePageRankToNodes(results: { uri: AtUri; score: number }[]): Promise<number> {
    if (results.length === 0) return 0;

    const query = `
      UNWIND $results AS result
      MATCH (n {uri: result.uri})
      SET n.pageRank = result.score,
          n.pageRankUpdatedAt = datetime()
      RETURN count(n) AS updated
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, {
        results: results.map((r) => ({ uri: r.uri, score: r.score })),
      });

      return Number(result.records[0]?.get('updated') ?? 0);
    } finally {
      await session.close();
    }
  }

  /**
   * Writes betweenness centrality scores to node properties.
   *
   * @param results - Betweenness computation results
   * @returns Number of nodes updated
   */
  async writeBetweennessToNodes(results: { uri: AtUri; score: number }[]): Promise<number> {
    if (results.length === 0) return 0;

    const query = `
      UNWIND $results AS result
      MATCH (n {uri: result.uri})
      SET n.betweenness = result.score,
          n.betweennessUpdatedAt = datetime()
      RETURN count(n) AS updated
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, {
        results: results.map((r) => ({ uri: r.uri, score: r.score })),
      });

      return Number(result.records[0]?.get('updated') ?? 0);
    } finally {
      await session.close();
    }
  }

  /**
   * Writes community IDs to node properties.
   *
   * @remarks
   * Assigns each node to a community based on the algorithm results.
   * Supports both Louvain and Label Propagation community IDs.
   *
   * @param results - Community detection results
   * @param algorithm - Algorithm name ('louvain' or 'label-propagation')
   * @returns Number of nodes updated
   */
  async writeCommunityToNodes(
    results: { uri: AtUri; communityId: number }[],
    algorithm: 'louvain' | 'label-propagation'
  ): Promise<number> {
    if (results.length === 0) return 0;

    const propertyName = algorithm === 'louvain' ? 'louvainCommunity' : 'lpCommunity';
    const updatedAtProperty = algorithm === 'louvain' ? 'louvainUpdatedAt' : 'lpUpdatedAt';

    const query = `
      UNWIND $results AS result
      MATCH (n {uri: result.uri})
      SET n.${propertyName} = result.communityId,
          n.${updatedAtProperty} = datetime()
      RETURN count(n) AS updated
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, {
        results: results.map((r) => ({ uri: r.uri, communityId: neo4j.int(r.communityId) })),
      });

      return Number(result.records[0]?.get('updated') ?? 0);
    } finally {
      await session.close();
    }
  }
}
