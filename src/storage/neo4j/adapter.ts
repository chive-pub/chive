import neo4j, { Integer } from 'neo4j-driver';
import { singleton } from 'tsyringe';

import { toDID } from '../../types/atproto-validators.js';
import type { AtUri } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import type {
  IGraphDatabase,
  FieldNode as IFieldNode,
  FieldRelationship,
  AuthorityRecord as IAuthorityRecord,
  Facet as IFacet,
  FieldProposal as IFieldProposal,
  VoteRecord,
} from '../../types/interfaces/graph.interface.js';

import { Neo4jConnection } from './connection.js';
import type {
  FieldNode,
  AuthorityRecord,
  Facet,
  RelationshipType,
  FacetType,
  FacetQuery,
  PreprintMatch,
  FacetAggregation,
  ConsensusResult,
  FieldHierarchy,
  FieldPath,
} from './types.js';
import { FACET_TYPES } from './types.js';

/**
 * Neo4j adapter implementing the IGraphDatabase interface.
 *
 * Provides access to Chive's knowledge graph including field nodes,
 * authority records, faceted classification, and community moderation.
 *
 * All operations are ATProto-compliant:
 * - Neo4j is index only (not source of truth)
 * - Authority records sourced from Governance PDS
 * - User proposals/votes sourced from user PDSes
 * - All data rebuildable from firehose
 *
 * @example
 * ```typescript
 * const adapter = container.resolve(Neo4jAdapter);
 *
 * // Create a field node
 * await adapter.upsertField({
 *   id: 'ml',
 *   uri: 'at://did:plc:gov/pub.chive.graph.field/ml',
 *   label: 'Machine Learning',
 *   type: 'field',
 *   level: 1,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * });
 *
 * // Find related fields
 * const related = await adapter.findRelatedFields('ml', 2);
 * ```
 */
@singleton()
export class Neo4jAdapter implements IGraphDatabase {
  constructor(private connection: Neo4jConnection) {}

  /**
   * Creates or updates a field node.
   *
   * @param field - Field node data (must be interface compatible)
   * @returns Promise resolving when upserted
   *
   * @remarks
   * Uses MERGE to avoid duplicates. Updates all properties on existing nodes.
   * Field nodes are indexed from ATProto records in user PDSes or Governance PDS.
   *
   * @example
   * ```typescript
   * await adapter.upsertField({
   *   id: 'quantum-computing',
   *   label: 'Quantum Computing',
   *   type: 'field',
   *   description: 'Computing using quantum mechanics principles',
   *   wikidataId: 'Q484761'
   * });
   * ```
   */
  async upsertField(field: IFieldNode): Promise<void> {
    const query = `
      MERGE (f:Field {id: $id})
      ON CREATE SET f.createdAt = datetime()
      SET f.label = $label,
          f.type = $type,
          f.description = $description,
          f.wikidataId = $wikidataId,
          f.updatedAt = datetime()
      RETURN f
    `;

    await this.connection.executeQuery(query, {
      id: field.id,
      label: field.label,
      type: field.type,
      description: field.description ?? null,
      wikidataId: field.wikidataId ?? null,
    });
  }

  /**
   * Gets a field node by ID.
   *
   * @param fieldId - Field identifier
   * @returns Field node or null if not found
   *
   * @remarks
   * Retrieves a single field node by its unique identifier.
   * Implements IGraphDatabase.getFieldById.
   *
   * @public
   */
  async getFieldById(fieldId: string): Promise<IFieldNode | null> {
    return this.getField(fieldId);
  }

  /**
   * Get a field node by ID (internal method).
   *
   * @param fieldId - Field identifier
   * @returns Field node or null if not found
   * @internal
   */
  async getField(fieldId: string): Promise<FieldNode | null> {
    const query = `
      MATCH (f:Field {id: $fieldId})
      RETURN f.id as id, f.uri as uri, f.label as label, f.type as type,
             f.description as description, f.wikidataId as wikidataId,
             f.level as level, f.materializedPath as materializedPath,
             f.createdAt as createdAt, f.updatedAt as updatedAt
    `;

    const result = await this.connection.executeQuery<{
      id: string;
      uri: string;
      label: string;
      type: string;
      description: string | null;
      wikidataId: string | null;
      level: number;
      materializedPath: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>(query, {
      fieldId,
    });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapFieldNode({
      id: record.get('id'),
      uri: record.get('uri'),
      label: record.get('label'),
      type: record.get('type'),
      description: record.get('description'),
      wikidataId: record.get('wikidataId'),
      level: record.get('level'),
      materializedPath: record.get('materializedPath'),
      createdAt: record.get('createdAt'),
      updatedAt: record.get('updatedAt'),
    });
  }

  /**
   * Get a field node by URI.
   *
   * @param uri - AT-URI of field
   * @returns Field node or null if not found
   */
  async getFieldByUri(uri: AtUri): Promise<FieldNode | null> {
    const query = `
      MATCH (f:Field {uri: $uri})
      RETURN f
    `;

    const result = await this.connection.executeQuery<{ f: Record<string, string> }>(query, {
      uri,
    });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapFieldNode(record.get('f'));
  }

  /**
   * Creates a relationship between field nodes.
   *
   * @param relationship - Relationship data
   * @returns Promise resolving when created
   *
   * @remarks
   * Creates typed, weighted relationships between field nodes.
   * Supports SKOS relationships: broader, narrower, related.
   *
   * @example
   * ```typescript
   * await adapter.createRelationship({
   *   fromId: 'neural-networks',
   *   toId: 'artificial-intelligence',
   *   type: 'narrower',
   *   strength: 0.95
   * });
   * ```
   */
  async createRelationship(relationship: FieldRelationship): Promise<void> {
    // Map interface types to internal relationship types
    const typeMap: Record<string, RelationshipType> = {
      broader: 'BROADER_THAN',
      narrower: 'NARROWER_THAN',
      related: 'RELATED_TO',
    };

    const relType = typeMap[relationship.type];

    const query = `
      MATCH (from:Field {id: $fromId})
      MATCH (to:Field {id: $toId})
      MERGE (from)-[r:${relType}]->(to)
      SET r.strength = $strength,
          r.createdAt = CASE WHEN r.createdAt IS NULL THEN datetime() ELSE r.createdAt END,
          r.updatedAt = datetime()
      RETURN r
    `;

    await this.connection.executeQuery(query, {
      fromId: relationship.fromId,
      toId: relationship.toId,
      strength: relationship.strength ?? 1.0,
    });
  }

  /**
   * Creates a typed relationship between any two nodes.
   *
   * @param fromUri - Source node AT-URI
   * @param toUri - Target node AT-URI
   * @param type - Relationship type
   * @param properties - Additional relationship properties
   * @returns Promise resolving when created
   */
  async createTypedRelationship(
    fromUri: AtUri,
    toUri: AtUri,
    type: RelationshipType,
    properties?: Record<string, string | number | boolean>
  ): Promise<void> {
    const props = properties ?? {};
    const propString = Object.keys(props)
      .map((key) => `r.${key} = $props.${key}`)
      .join(', ');

    const query = `
      MATCH (from {uri: $fromUri})
      MATCH (to {uri: $toUri})
      MERGE (from)-[r:${type}]->(to)
      ${propString ? `SET ${propString},` : 'SET'}
          r.createdAt = CASE WHEN r.createdAt IS NULL THEN datetime() ELSE r.createdAt END,
          r.updatedAt = datetime()
      RETURN r
    `;

    await this.connection.executeQuery(query, {
      fromUri,
      toUri,
      props,
    });
  }

  /**
   * Finds related fields by traversing relationships.
   *
   * @param fieldId - Starting field ID
   * @param maxDepth - Maximum traversal depth (default: 2)
   * @returns Related field nodes
   *
   * @remarks
   * Uses graph traversal to find related fields up to maxDepth hops away.
   * Returns fields sorted by relevance (closer fields first).
   *
   * @example
   * ```typescript
   * const related = await adapter.findRelatedFields('neural-networks', 2);
   * // Returns fields within 2 hops: AI, deep learning, machine learning, etc.
   * ```
   */
  async findRelatedFields(fieldId: string, maxDepth = 2): Promise<readonly IFieldNode[]> {
    // Use APOC's apoc.path.expandConfig for dynamic depth traversal
    // This is the industry-standard approach as Cypher doesn't allow
    // parameter substitution in variable-length pattern bounds
    // See: https://neo4j.com/docs/apoc/current/graph-querying/expand-paths-config/
    const query = `
      MATCH (start:Field {id: $fieldId})
      CALL apoc.path.expandConfig(start, {
        minLevel: 1,
        maxLevel: $maxDepth,
        labelFilter: '+Field',
        uniqueness: 'NODE_GLOBAL'
      }) YIELD path
      WITH last(nodes(path)) as related, min(length(path)) as distance
      RETURN DISTINCT
        related.id as id,
        related.uri as uri,
        related.label as label,
        related.type as type,
        related.description as description,
        related.wikidataId as wikidataId,
        related.level as level,
        related.materializedPath as materializedPath,
        related.createdAt as createdAt,
        related.updatedAt as updatedAt,
        distance
      ORDER BY distance, related.label
      LIMIT 50
    `;

    const result = await this.connection.executeQuery<{
      id: string;
      uri: string;
      label: string;
      type: string;
      description: string | null;
      wikidataId: string | null;
      level: number;
      materializedPath: string | null;
      createdAt: Date;
      updatedAt: Date;
      distance: number;
    }>(query, { fieldId, maxDepth: neo4j.int(maxDepth) });

    return result.records.map((record) =>
      this.mapFieldNode({
        id: record.get('id'),
        uri: record.get('uri'),
        label: record.get('label'),
        type: record.get('type'),
        description: record.get('description'),
        wikidataId: record.get('wikidataId'),
        level: record.get('level'),
        materializedPath: record.get('materializedPath'),
        createdAt: record.get('createdAt'),
        updatedAt: record.get('updatedAt'),
      })
    ) as readonly IFieldNode[];
  }

  /**
   * Lists fields with optional filtering.
   *
   * @param options - List options
   * @returns List of fields with total count
   */
  async listFields(options: {
    status?: string;
    parentId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ fields: IFieldNode[]; total: number; hasMore: boolean; cursor?: string }> {
    const { status, parentId, limit = 50, cursor } = options;

    // Build WHERE clauses
    const conditions: string[] = [];
    // Neo4j requires integers for LIMIT and SKIP; use neo4j.int() for proper type conversion.
    const params: Record<string, unknown> = {
      limit: neo4j.int(Math.floor(Number(limit))),
      skip: neo4j.int(cursor ? parseInt(cursor, 10) : 0),
    };

    if (status) {
      conditions.push('f.status = $status');
      params.status = status;
    }

    if (parentId) {
      conditions.push('EXISTS((f)-[:SUBFIELD_OF]->(:Field {id: $parentId}))');
      params.parentId = parentId;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      MATCH (f:Field)
      ${whereClause}
      RETURN count(f) as total
    `;

    // Data query
    const dataQuery = `
      MATCH (f:Field)
      ${whereClause}
      RETURN f
      ORDER BY f.label ASC
      SKIP $skip
      LIMIT $limit
    `;

    const [countResult, dataResult] = await Promise.all([
      this.connection.executeQuery<{ total: number }>(countQuery, params),
      this.connection.executeQuery<{ f: Record<string, string | number | Date | null> }>(
        dataQuery,
        params
      ),
    ]);

    // Neo4j returns integers as special Integer objects; convert using toNumber() if needed.
    const rawTotal = countResult.records[0]?.get('total');
    const total =
      typeof rawTotal === 'object' && rawTotal !== null && 'toNumber' in rawTotal
        ? (rawTotal as { toNumber: () => number }).toNumber()
        : (rawTotal ?? 0);

    // Neo4j Node objects have properties in .properties; use that to get plain object.
    const fields = dataResult.records.map((record) => {
      const node = record.get('f');
      const props = (node.properties ?? node) as Record<string, string | number | Date | null>;
      return this.mapFieldNode(props);
    });

    // Calculate pagination; skip was stored as neo4j.int, get the original value.
    const skipValue = cursor ? parseInt(cursor, 10) : 0;
    const hasMore = skipValue + fields.length < total;
    const nextCursor = hasMore ? String(skipValue + fields.length) : undefined;

    return { fields, total, hasMore, cursor: nextCursor };
  }

  /**
   * Get field hierarchy starting from a root node.
   *
   * @param rootUri - Root field AT-URI
   * @param maxDepth - Maximum depth to traverse
   * @returns Hierarchical field structure
   */
  async getFieldHierarchy(rootUri: AtUri, maxDepth: number): Promise<FieldHierarchy> {
    const query = `
      MATCH path = (root:Field {uri: $rootUri})<-[:SUBFIELD_OF*0..$maxDepth]-(child:Field)
      WITH root, child, length(path) as depth
      ORDER BY depth, child.label
      RETURN root, collect({child: child, depth: depth}) as children
    `;

    const result = await this.connection.executeQuery<{
      root: Record<string, string>;
      children: { child: Record<string, string>; depth: number }[];
    }>(query, { rootUri, maxDepth: neo4j.int(maxDepth) });

    if (result.records.length === 0) {
      throw new NotFoundError('Field', rootUri);
    }

    const record = result.records[0];
    if (!record) {
      throw new NotFoundError('Field', rootUri);
    }

    const root = this.mapFieldNode(record.get('root'));
    const children = record.get('children');

    return this.buildHierarchy(root, children);
  }

  /**
   * Build hierarchical structure from flat list.
   *
   * @param root - Root field node
   * @param children - Child nodes with depth
   * @returns Hierarchical structure
   */
  private buildHierarchy(
    root: FieldNode,
    children: { child: Record<string, string>; depth: number }[]
  ): FieldHierarchy {
    const childNodes = children
      .filter((c) => c.depth === 1)
      .map((c) => {
        const childNode = this.mapFieldNode(c.child);
        const grandchildren = children.filter((gc) => gc.depth > 1 && gc.child.uri === c.child.uri);
        return this.buildHierarchy(childNode, grandchildren);
      });

    return {
      root,
      children: childNodes,
      depth: 0,
    };
  }

  /**
   * Find shortest path between two fields.
   *
   * @param startFieldUri - Starting field AT-URI
   * @param endFieldUri - Ending field AT-URI
   * @returns Shortest path or null if no path exists
   */
  async findShortestPath(startFieldUri: AtUri, endFieldUri: AtUri): Promise<FieldPath | null> {
    const query = `
      MATCH (start:Field {uri: $startUri})
      MATCH (end:Field {uri: $endUri})
      MATCH path = shortestPath((start)-[*..$maxHops]-(end))
      RETURN path,
             length(path) as distance,
             [node IN nodes(path) | node.label] as fieldNames,
             [rel IN relationships(path) | type(rel)] as relationshipTypes
    `;

    const result = await this.connection.executeQuery<{
      path: string;
      distance: number;
      fieldNames: string[];
      relationshipTypes: RelationshipType[];
    }>(query, {
      startUri: startFieldUri,
      endUri: endFieldUri,
      maxHops: neo4j.int(10),
    });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return {
      distance: record.get('distance'),
      fields: record.get('fieldNames'),
      relationships: record.get('relationshipTypes'),
      path: record.get('path'),
    };
  }

  /**
   * Creates an authority record.
   *
   * @param record - Authority record data
   * @returns Promise resolving when created
   *
   * @remarks
   * Authority records are sourced from Governance PDS per ATProto compliance.
   * This method indexes the record in Neo4j for fast lookups.
   *
   * @example
   * ```typescript
   * await adapter.createAuthorityRecord({
   *   id: 'neural-networks-cs',
   *   authorizedHeading: 'Neural networks (Computer science)',
   *   alternateHeadings: ['Neural nets', 'ANNs', 'Artificial neural networks'],
   *   scope: 'For biological networks, see Nervous system',
   *   source: 'wikidata',
   *   wikidataId: 'Q43479'
   * });
   * ```
   */
  async createAuthorityRecord(record: IAuthorityRecord): Promise<void> {
    const query = `
      MERGE (a:AuthorityRecord {id: $id})
      SET a.authorizedHeading = $authorizedHeading,
          a.alternateHeadings = $alternateHeadings,
          a.scope = $scope,
          a.source = $source,
          a.wikidataId = $wikidataId,
          a.updatedAt = datetime()
      ON CREATE SET a.createdAt = datetime()
      RETURN a
    `;

    await this.connection.executeQuery(query, {
      id: record.id,
      authorizedHeading: record.authorizedHeading,
      alternateHeadings: record.alternateHeadings,
      scope: record.scope ?? null,
      source: record.source,
      wikidataId: record.wikidataId ?? null,
    });
  }

  /**
   * Get authority record by ID.
   *
   * @param recordId - Authority record identifier
   * @returns Authority record or null if not found
   */
  async getAuthorityRecord(recordId: string): Promise<AuthorityRecord | null> {
    const query = `
      MATCH (a:AuthorityRecord {id: $recordId})
      RETURN a
    `;

    const result = await this.connection.executeQuery<{
      a: Record<string, string | string[]>;
    }>(query, { recordId });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapAuthorityRecord(record.get('a'));
  }

  /**
   * Find authority records by heading text.
   *
   * @param heading - Heading text to search
   * @returns Matching authority records
   */
  async findAuthorityByHeading(heading: string): Promise<AuthorityRecord[]> {
    const query = `
      CALL db.index.fulltext.queryNodes('authorityTextIndex', $searchText)
      YIELD node, score
      WHERE node:AuthorityRecord
      RETURN node
      ORDER BY score DESC
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{
      node: Record<string, string | string[]>;
    }>(query, { searchText: heading, limit: neo4j.int(20) });

    return result.records.map((record) => this.mapAuthorityRecord(record.get('node')));
  }

  /**
   * Resolve variant form to canonical authority record.
   *
   * @param variantUri - Variant authority record URI
   * @returns Canonical authority record or null
   */
  async resolveVariant(variantUri: AtUri): Promise<AuthorityRecord | null> {
    const query = `
      MATCH (variant:AuthorityRecord {uri: $variantUri})-[:USE_INSTEAD*1..$maxHops]->(canonical:AuthorityRecord)
      WHERE NOT (canonical)-[:USE_INSTEAD]->()
      RETURN canonical
      LIMIT 1
    `;

    const result = await this.connection.executeQuery<{
      canonical: Record<string, string | string[]>;
    }>(query, { variantUri, maxHops: neo4j.int(5) });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapAuthorityRecord(record.get('canonical'));
  }

  /**
   * Queries field nodes by facets.
   *
   * @param facets - Facet filters
   * @returns Matching field IDs
   *
   * @remarks
   * Finds fields that match all specified facets (AND query).
   * Use for faceted navigation and filtering.
   *
   * @example
   * ```typescript
   * const fields = await adapter.queryByFacets([
   *   { dimension: 'matter', value: 'Proteins' },
   *   { dimension: 'energy', value: 'Meta-analysis' }
   * ]);
   * // Returns fields about protein meta-analyses
   * ```
   */
  async queryByFacets(facets: readonly IFacet[]): Promise<readonly string[]> {
    if (facets.length === 0) {
      return [];
    }

    // Build dynamic query for multiple facet matches
    const facetMatches = facets.map(
      (_, i) => `
      MATCH (p)-[:FACET_VALUE]->(f${i}:Facet {
        facetType: $facet${i}Type,
        value: $facet${i}Value
      })
    `
    );

    const query = `
      MATCH (p:Preprint)
      ${facetMatches.join('\n')}
      RETURN DISTINCT p.uri as uri
      LIMIT $limit
    `;

    const params: Record<string, string | neo4j.Integer> = {
      limit: neo4j.int(1000),
    };
    facets.forEach((facet, i) => {
      params[`facet${i}Type`] = facet.dimension;
      params[`facet${i}Value`] = facet.value;
    });

    const result = await this.connection.executeQuery<{ uri: string }>(query, params);

    return result.records.map((record) => record.get('uri'));
  }

  /**
   * Query papers by facets with aggregations.
   *
   * @param query - Faceted query
   * @returns Matching papers
   */
  async facetedSearch(query: FacetQuery): Promise<PreprintMatch[]> {
    const facetMatches = query.facets.map(
      (_, i) => `
      MATCH (p)-[:FACET_VALUE]->(f${i}:Facet {
        facetType: $facet${i}Type,
        value: $facet${i}Value
      })
    `
    );

    const cypherQuery = `
      MATCH (p:Preprint)
      ${facetMatches.join('\n')}
      WITH p, [${query.facets.map((_, i) => `f${i}`).join(', ')}] as matchedFacets
      RETURN p.uri as uri,
             p.title as title,
             matchedFacets,
             size(matchedFacets) as score
      ORDER BY score DESC
      SKIP $offset
      LIMIT $limit
    `;

    const params: Record<string, string | number | neo4j.Integer> = {
      offset: neo4j.int(query.offset ?? 0),
      limit: neo4j.int(query.limit ?? 50),
    };

    query.facets.forEach((facet, i) => {
      params[`facet${i}Type`] = facet.facetType;
      params[`facet${i}Value`] = facet.value;
    });

    const result = await this.connection.executeQuery<{
      uri: AtUri;
      title: string;
      matchedFacets: Record<string, string>[];
      score: number;
    }>(cypherQuery, params);

    return result.records.map((record) => ({
      uri: record.get('uri'),
      title: record.get('title'),
      matchedFacets: record
        .get('matchedFacets')
        .map((f: Record<string, string>) => this.mapFacet(f)),
      score: record.get('score'),
    }));
  }

  /**
   * Aggregate facet counts for given filters.
   *
   * @param _filters - Search filters (reserved for future use)
   * @returns Facet aggregations
   */
  async aggregateFacets(_filters?: FacetQuery): Promise<FacetAggregation[]> {
    const query = `
      MATCH (p:Preprint)-[:FACET_VALUE]->(f:Facet)
      WITH f.facetType as facetType, f.value as facetValue, count(p) as paperCount
      WITH facetType,
           collect({value: facetValue, count: paperCount}) as values,
           sum(paperCount) as totalPapers
      RETURN facetType,
             [v IN values |
               {value: v.value,
                count: v.count,
                percentage: toFloat(v.count) / totalPapers * 100}
             ] as values
      ORDER BY facetType
    `;

    const result = await this.connection.executeQuery<{
      facetType: string;
      values: { value: string; count: number; percentage: number }[];
    }>(query);

    return result.records.map((record) => {
      const facetType = record.get('facetType');
      const values = record.get('values');

      if (typeof facetType !== 'string') {
        throw new DatabaseError('READ', 'Invalid facet type from database: expected string');
      }

      if (!this.isValidFacetType(facetType)) {
        throw new ValidationError(`Unknown facet type: ${facetType}`, 'facetType', 'unknown_type');
      }

      return {
        facetType,
        values,
      };
    });
  }

  /**
   * Gets pending community proposals for a field.
   *
   * @param fieldId - Field ID
   * @returns Pending proposals
   *
   * @remarks
   * Returns proposals awaiting community review for this field.
   * Proposals are sourced from user PDSes per ATProto compliance.
   *
   * @example
   * ```typescript
   * const proposals = await adapter.getCommunityProposals('neural-networks');
   * proposals.forEach(p => {
   *   console.log(`${p.proposalType}: ${p.rationale}`);
   * });
   * ```
   */
  async getCommunityProposals(fieldId: string): Promise<readonly IFieldProposal[]> {
    const query = `
      MATCH (fp:FieldProposal)
      WHERE fp.fieldId = $fieldId AND fp.status = 'pending'
      RETURN fp
      ORDER BY fp.createdAt DESC
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{
      fp: Record<string, string | number | Date>;
    }>(query, { fieldId, limit: neo4j.int(50) });

    return result.records.map((record) => this.mapFieldProposal(record.get('fp')));
  }

  /**
   * Creates a vote record for a proposal.
   *
   * @param vote - Vote record data
   * @returns Promise resolving when created
   *
   * @remarks
   * Persists vote to Neo4j and links to proposal node.
   * Implements IGraphDatabase.createVote.
   */
  async createVote(vote: VoteRecord): Promise<void> {
    const query = `
      MERGE (v:Vote {uri: $uri})
      ON CREATE SET v.createdAt = datetime()
      SET v.proposalUri = $proposalUri,
          v.voterDid = $voterDid,
          v.voterRole = $voterRole,
          v.vote = $vote,
          v.rationale = $rationale,
          v.updatedAt = datetime()
      WITH v
      OPTIONAL MATCH (p:FieldProposal {uri: $proposalUri})
      FOREACH (ignored IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END |
        MERGE (v)-[:VOTES_ON]->(p)
      )
      RETURN v
    `;

    await this.connection.executeQuery(query, {
      uri: vote.uri,
      proposalUri: vote.proposalUri,
      voterDid: vote.voterDid,
      voterRole: vote.voterRole,
      vote: vote.vote,
      rationale: vote.rationale ?? null,
    });
  }

  /**
   * Get proposals with filters.
   *
   * @param filters - Proposal filters (interface-compatible)
   * @returns Paginated proposals with interface-compatible types
   */
  async getProposals(filters: {
    readonly status?: readonly ('pending' | 'approved' | 'rejected')[];
    readonly proposalType?: readonly ('create' | 'update' | 'merge' | 'delete')[];
    readonly proposerDid?: string;
    readonly fieldUri?: string;
    readonly createdAfter?: Date;
    readonly createdBefore?: Date;
    readonly offset?: number;
    readonly limit?: number;
  }): Promise<{
    readonly proposals: readonly IFieldProposal[];
    readonly total: number;
    readonly hasMore: boolean;
    readonly offset: number;
  }> {
    const conditions: string[] = [];
    const params: Record<string, string | string[] | number | Date | Integer> = {};

    if (filters.status && filters.status.length > 0) {
      conditions.push('fp.status IN $statuses');
      params.statuses = [...filters.status];
    }

    if (filters.proposalType && filters.proposalType.length > 0) {
      conditions.push('fp.proposalType IN $proposalTypes');
      params.proposalTypes = [...filters.proposalType];
    }

    if (filters.proposerDid) {
      conditions.push('fp.proposerDid = $proposerDid');
      params.proposerDid = filters.proposerDid;
    }

    if (filters.fieldUri) {
      conditions.push('fp.existingFieldUri = $fieldUri');
      params.fieldUri = filters.fieldUri;
    }

    if (filters.createdAfter) {
      conditions.push('fp.createdAt >= $createdAfter');
      params.createdAfter = filters.createdAfter;
    }

    if (filters.createdBefore) {
      conditions.push('fp.createdAt <= $createdBefore');
      params.createdBefore = filters.createdBefore;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      MATCH (fp:FieldProposal)
      ${whereClause}
      WITH fp
      ORDER BY fp.createdAt DESC
      SKIP $offset
      LIMIT $limit
      RETURN fp
    `;

    params.offset = neo4j.int(Math.floor(filters.offset ?? 0));
    params.limit = neo4j.int(Math.floor((filters.limit ?? 50) + 1)); // Fetch one extra to check if more

    const result = await this.connection.executeQuery<{
      fp: Record<string, string | number | Date>;
    }>(query, params);

    // Neo4j Node objects have properties in .properties; use that to get plain object.
    const proposals = result.records.map((record) => {
      const node = record.get('fp');
      const props = (node.properties ?? node) as Record<string, string | number | Date>;
      return this.mapFieldProposal(props);
    });

    const hasMore = proposals.length > (filters.limit ?? 50);
    if (hasMore) {
      proposals.pop(); // Remove extra record
    }

    // Get total count
    const countQuery = `
      MATCH (fp:FieldProposal)
      ${whereClause}
      RETURN count(fp) as total
    `;

    const countResult = await this.connection.executeQuery<{ total: number }>(countQuery, params);
    const total = countResult.records[0]?.get('total') ?? 0;

    return {
      proposals,
      total,
      hasMore,
      offset: filters.offset ?? 0,
    };
  }

  /**
   * Get a proposal by ID.
   *
   * @param proposalId - Proposal identifier (rkey or full ID)
   * @returns Proposal if found, null otherwise
   *
   * @remarks
   * Retrieves a single field proposal by its unique identifier.
   * The ID can be the rkey portion of the AT-URI or a full URI.
   *
   * @example
   * ```typescript
   * const proposal = await adapter.getProposalById('3abcdefg');
   * if (proposal) {
   *   console.log(`Proposal: ${proposal.fieldName}`);
   * }
   * ```
   */
  async getProposalById(proposalId: string): Promise<IFieldProposal | null> {
    // Handle both full URI and just the ID
    const query = `
      MATCH (fp:FieldProposal)
      WHERE fp.id = $proposalId OR fp.uri ENDS WITH '/' + $proposalId
      RETURN fp
    `;

    const result = await this.connection.executeQuery<{
      fp: Record<string, string | number | Date>;
    }>(query, { proposalId });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    // Neo4j Node objects have properties in .properties; extract that to get plain object.
    const node = record.get('fp');
    const props = (node.properties ?? node) as Record<string, string | number | Date>;
    return this.mapFieldProposal(props);
  }

  /**
   * Get votes for a proposal.
   *
   * @param proposalUri - Proposal AT-URI
   * @returns Votes cast on the proposal
   */
  async getVotesForProposal(proposalUri: string): Promise<readonly VoteRecord[]> {
    const query = `
      MATCH (v:Vote {proposalUri: $proposalUri})
      RETURN v
      ORDER BY v.createdAt DESC
    `;

    const result = await this.connection.executeQuery<{
      v: Record<string, string | Date>;
    }>(query, { proposalUri });

    return result.records.map((record) => {
      const node = record.get('v');
      const props = (node.properties ?? node) as Record<string, string | Date>;
      return this.mapVoteToInterface(props);
    });
  }

  /**
   * Calculate consensus for a proposal.
   *
   * @param proposalUri - Proposal AT-URI
   * @returns Consensus calculation result
   */
  async calculateConsensus(proposalUri: AtUri): Promise<ConsensusResult> {
    // Get all votes
    const votes = await this.getVotesForProposal(proposalUri);

    let approveCount = 0;
    let rejectCount = 0;
    let abstainCount = 0;
    let weightedApprove = 0;
    let weightedReject = 0;
    let trustedEditorSupport = 0;
    let adminVetoes = 0;

    // Weight votes by user role
    const roleWeights: Record<string, number> = {
      'community-member': 1.0,
      'trusted-editor': 2.0,
      'authority-editor': 3.0,
      'domain-expert': 3.0,
      administrator: 5.0,
    };

    for (const vote of votes) {
      const weight = roleWeights[vote.voterRole] ?? 1.0;

      if (vote.vote === 'approve') {
        approveCount++;
        weightedApprove += weight;
        if (vote.voterRole === 'reviewer') {
          trustedEditorSupport++;
        }
      } else if (vote.vote === 'reject') {
        rejectCount++;
        weightedReject += weight;
        if (vote.voterRole === 'administrator') {
          adminVetoes++;
        }
      } else if (vote.vote === 'abstain') {
        abstainCount++;
      }
    }

    const totalVotes = approveCount + rejectCount;
    const approvalRatio = totalVotes > 0 ? weightedApprove / (weightedApprove + weightedReject) : 0;

    // Default thresholds (should be configurable)
    const threshold = 0.67; // 67% approval
    const minVotes = 5;
    const minTrustedEditors = 2;

    const reached =
      totalVotes >= minVotes &&
      approvalRatio >= threshold &&
      trustedEditorSupport >= minTrustedEditors &&
      adminVetoes === 0;

    return {
      reached,
      approveVotes: approveCount,
      rejectVotes: rejectCount,
      abstainVotes: abstainCount,
      weightedApprove,
      weightedReject,
      approvalRatio,
      trustedEditorSupport,
      adminVetoes,
      threshold,
      automaticApproval: false,
    };
  }

  /**
   * Map Neo4j node properties to FieldNode.
   */
  private mapFieldNode(node: Record<string, string | number | Date | null>): FieldNode {
    const missing: string[] = [];
    if (!node.id) missing.push('id');
    if (!node.label) missing.push('label');
    if (!node.createdAt) missing.push('createdAt');
    if (!node.updatedAt) missing.push('updatedAt');

    if (missing.length > 0) {
      throw new DatabaseError(
        'READ',
        `Invalid field node: missing required properties: ${missing.join(', ')}. Available: ${Object.keys(node).join(', ')}`
      );
    }

    return {
      id: node.id as string,
      uri: node.uri as AtUri,
      label: node.label as string,
      type: node.type as FieldNode['type'],
      description: node.description ? (node.description as string) : undefined,
      wikidataId: node.wikidataId ? (node.wikidataId as string) : undefined,
      level: Number(node.level) || 0,
      materializedPath: node.materializedPath ? (node.materializedPath as string) : undefined,
      createdAt: new Date(node.createdAt as string | Date),
      updatedAt: new Date(node.updatedAt as string | Date),
    };
  }

  /**
   * Map Neo4j node properties to AuthorityRecord.
   *
   * @remarks
   * Maps from Neo4j node format to internal AuthorityRecord type.
   * The Neo4j node stores `authorizedHeading` which maps to internal `authorizedForm`.
   */
  private mapAuthorityRecord(node: Record<string, string | string[]>): AuthorityRecord {
    const alternateHeadings = node.alternateHeadings;

    // Note: Neo4j stores as `authorizedHeading` (interface format),
    // internal type uses `authorizedForm`; they represent the same field
    return {
      id: node.id as string,
      uri: node.uri as AtUri,
      authorizedForm: (node.authorizedHeading ?? node.authorizedForm) as string,
      variantForms: Array.isArray(alternateHeadings) ? alternateHeadings : [],
      scopeNote: node.scope ? (node.scope as string) : undefined,
      status: (node.status as AuthorityRecord['status']) || 'established',
      sources: [],
      language: (node.language as string) || 'en',
      createdAt: new Date(node.createdAt as string),
      updatedAt: new Date(node.updatedAt as string),
    };
  }

  /**
   * Map Neo4j node properties to Facet.
   */
  private mapFacet(node: Record<string, string>): Facet {
    if (!node.id || !node.value || !node.createdAt || !node.updatedAt) {
      throw new DatabaseError('READ', 'Invalid facet node: missing required properties');
    }

    return {
      id: node.id,
      uri: node.uri as AtUri,
      facetType: node.facetType as Facet['facetType'],
      value: node.value,
      level: Number(node.level) || 0,
      materializedPath: node.materializedPath ?? undefined,
      parentUri: node.parentUri ? (node.parentUri as AtUri) : undefined,
      authorityRecordUri: node.authorityRecordUri ? (node.authorityRecordUri as AtUri) : undefined,
      createdAt: new Date(node.createdAt),
      updatedAt: new Date(node.updatedAt),
    };
  }

  /**
   * Map Neo4j node properties to FieldProposal (interface format).
   */
  private mapFieldProposal(node: Record<string, string | number | Date>): IFieldProposal {
    const createdAtValue = node.createdAt;
    const proposedByStr = node.proposedBy as string;
    const proposedBy = toDID(proposedByStr);

    if (!proposedBy) {
      throw new ValidationError(
        `Invalid DID in field proposal: ${proposedByStr}`,
        'proposedBy',
        'invalid_did'
      );
    }

    // Build changes object from stored Neo4j fields
    const changes: IFieldProposal['changes'] = {};

    if (node.fieldName) {
      (changes as Record<string, unknown>).label = node.fieldName as string;
    }
    if (node.description) {
      (changes as Record<string, unknown>).description = node.description as string;
    }
    if (node.alternateNames) {
      // alternateNames may be stored as JSON string or array
      const names = node.alternateNames;
      if (typeof names === 'string') {
        try {
          (changes as Record<string, unknown>).alternateNames = JSON.parse(names);
        } catch {
          // Ignore parse errors
        }
      } else if (Array.isArray(names)) {
        (changes as Record<string, unknown>).alternateNames = names;
      }
    }
    if (node.existingFieldUri) {
      (changes as Record<string, unknown>).parentId = node.existingFieldUri as string;
    }
    if (node.mergeTargetUri) {
      (changes as Record<string, unknown>).mergeTargetId = node.mergeTargetUri as string;
    }

    // Extract wikidataId from externalMappings JSON if present
    if (node.externalMappings) {
      try {
        const mappingsStr = node.externalMappings as string;
        const mappings = JSON.parse(mappingsStr) as { system: string; identifier: string }[];
        const wikidataMapping = mappings.find((m) => m.system === 'wikidata');
        if (wikidataMapping) {
          (changes as Record<string, unknown>).wikidataId = wikidataMapping.identifier;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    return {
      id: node.id as string,
      fieldId: node.fieldId as string,
      proposedBy,
      proposalType: node.proposalType as IFieldProposal['proposalType'],
      changes,
      rationale: node.rationale as string,
      status: node.status as IFieldProposal['status'],
      votes: {
        approve: Number(node.approveVotes) || 0,
        reject: Number(node.rejectVotes) || 0,
      },
      createdAt: createdAtValue instanceof Date ? createdAtValue : new Date(String(createdAtValue)),
    };
  }

  /**
   * Map Neo4j node properties to VoteRecord (interface format).
   */
  private mapVoteToInterface(node: Record<string, string | Date>): VoteRecord {
    const createdAtValue = node.createdAt;
    const voterDidStr = node.voterDid as string;
    const voterDid = toDID(voterDidStr);

    if (!voterDid) {
      throw new ValidationError(`Invalid DID in vote: ${voterDidStr}`, 'voterDid', 'invalid_did');
    }

    // Map internal voterRole to interface-compatible voterRole
    const internalRole = node.voterRole as string;
    const voterRoleMap: Record<string, VoteRecord['voterRole']> = {
      'community-member': 'community-member',
      'trusted-editor': 'reviewer',
      'authority-editor': 'domain-expert',
      'domain-expert': 'domain-expert',
      administrator: 'administrator',
      reviewer: 'reviewer',
    };
    const voterRole = voterRoleMap[internalRole] ?? 'community-member';

    return {
      uri: node.uri as string,
      proposalUri: node.proposalUri as string,
      voterDid,
      voterRole,
      vote: node.vote as VoteRecord['vote'],
      rationale: node.rationale ? (node.rationale as string) : undefined,
      createdAt: createdAtValue instanceof Date ? createdAtValue : new Date(String(createdAtValue)),
    };
  }

  /**
   * Type guard to validate facet type.
   *
   * @param value - Value to check
   * @returns True if value is a valid FacetType
   */
  private isValidFacetType(value: string): value is FacetType {
    return (FACET_TYPES as readonly string[]).includes(value);
  }

  /**
   * Searches authority records by query text, type, and status.
   *
   * @param query - Search query text
   * @param options - Search options (type, status, limit, offset)
   * @returns Matching authority records with pagination info
   *
   * @remarks
   * Uses Neo4j fulltext index for efficient text matching across
   * authorized headings and alternate headings.
   */
  async searchAuthorityRecords(
    query: string,
    options?: {
      readonly type?: 'person' | 'organization' | 'concept' | 'place';
      readonly status?: 'proposed' | 'under_review' | 'approved' | 'deprecated';
      readonly limit?: number;
      readonly offset?: number;
    }
  ): Promise<{
    readonly records: readonly IAuthorityRecord[];
    readonly total: number;
    readonly hasMore: boolean;
  }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    // Build conditions for type and status filters
    const conditions: string[] = [];
    const params: Record<string, string | number | neo4j.Integer> = {
      searchText: query,
      limit: neo4j.int(limit + 1), // Fetch one extra to check hasMore
      offset: neo4j.int(offset),
    };

    if (options?.type) {
      conditions.push('node.type = $type');
      params.type = options.type;
    }

    if (options?.status) {
      conditions.push('node.status = $status');
      params.status = options.status;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query using fulltext search index
    const searchQuery = `
      CALL db.index.fulltext.queryNodes('authorityTextIndex', $searchText)
      YIELD node, score
      ${whereClause}
      RETURN node, score
      ORDER BY score DESC
      SKIP $offset
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{
      node: Record<string, string | string[]>;
      score: number;
    }>(searchQuery, params);

    const records = result.records.map((record) => {
      const node = record.get('node');
      return {
        id: node.id as string,
        authorizedHeading: (node.authorizedHeading ?? node.authorizedForm) as string,
        alternateHeadings: Array.isArray(node.alternateHeadings)
          ? node.alternateHeadings
          : Array.isArray(node.variantForms)
            ? node.variantForms
            : [],
        scope: node.scope as string | undefined,
        source: (node.source as 'wikidata' | 'fast' | 'community') ?? 'community',
        wikidataId: node.wikidataId as string | undefined,
      };
    });

    const hasMore = records.length > limit;
    if (hasMore) {
      records.pop(); // Remove extra record
    }

    // Get total count
    const countQuery = `
      CALL db.index.fulltext.queryNodes('authorityTextIndex', $searchText)
      YIELD node
      ${whereClause}
      RETURN count(node) as total
    `;

    const countResult = await this.connection.executeQuery<{ total: number }>(countQuery, params);
    const total = countResult.records[0]?.get('total') ?? 0;

    return {
      records,
      total,
      hasMore,
    };
  }

  /**
   * Aggregates available facet values with counts for refinement UI.
   *
   * @param currentFacets - Currently selected facets to filter by
   * @returns Available facet values with counts per dimension
   *
   * @remarks
   * Returns facet values that would produce results if added to current filters.
   * Uses PMEST dimensions: personality, matter, energy, space, time.
   */
  async aggregateFacetRefinements(currentFacets: readonly IFacet[]): Promise<{
    readonly personality?: readonly { value: string; count: number }[];
    readonly matter?: readonly { value: string; count: number }[];
    readonly energy?: readonly { value: string; count: number }[];
    readonly space?: readonly { value: string; count: number }[];
    readonly time?: readonly { value: string; count: number }[];
  }> {
    // Build match clauses for current facets
    const facetMatches =
      currentFacets.length > 0
        ? currentFacets
            .map(
              (_, i) => `
      MATCH (p)-[:FACET_VALUE]->(cf${i}:Facet {
        facetType: $currentFacet${i}Type,
        value: $currentFacet${i}Value
      })
    `
            )
            .join('\n')
        : '';

    const params: Record<string, string> = {};
    currentFacets.forEach((facet, i) => {
      params[`currentFacet${i}Type`] = facet.dimension;
      params[`currentFacet${i}Value`] = facet.value;
    });

    // Query each dimension and build result
    const queryDimension = async (
      dimension: string
    ): Promise<{ value: string; count: number }[] | undefined> => {
      // Skip dimensions already filtered
      if (currentFacets.some((f) => f.dimension === dimension)) {
        return undefined;
      }

      const query = `
        MATCH (p:Preprint)
        ${facetMatches}
        MATCH (p)-[:FACET_VALUE]->(f:Facet {facetType: $dimension})
        WITH f.value as value, count(DISTINCT p) as count
        WHERE count > 0
        RETURN value, count
        ORDER BY count DESC
        LIMIT $dimLimit
      `;

      const dimResult = await this.connection.executeQuery<{
        value: string;
        count: number;
      }>(query, { ...params, dimension, dimLimit: neo4j.int(50) });

      if (dimResult.records.length === 0) {
        return undefined;
      }

      return dimResult.records.map((record) => ({
        value: record.get('value'),
        count: record.get('count'),
      }));
    };

    // Query all dimensions in parallel
    const [personality, matter, energy, space, time] = await Promise.all([
      queryDimension('personality'),
      queryDimension('matter'),
      queryDimension('energy'),
      queryDimension('space'),
      queryDimension('time'),
    ]);

    return {
      personality,
      matter,
      energy,
      space,
      time,
    };
  }
}
