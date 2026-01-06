import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';

import { Neo4jConnection } from './connection.js';
import type {
  FieldNode,
  RelationshipType,
  FieldHierarchy,
  ExternalMapping,
  MatchType,
} from './types.js';

/**
 * Field search results
 */
export interface FieldSearchResult {
  fields: FieldNode[];
  total: number;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  succeeded: number;
  failed: number;
  errors: { id: string; error: string }[];
}

/**
 * Field repository for managing knowledge graph field nodes.
 *
 * @remarks
 * Handles all CRUD operations, hierarchical relationships, and SKOS-aligned
 * semantic relationships for field nodes in the knowledge graph.
 *
 * All operations maintain ATProto compliance. Field definitions are sourced
 * from Governance PDS, and Neo4j indexes the data for fast lookups. All data
 * is rebuildable from the firehose.
 *
 * This is an index-only repository that reads from the Governance PDS.
 * It never writes records back to any PDS (user or governance). All field
 * definitions originate in the Governance PDS and are indexed here. Indexes
 * are rebuildable from the ATProto firehose. The source of truth is always
 * the Governance PDS, not this Neo4j index.
 *
 * @example
 * ```typescript
 * const fieldRepo = container.resolve(FieldRepository);
 *
 * // Create a new field
 * const uri = await fieldRepo.createField({
 *   id: 'ml',
 *   uri: 'at://did:plc:gov/pub.chive.graph.field/ml',
 *   label: 'Machine Learning',
 *   type: 'field',
 *   level: 1,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * });
 *
 * // Add subfield relationship
 * await fieldRepo.addSubfield('ml', 'deep-learning');
 *
 * // Search fields
 * const results = await fieldRepo.searchFields('neural');
 * ```
 */
@singleton()
export class FieldRepository {
  constructor(private connection: Neo4jConnection) {}

  /**
   * Create a new field node.
   *
   * @param field - Field node data
   * @returns AT-URI of created field
   * @throws {Error} If field with same ID already exists
   *
   * @example
   * ```typescript
   * const uri = await fieldRepo.createField({
   *   id: 'quantum-computing',
   *   uri: 'at://did:plc:gov/pub.chive.graph.field/qc',
   *   label: 'Quantum Computing',
   *   type: 'field',
   *   description: 'Computing using quantum mechanics',
   *   wikidataId: 'Q484761',
   *   level: 2,
   *   createdAt: new Date(),
   *   updatedAt: new Date()
   * });
   * ```
   */
  async createField(field: FieldNode): Promise<AtUri> {
    const query = `
      CREATE (f:Field {
        id: $id,
        uri: $uri,
        label: $label,
        type: $type,
        description: $description,
        wikidataId: $wikidataId,
        level: $level,
        materializedPath: $materializedPath,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN f.uri as uri
    `;

    try {
      const result = await this.connection.executeQuery<{ uri: AtUri }>(query, {
        id: field.id,
        uri: field.uri,
        label: field.label,
        type: field.type,
        description: field.description ?? null,
        wikidataId: field.wikidataId ?? null,
        level: field.level,
        materializedPath: field.materializedPath ?? `/${field.id}`,
      });

      const record = result.records[0];
      if (!record) {
        throw new DatabaseError('CREATE', 'Failed to create field: no record returned');
      }

      return record.get('uri');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.includes('already exists')) {
        throw new ValidationError(`Field with ID ${field.id} already exists`, 'field.id', 'unique');
      }
      throw error;
    }
  }

  /**
   * Update an existing field node.
   *
   * @param uri - Field AT-URI
   * @param updates - Fields to update
   * @throws {Error} If field not found
   *
   * @example
   * ```typescript
   * await fieldRepo.updateField(
   *   'at://did:plc:gov/pub.chive.graph.field/ml',
   *   {
   *     description: 'Updated description',
   *     wikidataId: 'Q2539'
   *   }
   * );
   * ```
   */
  async updateField(
    uri: AtUri,
    updates: Partial<Omit<FieldNode, 'id' | 'uri' | 'createdAt'>>
  ): Promise<void> {
    const setClauses: string[] = ['f.updatedAt = datetime()'];
    const params: Record<string, string | number | null> = { uri };

    if (updates.label !== undefined) {
      setClauses.push('f.label = $label');
      params.label = updates.label;
    }

    if (updates.type !== undefined) {
      setClauses.push('f.type = $type');
      params.type = updates.type;
    }

    if (updates.description !== undefined) {
      setClauses.push('f.description = $description');
      params.description = updates.description ?? null;
    }

    if (updates.wikidataId !== undefined) {
      setClauses.push('f.wikidataId = $wikidataId');
      params.wikidataId = updates.wikidataId ?? null;
    }

    if (updates.level !== undefined) {
      setClauses.push('f.level = $level');
      params.level = updates.level;
    }

    if (updates.materializedPath !== undefined) {
      setClauses.push('f.materializedPath = $materializedPath');
      params.materializedPath = updates.materializedPath ?? null;
    }

    const query = `
      MATCH (f:Field {uri: $uri})
      SET ${setClauses.join(', ')}
      RETURN f
    `;

    const result = await this.connection.executeQuery(query, params);

    if (result.records.length === 0) {
      throw new NotFoundError('Field', uri);
    }
  }

  /**
   * Delete (deprecate) a field node.
   *
   * @param uri - Field AT-URI
   * @param reason - Deprecation reason
   * @throws {Error} If field not found or has active relationships
   *
   * @remarks
   * Performs soft delete by marking as deprecated rather than removing.
   * Hard deletion would break ATProto rebuildability.
   *
   * @example
   * ```typescript
   * await fieldRepo.deleteField(
   *   'at://did:plc:gov/pub.chive.graph.field/old',
   *   'Merged into newer field'
   * );
   * ```
   */
  async deleteField(uri: AtUri, reason: string): Promise<void> {
    // Check for active relationships
    const checkQuery = `
      MATCH (f:Field {uri: $uri})
      OPTIONAL MATCH (f)-[r]-()
      WHERE NOT type(r) = 'USE_INSTEAD'
      RETURN count(r) as relationshipCount
    `;

    const checkResult = await this.connection.executeQuery<{
      relationshipCount: number;
    }>(checkQuery, { uri });

    const relCount = checkResult.records[0]?.get('relationshipCount') ?? 0;

    if (relCount > 0) {
      throw new ValidationError(
        `Cannot delete field ${uri}: has ${relCount} active relationships`,
        'field',
        'has_relationships'
      );
    }

    // Soft delete
    const deleteQuery = `
      MATCH (f:Field {uri: $uri})
      SET f.deprecated = true,
          f.deprecationReason = $reason,
          f.deprecatedAt = datetime(),
          f.updatedAt = datetime()
      RETURN f
    `;

    const result = await this.connection.executeQuery(deleteQuery, {
      uri,
      reason,
    });

    if (result.records.length === 0) {
      throw new NotFoundError('Field', uri);
    }
  }

  /**
   * Get field by ID.
   *
   * @param id - Field identifier
   * @returns Field node or null if not found
   */
  async getFieldById(id: string): Promise<FieldNode | null> {
    const query = `
      MATCH (f:Field {id: $id})
      WHERE f.deprecated IS NULL OR f.deprecated = false
      RETURN f
    `;

    const result = await this.connection.executeQuery<{
      f: Record<string, string | number | Date>;
    }>(query, { id });

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
   * Get field by URI.
   *
   * @param uri - Field AT-URI
   * @returns Field node or null if not found
   */
  async getFieldByUri(uri: AtUri): Promise<FieldNode | null> {
    const query = `
      MATCH (f:Field {uri: $uri})
      WHERE f.deprecated IS NULL OR f.deprecated = false
      RETURN f
    `;

    const result = await this.connection.executeQuery<{
      f: Record<string, string | number | Date>;
    }>(query, { uri });

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
   * Full-text search on field labels and descriptions.
   *
   * @param searchText - Search query
   * @param limit - Maximum results (default: 50)
   * @returns Search results
   *
   * @example
   * ```typescript
   * const results = await fieldRepo.searchFields('neural network');
   * console.log(`Found ${results.total} fields`);
   * results.fields.forEach(f => console.log(f.label));
   * ```
   */
  async searchFields(searchText: string, limit = 50): Promise<FieldSearchResult> {
    const query = `
      CALL db.index.fulltext.queryNodes('fieldTextIndex', $searchText)
      YIELD node, score
      WHERE node:Field AND (node.deprecated IS NULL OR node.deprecated = false)
      WITH node, score
      ORDER BY score DESC
      LIMIT $limit
      RETURN node, score
    `;

    const result = await this.connection.executeQuery<{
      node: Record<string, string | number | Date>;
      score: number;
    }>(query, { searchText, limit: neo4j.int(limit) });

    const fields = result.records.map((record) => this.mapFieldNode(record.get('node')));

    return {
      fields,
      total: fields.length,
    };
  }

  /**
   * List fields with pagination.
   *
   * @param options - Pagination and filter options
   * @returns Paginated field list
   */
  async listFields(options?: {
    type?: FieldNode['type'];
    level?: number;
    offset?: number;
    limit?: number;
  }): Promise<FieldSearchResult> {
    const conditions: string[] = ['f.deprecated IS NULL OR f.deprecated = false'];
    const params: Record<string, string | number> = {};

    if (options?.type) {
      conditions.push('f.type = $type');
      params.type = options.type;
    }

    if (options?.level !== undefined) {
      conditions.push('f.level = $level');
      params.level = options.level;
    }

    params.offset = options?.offset ?? 0;
    params.limit = options?.limit ?? 50;

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      MATCH (f:Field)
      ${whereClause}
      WITH f
      ORDER BY f.label
      SKIP $offset
      LIMIT $limit
      RETURN f
    `;

    const countQuery = `
      MATCH (f:Field)
      ${whereClause}
      RETURN count(f) as total
    `;

    const [dataResult, countResult] = await Promise.all([
      this.connection.executeQuery<{ f: Record<string, string | number | Date> }>(query, params),
      this.connection.executeQuery<{ total: number }>(countQuery, params),
    ]);

    const fields = dataResult.records.map((record) => this.mapFieldNode(record.get('f')));
    const total = countResult.records[0]?.get('total') ?? 0;

    return {
      fields,
      total,
    };
  }

  /**
   * Add subfield relationship (hierarchical).
   *
   * @param parentId - Parent field ID
   * @param childId - Child field ID
   * @param order - Display order (optional)
   *
   * @example
   * ```typescript
   * // "Deep Learning" is subfield of "Machine Learning"
   * await fieldRepo.addSubfield('machine-learning', 'deep-learning');
   * ```
   */
  async addSubfield(parentId: string, childId: string, order?: number): Promise<void> {
    // Check for circular relationships
    const circularCheck = await this.wouldCreateCycle(parentId, childId);
    if (circularCheck) {
      throw new ValidationError(
        `Cannot add subfield: would create circular relationship between ${parentId} and ${childId}`,
        'childId',
        'circular_relationship'
      );
    }

    const query = `
      MATCH (parent:Field {id: $parentId})
      MATCH (child:Field {id: $childId})
      MERGE (child)-[r:SUBFIELD_OF]->(parent)
      SET r.order = $order,
          r.createdAt = CASE WHEN r.createdAt IS NULL THEN datetime() ELSE r.createdAt END,
          r.updatedAt = datetime()
      WITH child, parent
      SET child.level = parent.level + 1,
          child.materializedPath = parent.materializedPath + '/' + child.id,
          child.updatedAt = datetime()
      RETURN r
    `;

    const result = await this.connection.executeQuery(query, {
      parentId,
      childId,
      order: order ?? null,
    });

    if (result.records.length === 0) {
      throw new NotFoundError('Field', `${parentId} or ${childId}`);
    }

    // Update all descendants' paths
    await this.rebuildMaterializedPaths(childId);
  }

  /**
   * Check if adding relationship would create cycle.
   *
   * @param parentId - Parent field ID
   * @param childId - Child field ID
   * @returns True if would create cycle
   */
  private async wouldCreateCycle(parentId: string, childId: string): Promise<boolean> {
    const query = `
      MATCH (child:Field {id: $childId})
      MATCH (parent:Field {id: $parentId})
      MATCH path = (parent)-[:SUBFIELD_OF*]->(child)
      RETURN count(path) > 0 as hasCycle
    `;

    const result = await this.connection.executeQuery<{ hasCycle: boolean }>(query, {
      parentId,
      childId,
    });

    return result.records[0]?.get('hasCycle') ?? false;
  }

  /**
   * Remove subfield relationship.
   *
   * @param parentId - Parent field ID
   * @param childId - Child field ID
   */
  async removeSubfield(parentId: string, childId: string): Promise<void> {
    const query = `
      MATCH (child:Field {id: $childId})-[r:SUBFIELD_OF]->(parent:Field {id: $parentId})
      DELETE r
    `;

    await this.connection.executeQuery(query, { parentId, childId });
  }

  /**
   * Get parent fields (broader concepts).
   *
   * @param fieldId - Field ID
   * @returns Parent field nodes
   */
  async getParentFields(fieldId: string): Promise<FieldNode[]> {
    const query = `
      MATCH (field:Field {id: $fieldId})-[:SUBFIELD_OF]->(parent:Field)
      WHERE parent.deprecated IS NULL OR parent.deprecated = false
      RETURN parent
      ORDER BY parent.label
    `;

    const result = await this.connection.executeQuery<{
      parent: Record<string, string | number | Date>;
    }>(query, { fieldId });

    return result.records.map((record) => this.mapFieldNode(record.get('parent')));
  }

  /**
   * Get subfields (narrower concepts).
   *
   * @param fieldId - Field ID
   * @param maxDepth - Maximum depth to traverse (default: 1)
   * @returns Subfield nodes
   */
  async getSubfields(fieldId: string, maxDepth = 1): Promise<FieldNode[]> {
    const query = `
      MATCH (field:Field {id: $fieldId})<-[:SUBFIELD_OF*1..$maxDepth]-(child:Field)
      WHERE child.deprecated IS NULL OR child.deprecated = false
      RETURN DISTINCT child
      ORDER BY child.level, child.label
    `;

    const result = await this.connection.executeQuery<{
      child: Record<string, string | number | Date>;
    }>(query, { fieldId, maxDepth: neo4j.int(maxDepth) });

    return result.records.map((record) => this.mapFieldNode(record.get('child')));
  }

  /**
   * Reorder subfields.
   *
   * @param parentId - Parent field ID
   * @param orderedChildIds - Child IDs in desired order
   */
  async reorderSubfields(parentId: string, orderedChildIds: string[]): Promise<void> {
    await this.connection.executeTransaction(async (tx) => {
      for (let i = 0; i < orderedChildIds.length; i++) {
        await tx.run(
          `
          MATCH (child:Field {id: $childId})-[r:SUBFIELD_OF]->(parent:Field {id: $parentId})
          SET r.order = $order, r.updatedAt = datetime()
          `,
          {
            childId: orderedChildIds[i],
            parentId,
            order: i,
          }
        );
      }
    });
  }

  /**
   * Add BROADER_THAN relationship (SKOS).
   *
   * @param narrowerId - Narrower concept ID
   * @param broaderId - Broader concept ID
   */
  async addBroaderThan(narrowerId: string, broaderId: string): Promise<void> {
    await this.addSKOSRelationship(narrowerId, broaderId, 'BROADER_THAN');
  }

  /**
   * Add NARROWER_THAN relationship (SKOS).
   *
   * @param broaderId - Broader concept ID
   * @param narrowerId - Narrower concept ID
   */
  async addNarrowerThan(broaderId: string, narrowerId: string): Promise<void> {
    await this.addSKOSRelationship(broaderId, narrowerId, 'NARROWER_THAN');
  }

  /**
   * Add RELATED_TO relationship (SKOS associative).
   *
   * @param fieldId1 - First field ID
   * @param fieldId2 - Second field ID
   * @param strength - Relationship strength (0-1)
   */
  async addRelatedTo(fieldId1: string, fieldId2: string, strength = 1.0): Promise<void> {
    await this.addSKOSRelationship(fieldId1, fieldId2, 'RELATED_TO', strength);
  }

  /**
   * Add external mapping relationship (SKOS).
   *
   * @param fieldId - Chive field ID
   * @param externalSystem - External system name
   * @param externalId - External identifier
   * @param matchType - Type of match
   * @param uri - External URI
   */
  async addExternalMatch(
    fieldId: string,
    externalSystem: ExternalMapping['system'],
    externalId: string,
    matchType: MatchType,
    uri?: string
  ): Promise<void> {
    const relTypeMap: Record<MatchType, RelationshipType> = {
      'exact-match': 'EXACT_MATCH',
      'close-match': 'CLOSE_MATCH',
      'broad-match': 'BROAD_MATCH',
      'narrow-match': 'NARROW_MATCH',
      'related-match': 'RELATED_TO',
    };

    const query = `
      MATCH (field:Field {id: $fieldId})
      MERGE (ext:ExternalEntity {system: $system, identifier: $externalId})
      ON CREATE SET ext.uri = $uri, ext.createdAt = datetime()
      SET ext.updatedAt = datetime()
      MERGE (field)-[r:${relTypeMap[matchType]}]->(ext)
      SET r.createdAt = CASE WHEN r.createdAt IS NULL THEN datetime() ELSE r.createdAt END,
          r.updatedAt = datetime()
      RETURN r
    `;

    await this.connection.executeQuery(query, {
      fieldId,
      system: externalSystem,
      externalId,
      uri: uri ?? null,
    });
  }

  /**
   * Add SKOS relationship between fields.
   */
  private async addSKOSRelationship(
    fromId: string,
    toId: string,
    type: RelationshipType,
    strength?: number
  ): Promise<void> {
    const query = `
      MATCH (from:Field {id: $fromId})
      MATCH (to:Field {id: $toId})
      MERGE (from)-[r:${type}]->(to)
      SET r.strength = $strength,
          r.createdAt = CASE WHEN r.createdAt IS NULL THEN datetime() ELSE r.createdAt END,
          r.updatedAt = datetime()
      RETURN r
    `;

    const result = await this.connection.executeQuery(query, {
      fromId,
      toId,
      strength: strength ?? null,
    });

    if (result.records.length === 0) {
      throw new NotFoundError('Field', `${fromId} or ${toId}`);
    }
  }

  /**
   * Batch create fields.
   *
   * @param fields - Array of field nodes to create
   * @returns Operation result summary
   */
  async batchCreateFields(fields: FieldNode[]): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    await this.connection.executeTransaction(async (tx) => {
      for (const field of fields) {
        try {
          await tx.run(
            `
            CREATE (f:Field {
              id: $id,
              uri: $uri,
              label: $label,
              type: $type,
              description: $description,
              wikidataId: $wikidataId,
              level: $level,
              materializedPath: $materializedPath,
              createdAt: datetime(),
              updatedAt: datetime()
            })
            `,
            {
              id: field.id,
              uri: field.uri,
              label: field.label,
              type: field.type,
              description: field.description ?? null,
              wikidataId: field.wikidataId ?? null,
              level: field.level,
              materializedPath: field.materializedPath ?? `/${field.id}`,
            }
          );
          result.succeeded++;
        } catch (err) {
          result.failed++;
          const error = err instanceof Error ? err : new Error(String(err));
          result.errors.push({
            id: field.id,
            error: error.message,
          });
        }
      }
    });

    return result;
  }

  /**
   * Rebuild materialized paths for hierarchy.
   *
   * @param rootId - Root field ID to rebuild from
   */
  async rebuildMaterializedPaths(rootId: string): Promise<void> {
    const query = `
      MATCH (root:Field {id: $rootId})<-[:SUBFIELD_OF*0..]-(descendant:Field)
      WITH descendant
      MATCH path = (descendant)-[:SUBFIELD_OF*]->(ancestor:Field)
      WHERE NOT (ancestor)-[:SUBFIELD_OF]->()
      WITH descendant,
           '/' + reduce(s = '', node IN reverse(nodes(path)) | s + node.id + '/') + descendant.id as newPath
      SET descendant.materializedPath = newPath,
          descendant.level = size(split(newPath, '/')) - 2,
          descendant.updatedAt = datetime()
      RETURN count(descendant) as updated
    `;

    await this.connection.executeQuery(query, { rootId });
  }

  /**
   * Get field hierarchy as tree structure.
   *
   * @param rootId - Root field ID
   * @param maxDepth - Maximum depth
   * @returns Hierarchical tree structure
   */
  async getFieldHierarchy(rootId: string, maxDepth = 10): Promise<FieldHierarchy> {
    const root = await this.getFieldById(rootId);
    if (!root) {
      throw new NotFoundError('Field', rootId);
    }

    const children = await this.getSubfields(rootId, maxDepth);

    return this.buildHierarchyTree(root, children);
  }

  /**
   * Build hierarchical tree from flat list.
   */
  private buildHierarchyTree(root: FieldNode, allDescendants: FieldNode[]): FieldHierarchy {
    const directChildren = allDescendants.filter(
      (node) => node.materializedPath === `${root.materializedPath}/${node.id}`
    );

    const childTrees = directChildren.map((child) =>
      this.buildHierarchyTree(child, allDescendants)
    );

    return {
      root,
      children: childTrees,
      depth: root.level,
    };
  }

  /**
   * Map Neo4j node to FieldNode type.
   */
  private mapFieldNode(node: Record<string, string | number | Date>): FieldNode {
    return {
      id: node.id as string,
      uri: node.uri as AtUri,
      label: node.label as string,
      type: node.type as FieldNode['type'],
      description: (node.description as string) || undefined,
      wikidataId: (node.wikidataId as string) || undefined,
      level: Number(node.level) || 0,
      materializedPath: (node.materializedPath as string) || undefined,
      createdAt: new Date(node.createdAt as string | Date),
      updatedAt: new Date(node.updatedAt as string | Date),
    };
  }
}
