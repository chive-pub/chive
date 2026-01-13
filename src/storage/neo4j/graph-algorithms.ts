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
import type { RelationshipType } from './types.js';

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
  type: RelationshipType;
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
   *   nodeLabels: ['FieldNode', 'EprintSubmission'],
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
   *   'at://did:plc:gov/pub.chive.graph.field/ml',
   *   'at://did:plc:gov/pub.chive.graph.field/ai'
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
          type: rel.type as RelationshipType,
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
   *   'did:plc:user123',
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
}
