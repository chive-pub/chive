/**
 * Node creator utility for seeding knowledge graph nodes.
 *
 * @remarks
 * Provides a unified interface for creating nodes in both the Governance PDS
 * and Neo4j index. Ensures deterministic UUIDs for idempotent seeding.
 *
 * @packageDocumentation
 */

import { nodeUuid } from './deterministic-uuid.js';
import type { NodeKind } from './subkinds.js';

/**
 * External ID for linking to external systems.
 */
export interface ExternalId {
  readonly system: string;
  readonly identifier: string;
  readonly uri?: string;
  readonly matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related';
}

/**
 * Node metadata for subkind-specific fields.
 */
export interface NodeMetadata {
  /** Country code (for institutions) */
  readonly country?: string;
  /** City (for institutions) */
  readonly city?: string;
  /** Website URL (for institutions, platforms) */
  readonly website?: string;
  /** Organization status (for institutions) */
  readonly organizationStatus?: 'active' | 'merged' | 'inactive' | 'defunct';
  /** MIME types (for document formats) */
  readonly mimeTypes?: readonly string[];
  /** SPDX ID (for licenses) */
  readonly spdxId?: string;
  /** Display order in UI selectors */
  readonly displayOrder?: number;
  /** CRO URI (for contribution types) */
  readonly croUri?: string;
}

/**
 * Input for creating a node.
 */
export interface CreateNodeInput {
  /** Human-readable slug (used for deterministic UUID generation) */
  readonly slug: string;
  /** Node kind (type or object) */
  readonly kind: NodeKind;
  /** Subkind identifier (optional - null for generic values) */
  readonly subkind?: string;
  /** Display label */
  readonly label: string;
  /** Alternate labels */
  readonly alternateLabels?: readonly string[];
  /** Description */
  readonly description?: string;
  /** External IDs */
  readonly externalIds?: readonly ExternalId[];
  /** Additional metadata */
  readonly metadata?: NodeMetadata;
  /** Node status */
  readonly status?: 'proposed' | 'provisional' | 'established' | 'deprecated';
}

/**
 * Created node with URI and ID.
 */
export interface CreatedNode {
  readonly id: string;
  readonly slug: string;
  readonly uri: string;
  readonly kind: NodeKind;
  readonly subkind?: string;
  readonly label: string;
}

/**
 * Options for NodeCreator.
 */
export interface NodeCreatorOptions {
  /** Governance PDS DID */
  readonly governanceDid: string;
  /** Governance PDS Writer (optional - for writing to PDS) */
  readonly pdsWriter?: {
    createNode(collection: string, rkey: string, record: unknown): Promise<{ uri: string }>;
  };
  /** Neo4j adapter (optional - for indexing to Neo4j) */
  readonly neo4jAdapter?: {
    upsertNode(node: unknown): Promise<void>;
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
 * Node creator for seeding knowledge graph nodes.
 */
export class NodeCreator {
  private readonly options: NodeCreatorOptions;
  private readonly createdNodes: Map<string, CreatedNode> = new Map();

  constructor(options: NodeCreatorOptions) {
    this.options = options;
  }

  /**
   * Creates a node in the Governance PDS and Neo4j index.
   *
   * @param input - Node creation input
   * @returns Created node with URI
   */
  async createNode(input: CreateNodeInput): Promise<CreatedNode> {
    // Use 'value' as default subkind for UUID generation when not specified
    const uuid = nodeUuid(input.subkind ?? 'value', input.slug);
    const uri = `at://${this.options.governanceDid}/pub.chive.graph.node/${uuid}`;

    // Check if already created in this session
    const existing = this.createdNodes.get(uri);
    if (existing) {
      this.options.logger.info('Node already created in session', { uri, label: input.label });
      return existing;
    }

    const now = new Date().toISOString();

    // Build the record
    const record = {
      $type: 'pub.chive.graph.node',
      id: uuid,
      slug: input.slug,
      kind: input.kind,
      subkind: input.subkind,
      label: input.label,
      alternateLabels: input.alternateLabels,
      description: input.description,
      externalIds: input.externalIds?.map((ext) => ({
        system: ext.system,
        identifier: ext.identifier,
        uri: ext.uri,
        matchType: ext.matchType,
      })),
      metadata: input.metadata,
      status: input.status ?? 'established',
      createdAt: now,
    };

    if (this.options.dryRun) {
      this.options.logger.info('[DRY RUN] Would create node', {
        uri,
        label: input.label,
        subkind: input.subkind,
      });
    } else {
      // Write to PDS if available
      if (this.options.pdsWriter) {
        try {
          await this.options.pdsWriter.createNode('pub.chive.graph.node', uuid, record);
          this.options.logger.info('Created node in PDS', { uri, label: input.label });
        } catch (error) {
          // If record already exists, log and continue
          if (error instanceof Error && error.message.includes('already exists')) {
            this.options.logger.info('Node already exists in PDS', { uri, label: input.label });
          } else {
            throw error;
          }
        }
      }

      // Index to Neo4j if available
      if (this.options.neo4jAdapter) {
        try {
          await this.options.neo4jAdapter.upsertNode({
            uri,
            id: uuid,
            kind: input.kind,
            subkind: input.subkind,
            label: input.label,
            alternateLabels: input.alternateLabels ?? [],
            description: input.description,
            externalIds: input.externalIds ?? [],
            metadata: input.metadata ?? {},
            status: input.status ?? 'established',
            createdAt: new Date(now),
          });
          this.options.logger.info('Indexed node in Neo4j', { uri, label: input.label });
        } catch (error) {
          this.options.logger.error(
            'Failed to index node in Neo4j',
            error instanceof Error ? error : undefined,
            { uri, label: input.label }
          );
          throw error;
        }
      }
    }

    const created: CreatedNode = {
      id: uuid,
      slug: input.slug,
      uri,
      kind: input.kind,
      subkind: input.subkind,
      label: input.label,
    };

    this.createdNodes.set(uri, created);
    return created;
  }

  /**
   * Creates multiple nodes.
   *
   * @param inputs - Array of node creation inputs
   * @returns Array of created nodes
   */
  async createNodes(inputs: readonly CreateNodeInput[]): Promise<readonly CreatedNode[]> {
    const results: CreatedNode[] = [];
    for (const input of inputs) {
      const created = await this.createNode(input);
      results.push(created);
    }
    return results;
  }

  /**
   * Gets a created node by URI.
   */
  getCreatedNode(uri: string): CreatedNode | undefined {
    return this.createdNodes.get(uri);
  }

  /**
   * Gets all created nodes.
   */
  getAllCreatedNodes(): readonly CreatedNode[] {
    return Array.from(this.createdNodes.values());
  }

  /**
   * Generates a node URI without creating the node.
   * Useful for creating edges to nodes that will be created later.
   */
  getNodeUri(subkind: string | undefined, slug: string): string {
    const uuid = nodeUuid(subkind ?? 'value', slug);
    return `at://${this.options.governanceDid}/pub.chive.graph.node/${uuid}`;
  }
}
