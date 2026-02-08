/**
 * Collaboration graph operations for co-authorship network analysis.
 *
 * @remarks
 * Provides a clean interface for co-authorship network operations including:
 * - Collaboration network traversal
 * - Collaboration strength calculation
 * - Collaborator suggestions using graph algorithms
 *
 * Wraps underlying Neo4j GDS operations with domain-specific semantics.
 *
 * @packageDocumentation
 * @public
 */

import neo4j from 'neo4j-driver';
import { inject, singleton } from 'tsyringe';

import type { DID } from '../../types/atproto.js';

import type { Neo4jConnection } from './connection.js';
import type { GraphAlgorithms, CollaborationPrediction } from './graph-algorithms.js';

/**
 * Node in the collaboration network.
 */
export interface CollaborationNode {
  did: DID;
  name: string;
  orcid?: string;
  paperCount?: number;
}

/**
 * Edge in the collaboration network.
 */
export interface CollaborationEdge {
  source: DID;
  target: DID;
  collaborationCount: number;
  eprintUris?: string[];
}

/**
 * Collaboration network (subgraph).
 */
export interface CollaborationNetwork {
  nodes: CollaborationNode[];
  edges: CollaborationEdge[];
  center: DID;
  depth: number;
}

/**
 * Collaboration strength between two authors.
 */
export interface CollaborationStrength {
  author1Did: DID;
  author2Did: DID;
  collaborationCount: number;
  firstCollaboration?: Date;
  lastCollaboration?: Date;
  sharedEprints: string[];
}

/**
 * Collaborator suggestion.
 */
export interface CollaboratorSuggestion {
  did: DID;
  name: string;
  score: number;
  commonCoauthors: number;
  commonFields: number;
  reason: string;
}

/**
 * Collaboration graph service.
 *
 * @remarks
 * Provides operations for analyzing co-authorship networks:
 * - Network traversal (get collaboration network up to N hops)
 * - Strength calculation (how many times have two authors collaborated)
 * - Suggestions (predict potential collaborators based on network structure)
 *
 * @example
 * ```typescript
 * const collab = container.resolve(CollaborationGraph);
 *
 * // Get collaboration network for an author
 * const network = await collab.getCoauthorNetwork('did:plc:abc123', 2);
 *
 * // Get collaboration strength between two authors
 * const strength = await collab.getCollaborationStrength(
 *   'did:plc:abc123',
 *   'did:plc:def456'
 * );
 *
 * // Suggest potential collaborators
 * const suggestions = await collab.suggestCollaborators('did:plc:abc123', 10);
 * ```
 *
 * @public
 */
@singleton()
export class CollaborationGraph {
  constructor(
    @inject('Neo4jConnection') private readonly connection: Neo4jConnection,
    @inject('GraphAlgorithms') private readonly algorithms: GraphAlgorithms
  ) {}

  /**
   * Get co-authorship network for an author.
   *
   * @param did - Author DID
   * @param depth - Maximum hops from center (1-3 recommended)
   * @param limit - Maximum nodes to return
   * @returns Collaboration network
   *
   * @example
   * ```typescript
   * // Get 2-hop network around an author
   * const network = await collab.getCoauthorNetwork('did:plc:abc', 2, 50);
   * console.log(`Network has ${network.nodes.length} authors`);
   * ```
   */
  async getCoauthorNetwork(did: DID, depth = 2, limit = 100): Promise<CollaborationNetwork> {
    // Clamp depth to reasonable bounds
    const actualDepth = Math.min(Math.max(depth, 1), 3);

    const query = `
      MATCH (center:Node:Object:Person)
      WHERE center.subkind = 'author' AND center.metadata.did = $did

      // Find all authors within N hops
      MATCH path = (center)-[:COAUTHORED_WITH*1..${actualDepth}]-(other:Node:Object:Person)
      WHERE other.subkind = 'author'

      WITH center, collect(DISTINCT other) AS allAuthors

      // Limit total nodes
      WITH center, allAuthors[0..$limit] AS limitedAuthors

      // Get the subgraph nodes
      WITH center, limitedAuthors
      UNWIND ([center] + limitedAuthors) AS author
      WITH DISTINCT author

      // Collect node info
      WITH collect({
        did: author.metadata.did,
        name: author.label,
        orcid: author.metadata.orcid
      }) AS nodes

      // Now get edges between these nodes
      UNWIND nodes AS n1
      UNWIND nodes AS n2
      WITH nodes, n1, n2
      WHERE n1.did < n2.did  // Avoid duplicate edges

      MATCH (a1:Node:Object:Person)-[r:COAUTHORED_WITH]-(a2:Node:Object:Person)
      WHERE a1.subkind = 'author' AND a1.metadata.did = n1.did
        AND a2.subkind = 'author' AND a2.metadata.did = n2.did

      WITH nodes, collect({
        source: n1.did,
        target: n2.did,
        collaborationCount: COALESCE(r.count, 1)
      }) AS edges

      RETURN nodes, edges
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, {
        did,
        limit: neo4j.int(limit),
      });

      const record = result.records[0];
      if (!record) {
        return {
          nodes: [],
          edges: [],
          center: did,
          depth: actualDepth,
        };
      }

      const nodes = record.get('nodes') as CollaborationNode[];
      const edges = record.get('edges') as CollaborationEdge[];

      return {
        nodes,
        edges,
        center: did,
        depth: actualDepth,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get collaboration strength between two authors.
   *
   * @param did1 - First author DID
   * @param did2 - Second author DID
   * @returns Collaboration strength or null if no collaboration exists
   *
   * @example
   * ```typescript
   * const strength = await collab.getCollaborationStrength(
   *   'did:plc:alice',
   *   'did:plc:bob'
   * );
   * if (strength) {
   *   console.log(`Collaborated ${strength.collaborationCount} times`);
   * }
   * ```
   */
  async getCollaborationStrength(did1: DID, did2: DID): Promise<CollaborationStrength | null> {
    const query = `
      MATCH (a1:Author {did: $did1})-[r:COAUTHORED_WITH]-(a2:Author {did: $did2})
      RETURN
        $did1 AS author1Did,
        $did2 AS author2Did,
        COALESCE(r.count, 1) AS collaborationCount,
        r.createdAt AS firstCollaboration,
        r.updatedAt AS lastCollaboration,
        COALESCE(r.eprints, []) AS sharedEprints
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { did1, did2 });

      const record = result.records[0];
      if (!record) {
        return null;
      }

      return {
        author1Did: record.get('author1Did') as DID,
        author2Did: record.get('author2Did') as DID,
        collaborationCount: Number(record.get('collaborationCount')),
        firstCollaboration: record.get('firstCollaboration')
          ? new Date(record.get('firstCollaboration') as string)
          : undefined,
        lastCollaboration: record.get('lastCollaboration')
          ? new Date(record.get('lastCollaboration') as string)
          : undefined,
        sharedEprints: record.get('sharedEprints') as string[],
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Suggest potential collaborators for an author.
   *
   * @remarks
   * Uses graph structure to find authors who:
   * - Share co-authors (2-hop network neighbors)
   * - Work in similar fields
   * - Have NOT already collaborated with the target author
   *
   * Wraps the GraphAlgorithms.collaborationPrediction() method.
   *
   * @param did - Author DID
   * @param limit - Maximum suggestions
   * @returns Ranked collaborator suggestions
   *
   * @example
   * ```typescript
   * const suggestions = await collab.suggestCollaborators('did:plc:abc', 10);
   * for (const s of suggestions) {
   *   console.log(`${s.name}: ${s.score} (${s.reason})`);
   * }
   * ```
   */
  async suggestCollaborators(did: DID, limit = 10): Promise<CollaboratorSuggestion[]> {
    // Use the existing collaborationPrediction from GraphAlgorithms
    const predictions = await this.algorithms.collaborationPrediction(did, limit);

    return predictions.map((p: CollaborationPrediction) => ({
      did: p.author2Did,
      name: p.author2Name,
      score: p.score,
      commonCoauthors: p.commonCoauthors,
      commonFields: p.commonFields,
      reason: this.generateReason(p),
    }));
  }

  /**
   * Get top collaborators by paper count.
   *
   * @param did - Author DID
   * @param limit - Maximum results
   * @returns Top collaborators
   */
  async getTopCollaborators(
    did: DID,
    limit = 10
  ): Promise<{ did: DID; name: string; count: number }[]> {
    const query = `
      MATCH (author:Node:Object:Person)-[r:COAUTHORED_WITH]-(collaborator:Node:Object:Person)
      WHERE author.subkind = 'author' AND author.metadata.did = $did
        AND collaborator.subkind = 'author'
      RETURN
        collaborator.did AS did,
        collaborator.name AS name,
        COALESCE(r.count, 1) AS count
      ORDER BY count DESC
      LIMIT $limit
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, {
        did,
        limit: neo4j.int(limit),
      });

      return result.records.map((record) => ({
        did: record.get('did') as DID,
        name: record.get('name') as string,
        count: Number(record.get('count')),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get collaboration statistics for an author.
   *
   * @param did - Author DID
   * @returns Collaboration statistics
   */
  async getCollaborationStats(did: DID): Promise<{
    totalCollaborators: number;
    totalCollaborations: number;
    avgCollaborationsPerAuthor: number;
    mostFrequentCollaborator?: { did: DID; name: string; count: number };
  }> {
    const query = `
      MATCH (author:Node:Object:Person)-[r:COAUTHORED_WITH]-(collaborator:Node:Object:Person)
      WHERE author.subkind = 'author' AND author.metadata.did = $did
        AND collaborator.subkind = 'author'
      WITH count(DISTINCT collaborator) AS totalCollaborators,
           sum(COALESCE(r.count, 1)) AS totalCollaborations,
           collect({
             did: collaborator.metadata.did,
             name: collaborator.label,
             count: COALESCE(r.count, 1)
           }) AS collaborators
      WITH totalCollaborators, totalCollaborations, collaborators,
           CASE WHEN totalCollaborators > 0
                THEN toFloat(totalCollaborations) / totalCollaborators
                ELSE 0
           END AS avgCollaborations

      // Find most frequent collaborator
      UNWIND collaborators AS c
      WITH totalCollaborators, totalCollaborations, avgCollaborations, c
      ORDER BY c.count DESC
      LIMIT 1

      RETURN
        totalCollaborators,
        totalCollaborations,
        avgCollaborations AS avgCollaborationsPerAuthor,
        c AS mostFrequentCollaborator
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { did });

      const record = result.records[0];
      if (!record) {
        return {
          totalCollaborators: 0,
          totalCollaborations: 0,
          avgCollaborationsPerAuthor: 0,
        };
      }

      const mostFrequent = record.get('mostFrequentCollaborator') as {
        did: DID;
        name: string;
        count: number;
      } | null;

      return {
        totalCollaborators: Number(record.get('totalCollaborators')),
        totalCollaborations: Number(record.get('totalCollaborations')),
        avgCollaborationsPerAuthor: Number(record.get('avgCollaborationsPerAuthor')),
        mostFrequentCollaborator: mostFrequent
          ? {
              did: mostFrequent.did,
              name: mostFrequent.name,
              count: Number(mostFrequent.count),
            }
          : undefined,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Find shortest collaboration path between two authors.
   *
   * @param did1 - First author DID
   * @param did2 - Second author DID
   * @param maxHops - Maximum path length
   * @returns Path between authors or null if no path exists
   */
  async findCollaborationPath(
    did1: DID,
    did2: DID,
    maxHops = 6
  ): Promise<{ path: DID[]; length: number } | null> {
    const query = `
      MATCH (a1:Node:Object:Person), (a2:Node:Object:Person)
      WHERE a1.subkind = 'author' AND a1.metadata.did = $did1
        AND a2.subkind = 'author' AND a2.metadata.did = $did2
      MATCH path = shortestPath((a1)-[:COAUTHORED_WITH*1..${maxHops}]-(a2))
      WITH [node IN nodes(path) | node.metadata.did] AS pathDids, length(path) AS pathLength
      RETURN pathDids, pathLength
    `;

    const session = this.connection.getSession();

    try {
      const result = await session.run(query, { did1, did2 });

      const record = result.records[0];
      if (!record) {
        return null;
      }

      return {
        path: record.get('pathDids') as DID[],
        length: Number(record.get('pathLength')),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Generate a human-readable reason for collaboration suggestion.
   */
  private generateReason(prediction: CollaborationPrediction): string {
    const reasons: string[] = [];

    if (prediction.commonCoauthors > 0) {
      reasons.push(
        `${prediction.commonCoauthors} shared co-author${prediction.commonCoauthors > 1 ? 's' : ''}`
      );
    }

    if (prediction.commonFields > 0) {
      reasons.push(
        `${prediction.commonFields} common field${prediction.commonFields > 1 ? 's' : ''}`
      );
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Network proximity';
  }
}
