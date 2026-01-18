/**
 * Edge creator utility for seeding knowledge graph edges.
 *
 * @remarks
 * Provides a unified interface for creating edges (relationships) in both
 * the Governance PDS and Neo4j index. Ensures deterministic UUIDs for
 * idempotent seeding.
 *
 * @packageDocumentation
 */

import { edgeUuid } from './deterministic-uuid.js';

/**
 * Edge metadata for relationship-specific fields.
 */
export interface EdgeMetadata {
  /** Confidence score (0-1) */
  readonly confidence?: number;
  /** Start date (for temporal relationships) */
  readonly startDate?: string;
  /** End date (for temporal relationships) */
  readonly endDate?: string;
  /** Source of the relationship */
  readonly source?: string;
}

/**
 * Input for creating an edge.
 */
export interface CreateEdgeInput {
  /** Source node URI */
  readonly sourceUri: string;
  /** Target node URI */
  readonly targetUri: string;
  /** Relation slug (e.g., 'broader', 'narrower', 'related') */
  readonly relationSlug: string;
  /** Optional relation URI (for node-based relation types) */
  readonly relationUri?: string;
  /** Optional edge weight (0-1) */
  readonly weight?: number;
  /** Additional metadata */
  readonly metadata?: EdgeMetadata;
  /** Edge status */
  readonly status?: 'proposed' | 'established' | 'deprecated';
}

/**
 * Created edge with URI and ID.
 */
export interface CreatedEdge {
  readonly id: string;
  readonly uri: string;
  readonly sourceUri: string;
  readonly targetUri: string;
  readonly relationSlug: string;
}

/**
 * Options for EdgeCreator.
 */
export interface EdgeCreatorOptions {
  /** Governance PDS DID */
  readonly governanceDid: string;
  /** Governance PDS Writer (optional - for writing to PDS) */
  readonly pdsWriter?: {
    createEdge(collection: string, rkey: string, record: unknown): Promise<{ uri: string }>;
  };
  /** Neo4j adapter (optional - for indexing to Neo4j) */
  readonly neo4jAdapter?: {
    createEdge(edge: unknown): Promise<void>;
  };
  /** Logger */
  readonly logger: {
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, error?: Error, data?: Record<string, unknown>): void;
  };
  /** Dry run mode (log but don't write) */
  readonly dryRun?: boolean;
}

/**
 * Edge creator for seeding knowledge graph edges.
 */
export class EdgeCreator {
  private readonly options: EdgeCreatorOptions;
  private readonly createdEdges: Map<string, CreatedEdge> = new Map();

  constructor(options: EdgeCreatorOptions) {
    this.options = options;
  }

  /**
   * Creates an edge in the Governance PDS and Neo4j index.
   *
   * @param input - Edge creation input
   * @returns Created edge with URI
   */
  async createEdge(input: CreateEdgeInput): Promise<CreatedEdge> {
    const uuid = edgeUuid(input.sourceUri, input.targetUri, input.relationSlug);
    const uri = `at://${this.options.governanceDid}/pub.chive.graph.edge/${uuid}`;

    // Check if already created in this session
    const existing = this.createdEdges.get(uri);
    if (existing) {
      this.options.logger.info('Edge already created in session', {
        uri,
        relationSlug: input.relationSlug,
      });
      return existing;
    }

    const now = new Date().toISOString();

    // Build the record
    const record = {
      $type: 'pub.chive.graph.edge',
      id: uuid,
      sourceUri: input.sourceUri,
      targetUri: input.targetUri,
      relationUri: input.relationUri,
      relationSlug: input.relationSlug,
      weight: input.weight,
      metadata: input.metadata
        ? {
            confidence: input.metadata.confidence,
            startDate: input.metadata.startDate,
            endDate: input.metadata.endDate,
            source: input.metadata.source,
          }
        : undefined,
      status: input.status ?? 'established',
      createdAt: now,
    };

    if (this.options.dryRun) {
      this.options.logger.info('[DRY RUN] Would create edge', {
        uri,
        sourceUri: input.sourceUri,
        targetUri: input.targetUri,
        relationSlug: input.relationSlug,
      });
    } else {
      // Write to PDS if available
      if (this.options.pdsWriter) {
        try {
          await this.options.pdsWriter.createEdge('pub.chive.graph.edge', uuid, record);
          this.options.logger.info('Created edge in PDS', {
            uri,
            relationSlug: input.relationSlug,
          });
        } catch (error) {
          // If record already exists, log and continue
          if (error instanceof Error && error.message.includes('already exists')) {
            this.options.logger.info('Edge already exists in PDS', {
              uri,
              relationSlug: input.relationSlug,
            });
          } else {
            throw error;
          }
        }
      }

      // Index to Neo4j if available
      if (this.options.neo4jAdapter) {
        try {
          await this.options.neo4jAdapter.createEdge({
            uri,
            id: uuid,
            sourceUri: input.sourceUri,
            targetUri: input.targetUri,
            relationUri: input.relationUri,
            relationSlug: input.relationSlug,
            weight: input.weight,
            metadata: input.metadata,
            status: input.status ?? 'established',
            createdAt: new Date(now),
          });
          this.options.logger.info('Indexed edge in Neo4j', {
            uri,
            relationSlug: input.relationSlug,
          });
        } catch (error) {
          this.options.logger.error(
            'Failed to index edge in Neo4j',
            error instanceof Error ? error : undefined,
            { uri, relationSlug: input.relationSlug }
          );
          throw error;
        }
      }
    }

    const created: CreatedEdge = {
      id: uuid,
      uri,
      sourceUri: input.sourceUri,
      targetUri: input.targetUri,
      relationSlug: input.relationSlug,
    };

    this.createdEdges.set(uri, created);
    return created;
  }

  /**
   * Creates multiple edges.
   *
   * @param inputs - Array of edge creation inputs
   * @returns Array of created edges
   */
  async createEdges(inputs: readonly CreateEdgeInput[]): Promise<readonly CreatedEdge[]> {
    const results: CreatedEdge[] = [];
    for (const input of inputs) {
      const created = await this.createEdge(input);
      results.push(created);
    }
    return results;
  }

  /**
   * Creates edges with inverse relations automatically.
   *
   * @remarks
   * If a relation has an inverse (e.g., broader/narrower), this creates
   * both the forward and inverse edges.
   *
   * @param input - Edge creation input
   * @param inverseRelationSlug - Inverse relation slug
   * @returns Array of created edges [forward, inverse]
   */
  async createEdgeWithInverse(
    input: CreateEdgeInput,
    inverseRelationSlug: string
  ): Promise<readonly CreatedEdge[]> {
    const forward = await this.createEdge(input);
    const inverse = await this.createEdge({
      ...input,
      sourceUri: input.targetUri,
      targetUri: input.sourceUri,
      relationSlug: inverseRelationSlug,
    });
    return [forward, inverse];
  }

  /**
   * Gets a created edge by URI.
   */
  getCreatedEdge(uri: string): CreatedEdge | undefined {
    return this.createdEdges.get(uri);
  }

  /**
   * Gets all created edges.
   */
  getAllCreatedEdges(): readonly CreatedEdge[] {
    return Array.from(this.createdEdges.values());
  }

  /**
   * Generates an edge URI without creating the edge.
   * Useful for checking if an edge exists.
   */
  getEdgeUri(sourceUri: string, targetUri: string, relationSlug: string): string {
    const uuid = edgeUuid(sourceUri, targetUri, relationSlug);
    return `at://${this.options.governanceDid}/pub.chive.graph.edge/${uuid}`;
  }
}
