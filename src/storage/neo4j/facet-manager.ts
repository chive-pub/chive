import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';

import { Neo4jConnection } from './connection.js';
import type { Facet, FacetType } from './types.js';

/**
 * Facet search results
 */
export interface FacetSearchResult {
  facets: Facet[];
  total: number;
}

/**
 * Facet assignment for a record
 */
export interface FacetAssignment {
  recordUri: AtUri;
  facets: {
    facetType: FacetType;
    facetUri: AtUri;
    confidence: number;
  }[];
  assignedBy: string;
  assignedAt: Date;
}

/**
 * Facet dimension metadata
 */
export interface FacetDimension {
  type: FacetType;
  label: string;
  description: string;
  guidelines: string;
  examples: string[];
  rootUri?: AtUri;
}

/**
 * Facet usage statistics
 */
export interface FacetUsageStats {
  facetUri: AtUri;
  facetValue: string;
  facetType: FacetType;
  usageCount: number;
  uniqueRecords: number;
  lastUsed?: Date;
  trending: boolean;
  growthRate: number;
}

/**
 * Batch facet assignment result
 */
export interface BatchAssignmentResult {
  succeeded: number;
  failed: number;
  errors: { recordUri: string; error: string }[];
}

/**
 * Facet manager for 10-dimensional classification system.
 *
 * Manages faceted classification using PMEST (Personality, Matter, Energy, Space, Time)
 * and FAST (Person, Organization, Event, Work, Form-Genre) frameworks.
 *
 * All facet data is sourced from Governance PDS and indexed in Neo4j for fast lookups.
 * Facet assignments are made by users and stored in their PDSes.
 *
 * @example
 * ```typescript
 * const facetManager = container.resolve(FacetManager);
 *
 * // Create a facet value
 * const uri = await facetManager.createFacet({
 *   id: 'neural-networks',
 *   uri: 'at://did:plc:gov/pub.chive.graph.facet/nn',
 *   facetType: 'matter',
 *   value: 'Neural Networks',
 *   level: 1,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * });
 *
 * // Assign facets to a preprint
 * await facetManager.assignFacets('at://did:plc:user/pub.chive.preprint/123', [
 *   { facetType: 'matter', facetUri: uri, confidence: 0.95 }
 * ], 'did:plc:user');
 *
 * // Search by facets
 * const records = await facetManager.findRecordsByFacets([
 *   { facetType: 'matter', value: 'Neural Networks' }
 * ]);
 * ```
 */
@singleton()
export class FacetManager {
  /**
   * 10 facet dimensions: PMEST (5) + FAST (5)
   */
  private static readonly FACET_DIMENSIONS: readonly FacetDimension[] = [
    // PMEST Framework
    {
      type: 'personality',
      label: 'Personality',
      description: 'Who is the work about? (persons, organizations, entities)',
      guidelines:
        'Focus on the primary subject entity. Use for biographical works, case studies, or entity-centric research.',
      examples: ['Alan Turing', 'OpenAI', 'Human Genome Project', 'Marie Curie', 'CERN'],
    },
    {
      type: 'matter',
      label: 'Matter',
      description: 'What is the work about? (topics, concepts, phenomena)',
      guidelines: 'The core subject matter or field of study. Most works have a Matter facet.',
      examples: [
        'Machine Learning',
        'Quantum Computing',
        'Climate Change',
        'Gene Editing',
        'Dark Matter',
      ],
    },
    {
      type: 'energy',
      label: 'Energy',
      description:
        'What action or process does the work describe? (methods, techniques, operations)',
      guidelines: 'Verbs and processes. Use for methodological works or process descriptions.',
      examples: [
        'Gradient Descent',
        'CRISPR-Cas9',
        'Monte Carlo Simulation',
        'Deep Learning',
        'Spectroscopy',
      ],
    },
    {
      type: 'space',
      label: 'Space',
      description: 'Where does the work focus? (geographic locations, settings)',
      guidelines: 'Physical or virtual spaces. Use when location is a defining characteristic.',
      examples: [
        'Antarctica',
        'Mars',
        'Amazon Rainforest',
        'International Space Station',
        'Mariana Trench',
      ],
    },
    {
      type: 'time',
      label: 'Time',
      description: 'When does the work focus? (time periods, epochs, eras)',
      guidelines: 'Temporal focus. Use for historical studies or time-specific phenomena.',
      examples: [
        'Paleolithic Era',
        '21st Century',
        'COVID-19 Pandemic',
        'Industrial Revolution',
        'Anthropocene',
      ],
    },

    // FAST Framework (Faceted Application of Subject Terminology)
    {
      type: 'person',
      label: 'Person',
      description: 'Named individuals (FAST authority)',
      guidelines: 'Use authorized forms from FAST/LCSH. Prefer authority-controlled names.',
      examples: [
        'Einstein, Albert, 1879-1955',
        'Hawking, Stephen, 1942-2018',
        'Curie, Marie, 1867-1934',
      ],
    },
    {
      type: 'organization',
      label: 'Organization',
      description: 'Named organizations, institutions, companies (FAST authority)',
      guidelines: 'Use authorized forms. Include government agencies, universities, corporations.',
      examples: [
        'Massachusetts Institute of Technology',
        'World Health Organization',
        'Google (Firm)',
      ],
    },
    {
      type: 'event',
      label: 'Event',
      description: 'Named events, conferences, meetings (FAST authority)',
      guidelines:
        'Specific events with names. Use for conference proceedings or event-specific research.',
      examples: ['World War II (1939-1945)', 'NeurIPS (Conference)', 'Apollo 11 Mission'],
    },
    {
      type: 'work',
      label: 'Work',
      description: 'Named creative works, datasets, artifacts (FAST authority)',
      guidelines: 'Specific works being studied or referenced. Include datasets, models, software.',
      examples: ['ImageNet (Dataset)', 'BERT (Model)', 'Human Genome Reference'],
    },
    {
      type: 'form-genre',
      label: 'Form/Genre',
      description: 'Type or form of the work (FAST authority)',
      guidelines:
        'Describes what the work IS, not what it is ABOUT. Use for bibliographic classification.',
      examples: ['Review Articles', 'Case Studies', 'Tutorials', 'Surveys', 'Meta-Analyses'],
    },
  ];

  constructor(private connection: Neo4jConnection) {}

  /**
   * Initialize facet dimensions in the database.
   *
   * Creates the 10 root facet dimension nodes if they don't exist.
   * This is idempotent and safe to run multiple times.
   *
   * @throws {Error} If database initialization fails
   *
   * @example
   * ```typescript
   * await facetManager.initializeDimensions();
   * // Creates 10 FacetDimension nodes (personality, matter, energy, space, time,
   * // person, organization, event, work, form-genre)
   * ```
   */
  async initializeDimensions(): Promise<void> {
    await this.connection.executeTransaction(async (tx) => {
      for (const dim of FacetManager.FACET_DIMENSIONS) {
        await tx.run(
          `
          MERGE (fd:FacetDimension {type: $type})
          ON CREATE SET
            fd.label = $label,
            fd.description = $description,
            fd.guidelines = $guidelines,
            fd.examples = $examples,
            fd.createdAt = datetime()
          ON MATCH SET
            fd.label = $label,
            fd.description = $description,
            fd.guidelines = $guidelines,
            fd.examples = $examples,
            fd.updatedAt = datetime()
          `,
          {
            type: dim.type,
            label: dim.label,
            description: dim.description,
            guidelines: dim.guidelines,
            examples: dim.examples,
          }
        );
      }
    });
  }

  /**
   * Get all facet dimensions.
   *
   * @returns Array of all 10 facet dimensions
   */
  getFacetDimensions(): readonly FacetDimension[] {
    return FacetManager.FACET_DIMENSIONS;
  }

  /**
   * Get facet dimension by type.
   *
   * @param type - Facet type
   * @returns Facet dimension or null if not found
   */
  getFacetDimension(type: FacetType): FacetDimension | null {
    return FacetManager.FACET_DIMENSIONS.find((dim) => dim.type === type) ?? null;
  }

  /**
   * Create a new facet value.
   *
   * @param facet - Facet data
   * @returns AT-URI of created facet
   * @throws {Error} If facet with same ID already exists
   *
   * @example
   * ```typescript
   * const uri = await facetManager.createFacet({
   *   id: 'deep-learning',
   *   uri: 'at://did:plc:gov/pub.chive.graph.facet/dl',
   *   facetType: 'energy',
   *   value: 'Deep Learning',
   *   level: 1,
   *   materializedPath: '/deep-learning',
   *   createdAt: new Date(),
   *   updatedAt: new Date()
   * });
   * ```
   */
  async createFacet(facet: Facet): Promise<AtUri> {
    const query = `
      CREATE (f:Facet {
        id: $id,
        uri: $uri,
        facetType: $facetType,
        value: $value,
        level: $level,
        materializedPath: $materializedPath,
        parentUri: $parentUri,
        authorityRecordUri: $authorityRecordUri,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN f.uri as uri
    `;

    try {
      const result = await this.connection.executeQuery<{ uri: AtUri }>(query, {
        id: facet.id,
        uri: facet.uri,
        facetType: facet.facetType,
        value: facet.value,
        level: facet.level,
        materializedPath: facet.materializedPath ?? `/${facet.id}`,
        parentUri: facet.parentUri ?? null,
        authorityRecordUri: facet.authorityRecordUri ?? null,
      });

      const record = result.records[0];
      if (!record) {
        throw new DatabaseError(
          'CREATE',
          'Failed to create facet: no record returned from database'
        );
      }

      return record.get('uri');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.includes('already exists')) {
        throw new ValidationError(`Facet with ID ${facet.id} already exists`, 'id', 'unique');
      }
      throw error;
    }
  }

  /**
   * Update an existing facet value.
   *
   * @param uri - Facet AT-URI
   * @param updates - Fields to update
   * @throws {Error} If facet not found
   */
  async updateFacet(
    uri: AtUri,
    updates: Partial<Omit<Facet, 'id' | 'uri' | 'createdAt'>>
  ): Promise<void> {
    const setClauses: string[] = ['f.updatedAt = datetime()'];
    const params: Record<string, string | number | null> = { uri };

    if (updates.value !== undefined) {
      setClauses.push('f.value = $value');
      params.value = updates.value;
    }

    if (updates.facetType !== undefined) {
      setClauses.push('f.facetType = $facetType');
      params.facetType = updates.facetType;
    }

    if (updates.level !== undefined) {
      setClauses.push('f.level = $level');
      params.level = updates.level;
    }

    if (updates.materializedPath !== undefined) {
      setClauses.push('f.materializedPath = $materializedPath');
      params.materializedPath = updates.materializedPath ?? null;
    }

    if (updates.parentUri !== undefined) {
      setClauses.push('f.parentUri = $parentUri');
      params.parentUri = updates.parentUri ?? null;
    }

    if (updates.authorityRecordUri !== undefined) {
      setClauses.push('f.authorityRecordUri = $authorityRecordUri');
      params.authorityRecordUri = updates.authorityRecordUri ?? null;
    }

    const query = `
      MATCH (f:Facet {uri: $uri})
      SET ${setClauses.join(', ')}
      RETURN f
    `;

    const result = await this.connection.executeQuery(query, params);

    if (result.records.length === 0) {
      throw new NotFoundError('Facet', uri);
    }
  }

  /**
   * Get facet by ID.
   *
   * @param id - Facet identifier
   * @returns Facet or null if not found
   */
  async getFacetById(id: string): Promise<Facet | null> {
    const query = `
      MATCH (f:Facet {id: $id})
      RETURN f
    `;

    const result = await this.connection.executeQuery<{
      f: Record<string, string | number | Date>;
    }>(query, { id });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapFacet(record.get('f'));
  }

  /**
   * Get facet by URI.
   *
   * @param uri - Facet AT-URI
   * @returns Facet or null if not found
   */
  async getFacetByUri(uri: AtUri): Promise<Facet | null> {
    const query = `
      MATCH (f:Facet {uri: $uri})
      RETURN f
    `;

    const result = await this.connection.executeQuery<{
      f: Record<string, string | number | Date>;
    }>(query, { uri });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapFacet(record.get('f'));
  }

  /**
   * Search facets by value.
   *
   * @param facetType - Filter by facet type (optional)
   * @param searchText - Search query
   * @param limit - Maximum results (default: 50)
   * @returns Search results
   *
   * @example
   * ```typescript
   * const results = await facetManager.searchFacets('matter', 'neural');
   * console.log(`Found ${results.total} facets`);
   * results.facets.forEach(f => console.log(f.value));
   * ```
   */
  async searchFacets(
    facetType: FacetType | undefined,
    searchText: string,
    limit = 50
  ): Promise<FacetSearchResult> {
    const typeFilter = facetType ? 'AND node.facetType = $facetType' : '';

    const query = `
      CALL db.index.fulltext.queryNodes('facetTextIndex', $searchText)
      YIELD node, score
      WHERE node:Facet ${typeFilter}
      WITH node, score
      ORDER BY score DESC
      LIMIT $limit
      RETURN node
    `;

    const params: Record<string, string | number | neo4j.Integer> = {
      searchText,
      limit: neo4j.int(limit),
    };
    if (facetType) {
      params.facetType = facetType;
    }

    const result = await this.connection.executeQuery<{
      node: Record<string, string | number | Date>;
    }>(query, params);

    const facets = result.records.map((record) => this.mapFacet(record.get('node')));

    return {
      facets,
      total: facets.length,
    };
  }

  /**
   * List facets with pagination and filtering.
   *
   * @param options - Filter and pagination options
   * @returns Paginated facet list
   */
  async listFacets(options?: {
    facetType?: FacetType;
    level?: number;
    offset?: number;
    limit?: number;
  }): Promise<FacetSearchResult> {
    const conditions: string[] = [];
    const params: Record<string, string | number | neo4j.Integer> = {};

    if (options?.facetType) {
      conditions.push('f.facetType = $facetType');
      params.facetType = options.facetType;
    }

    if (options?.level !== undefined) {
      conditions.push('f.level = $level');
      params.level = options.level;
    }

    params.offset = neo4j.int(options?.offset ?? 0);
    params.limit = neo4j.int(options?.limit ?? 50);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      MATCH (f:Facet)
      ${whereClause}
      WITH f
      ORDER BY f.facetType, f.level, f.value
      SKIP $offset
      LIMIT $limit
      RETURN f
    `;

    const countQuery = `
      MATCH (f:Facet)
      ${whereClause}
      RETURN count(f) as total
    `;

    const [dataResult, countResult] = await Promise.all([
      this.connection.executeQuery<{
        f: Record<string, string | number | Date>;
      }>(query, params),
      this.connection.executeQuery<{ total: number }>(countQuery, params),
    ]);

    const facets = dataResult.records.map((record) => this.mapFacet(record.get('f')));
    const total = countResult.records[0]?.get('total') ?? 0;

    return {
      facets,
      total,
    };
  }

  /**
   * Add hierarchical relationship between facets.
   *
   * @param childUri - Child facet URI
   * @param parentUri - Parent facet URI
   *
   * @example
   * ```typescript
   * // "Deep Learning" is subtype of "Machine Learning"
   * await facetManager.addFacetHierarchy(
   *   'at://did:plc:gov/pub.chive.graph.facet/dl',
   *   'at://did:plc:gov/pub.chive.graph.facet/ml'
   * );
   * ```
   */
  async addFacetHierarchy(childUri: AtUri, parentUri: AtUri): Promise<void> {
    const query = `
      MATCH (child:Facet {uri: $childUri})
      MATCH (parent:Facet {uri: $parentUri})
      WHERE child.facetType = parent.facetType
      MERGE (child)-[r:SUBFACET_OF]->(parent)
      SET r.createdAt = CASE WHEN r.createdAt IS NULL THEN datetime() ELSE r.createdAt END,
          r.updatedAt = datetime(),
          child.level = parent.level + 1,
          child.parentUri = parent.uri,
          child.materializedPath = parent.materializedPath + '/' + child.id,
          child.updatedAt = datetime()
      RETURN r
    `;

    const result = await this.connection.executeQuery(query, {
      childUri,
      parentUri,
    });

    if (result.records.length === 0) {
      throw new ValidationError(
        `Cannot create hierarchy: facets not found or types don't match`,
        'facet_hierarchy',
        'type_match'
      );
    }
  }

  /**
   * Get child facets (narrower concepts).
   *
   * @param parentUri - Parent facet URI
   * @param maxDepth - Maximum depth to traverse (default: 1)
   * @returns Child facets
   */
  async getChildFacets(parentUri: AtUri, maxDepth = 1): Promise<Facet[]> {
    const query = `
      MATCH (parent:Facet {uri: $parentUri})<-[:SUBFACET_OF*1..$maxDepth]-(child:Facet)
      RETURN DISTINCT child
      ORDER BY child.level, child.value
    `;

    const result = await this.connection.executeQuery<{
      child: Record<string, string | number | Date>;
    }>(query, { parentUri, maxDepth: neo4j.int(maxDepth) });

    return result.records.map((record) => this.mapFacet(record.get('child')));
  }

  /**
   * Get parent facets (broader concepts).
   *
   * @param childUri - Child facet URI
   * @returns Parent facets (immediate parents only)
   */
  async getParentFacets(childUri: AtUri): Promise<Facet[]> {
    const query = `
      MATCH (child:Facet {uri: $childUri})-[:SUBFACET_OF]->(parent:Facet)
      RETURN parent
      ORDER BY parent.value
    `;

    const result = await this.connection.executeQuery<{
      parent: Record<string, string | number | Date>;
    }>(query, { childUri });

    return result.records.map((record) => this.mapFacet(record.get('parent')));
  }

  /**
   * Assign facets to a record (preprint, review, etc.).
   *
   * Creates FACET_VALUE relationships between the record and facet nodes.
   *
   * @param recordUri - Record AT-URI
   * @param facets - Facets to assign with confidence scores
   * @param assignedBy - DID of user making the assignment
   *
   * @example
   * ```typescript
   * await facetManager.assignFacets(
   *   'at://did:plc:user/pub.chive.preprint/123',
   *   [
   *     {
   *       facetType: 'matter',
   *       facetUri: 'at://did:plc:gov/pub.chive.graph.facet/ml',
   *       confidence: 0.95
   *     },
   *     {
   *       facetType: 'energy',
   *       facetUri: 'at://did:plc:gov/pub.chive.graph.facet/dl',
   *       confidence: 0.90
   *     }
   *   ],
   *   'did:plc:user'
   * );
   * ```
   */
  async assignFacets(
    recordUri: AtUri,
    facets: {
      facetType: FacetType;
      facetUri: AtUri;
      confidence: number;
    }[],
    assignedBy: string
  ): Promise<void> {
    await this.connection.executeTransaction(async (tx) => {
      for (const facet of facets) {
        await tx.run(
          `
          MERGE (record {uri: $recordUri})
          WITH record
          MATCH (facet:Facet {uri: $facetUri})
          WHERE facet.facetType = $facetType
          MERGE (record)-[r:FACET_VALUE {facetType: $facetType}]->(facet)
          SET r.confidence = $confidence,
              r.assignedBy = $assignedBy,
              r.assignedAt = CASE WHEN r.assignedAt IS NULL THEN datetime() ELSE r.assignedAt END,
              r.updatedAt = datetime()
          `,
          {
            recordUri,
            facetUri: facet.facetUri,
            facetType: facet.facetType,
            confidence: facet.confidence,
            assignedBy,
          }
        );
      }
    });
  }

  /**
   * Batch assign facets to multiple records.
   *
   * @param assignments - Array of facet assignments
   * @returns Operation result summary
   */
  async batchAssignFacets(
    assignments: {
      recordUri: AtUri;
      facets: {
        facetType: FacetType;
        facetUri: AtUri;
        confidence: number;
      }[];
      assignedBy: string;
    }[]
  ): Promise<BatchAssignmentResult> {
    const result: BatchAssignmentResult = {
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const assignment of assignments) {
      try {
        await this.assignFacets(assignment.recordUri, assignment.facets, assignment.assignedBy);
        result.succeeded++;
      } catch (err) {
        result.failed++;
        const error = err instanceof Error ? err : new Error(String(err));
        result.errors.push({
          recordUri: assignment.recordUri,
          error: error.message,
        });
      }
    }

    return result;
  }

  /**
   * Get facets assigned to a record.
   *
   * @param recordUri - Record AT-URI
   * @param facetType - Filter by facet type (optional)
   * @returns Assigned facets with confidence scores
   */
  async getFacetsForRecord(
    recordUri: AtUri,
    facetType?: FacetType
  ): Promise<
    {
      facet: Facet;
      confidence: number;
      assignedBy: string;
      assignedAt: Date;
    }[]
  > {
    const typeFilter = facetType ? 'AND r.facetType = $facetType' : '';

    const query = `
      MATCH (record {uri: $recordUri})-[r:FACET_VALUE]->(facet:Facet)
      WHERE true ${typeFilter}
      RETURN facet, r.confidence as confidence, r.assignedBy as assignedBy, r.assignedAt as assignedAt
      ORDER BY r.facetType, facet.value
    `;

    const params: Record<string, string> = { recordUri };
    if (facetType) {
      params.facetType = facetType;
    }

    const result = await this.connection.executeQuery<{
      facet: Record<string, string | number | Date>;
      confidence: number;
      assignedBy: string;
      assignedAt: string;
    }>(query, params);

    return result.records.map((record) => ({
      facet: this.mapFacet(record.get('facet')),
      confidence: Number(record.get('confidence')),
      assignedBy: record.get('assignedBy'),
      assignedAt: new Date(record.get('assignedAt')),
    }));
  }

  /**
   * Find records by facet assignments.
   *
   * @param facets - Facets to match (AND logic)
   * @param limit - Maximum results (default: 100)
   * @returns Record URIs matching all facets
   *
   * @example
   * ```typescript
   * const records = await facetManager.findRecordsByFacets([
   *   { facetType: 'matter', value: 'Machine Learning' },
   *   { facetType: 'energy', value: 'Deep Learning' }
   * ]);
   * // Returns records tagged with both facets
   * ```
   */
  async findRecordsByFacets(
    facets: { facetType: FacetType; value: string }[],
    limit = 100
  ): Promise<AtUri[]> {
    if (facets.length === 0) {
      return [];
    }

    // Build dynamic query for multiple facets (AND logic)
    const facetMatches = facets
      .map(
        (_, i) =>
          `MATCH (record)-[:FACET_VALUE]->(f${i}:Facet {facetType: $facet${i}Type, value: $facet${i}Value})`
      )
      .join('\n');

    const query = `
      ${facetMatches}
      RETURN DISTINCT record.uri as uri
      LIMIT $limit
    `;

    const params: Record<string, string | number | neo4j.Integer> = { limit: neo4j.int(limit) };
    facets.forEach((facet, i) => {
      params[`facet${i}Type`] = facet.facetType;
      params[`facet${i}Value`] = facet.value;
    });

    const result = await this.connection.executeQuery<{ uri: AtUri }>(query, params);

    return result.records.map((record) => record.get('uri'));
  }

  /**
   * Get facet usage statistics.
   *
   * @param facetUri - Facet AT-URI
   * @returns Usage statistics
   */
  async getFacetUsageStats(facetUri: AtUri): Promise<FacetUsageStats | null> {
    const query = `
      MATCH (facet:Facet {uri: $facetUri})
      OPTIONAL MATCH (record)-[r:FACET_VALUE]->(facet)
      WITH facet,
           count(DISTINCT record) as usageCount,
           max(r.assignedAt) as lastUsed
      RETURN facet.uri as facetUri,
             facet.value as facetValue,
             facet.facetType as facetType,
             usageCount,
             lastUsed
    `;

    const result = await this.connection.executeQuery<{
      facetUri: AtUri;
      facetValue: string;
      facetType: FacetType;
      usageCount: number;
      lastUsed: string | null;
    }>(query, { facetUri });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    const usageCount = Number(record.get('usageCount') ?? 0);
    const lastUsedStr = record.get('lastUsed');

    return {
      facetUri: record.get('facetUri'),
      facetValue: record.get('facetValue'),
      facetType: record.get('facetType'),
      usageCount,
      uniqueRecords: usageCount,
      lastUsed: lastUsedStr ? new Date(lastUsedStr) : undefined,
      trending: false, // Placeholder (would need time-series data)
      growthRate: 0, // Placeholder (would need historical data)
    };
  }

  /**
   * Get trending facets by usage.
   *
   * @param facetType - Filter by facet type (optional)
   * @param limit - Maximum results (default: 20)
   * @returns Top facets by usage
   */
  async getTrendingFacets(facetType?: FacetType, limit = 20): Promise<FacetUsageStats[]> {
    const typeFilter = facetType ? 'AND facet.facetType = $facetType' : '';

    const query = `
      MATCH (facet:Facet)
      WHERE true ${typeFilter}
      OPTIONAL MATCH (record)-[r:FACET_VALUE]->(facet)
      WITH facet,
           count(DISTINCT record) as usageCount,
           max(r.assignedAt) as lastUsed
      WHERE usageCount > 0
      RETURN facet.uri as facetUri,
             facet.value as facetValue,
             facet.facetType as facetType,
             usageCount,
             lastUsed
      ORDER BY usageCount DESC
      LIMIT $limit
    `;

    const params: Record<string, string | number | neo4j.Integer> = { limit: neo4j.int(limit) };
    if (facetType) {
      params.facetType = facetType;
    }

    const result = await this.connection.executeQuery<{
      facetUri: AtUri;
      facetValue: string;
      facetType: FacetType;
      usageCount: number;
      lastUsed: string | null;
    }>(query, params);

    return result.records.map((record) => {
      const usageCount = Number(record.get('usageCount') ?? 0);
      const lastUsedStr = record.get('lastUsed');

      return {
        facetUri: record.get('facetUri'),
        facetValue: record.get('facetValue'),
        facetType: record.get('facetType'),
        usageCount,
        uniqueRecords: usageCount,
        lastUsed: lastUsedStr ? new Date(lastUsedStr) : undefined,
        trending: true,
        growthRate: 0,
      };
    });
  }

  /**
   * Remove facet assignment from a record.
   *
   * @param recordUri - Record AT-URI
   * @param facetUri - Facet AT-URI
   */
  async removeFacetAssignment(recordUri: AtUri, facetUri: AtUri): Promise<void> {
    const query = `
      MATCH (record {uri: $recordUri})-[r:FACET_VALUE]->(facet:Facet {uri: $facetUri})
      DELETE r
    `;

    await this.connection.executeQuery(query, { recordUri, facetUri });
  }

  /**
   * Map Neo4j node to Facet type.
   */
  private mapFacet(node: Record<string, string | number | Date>): Facet {
    if (
      !node.id ||
      !node.uri ||
      !node.facetType ||
      !node.value ||
      !node.createdAt ||
      !node.updatedAt
    ) {
      throw new ValidationError(
        'Invalid facet node: missing required properties',
        'facet_node',
        'required'
      );
    }

    return {
      id: node.id as string,
      uri: node.uri as AtUri,
      facetType: node.facetType as FacetType,
      value: node.value as string,
      level: Number(node.level) || 0,
      materializedPath: (node.materializedPath as string) || undefined,
      parentUri: node.parentUri ? (node.parentUri as AtUri) : undefined,
      authorityRecordUri: node.authorityRecordUri ? (node.authorityRecordUri as AtUri) : undefined,
      createdAt: new Date(node.createdAt as string | Date),
      updatedAt: new Date(node.updatedAt as string | Date),
    };
  }
}
