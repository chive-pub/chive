/**
 * Shared types and configuration for knowledge graph components.
 *
 * @remarks
 * This module centralizes graph node types, subkind configuration, status
 * color helpers, and normalizer functions used by NodeCard, the knowledge
 * graph viewer, and collection components. Types were originally defined
 * inline in knowledge-graph-viewer.tsx and are re-exported here for reuse
 * across the unified card system.
 *
 * @packageDocumentation
 */

import { Layers, Building2, User, Tag, FileType, Scale, Award, Clock, Network } from 'lucide-react';

import type { CollectionItemView } from '@/lib/hooks/use-collections';

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Node kind in the unified model.
 */
export type NodeKind = 'type' | 'object';

/**
 * Node status.
 */
export type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * External ID entry.
 */
export interface ExternalId {
  system: string;
  identifier: string;
  uri?: string;
}

/**
 * Node from the knowledge graph.
 */
export interface GraphNode {
  uri: string;
  id: string;
  label: string;
  alternateLabels?: string[];
  description?: string;
  kind: NodeKind;
  subkind: string;
  status: NodeStatus;
  externalIds?: ExternalId[];
  createdAt: string;
}

/**
 * Edge in the knowledge graph.
 */
export interface GraphEdge {
  uri: string;
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
  status: string;
}

// =============================================================================
// UNIFIED CARD DATA
// =============================================================================

/**
 * Unified data shape for rendering any item as a node card.
 *
 * @remarks
 * This interface merges fields from GraphNode and CollectionItemView into a
 * single shape that the NodeCard component can render. Use the normalizer
 * functions (graphNodeToCardData, collectionItemToCardData) to convert
 * domain objects into this shape.
 */
export interface NodeCardData {
  uri: string;
  id: string;
  label: string;
  alternateLabels?: string[];
  description?: string;
  kind?: NodeKind;
  subkind?: string;
  status?: NodeStatus;
  externalIds?: ExternalId[];
  itemType?: string;
  note?: string;
  authors?: string[];
  createdAt?: string;
  detailPageUrl?: string | null;
  /** Avatar URL (for author items). */
  avatar?: string;
  /** Whether this node comes from the community graph or was created personally. */
  source?: 'community' | 'personal';
}

// =============================================================================
// SUBKIND CONFIGURATION
// =============================================================================

/**
 * Configuration for a node subkind (field, facet, license, etc.).
 */
export interface SubkindConfig {
  slug: string;
  kind: NodeKind;
  label: string;
  icon: typeof Network;
  description: string;
}

/**
 * All known subkind configurations.
 */
export const SUBKIND_CONFIGS: SubkindConfig[] = [
  // Type nodes
  {
    slug: 'field',
    kind: 'type',
    label: 'Academic Fields',
    icon: Layers,
    description: 'Research disciplines and subject areas',
  },
  {
    slug: 'facet',
    kind: 'type',
    label: 'Facets',
    icon: Tag,
    description: 'Classification dimensions',
  },
  {
    slug: 'contribution-type',
    kind: 'type',
    label: 'Contribution Types',
    icon: Award,
    description: 'CRediT contributor roles',
  },
  {
    slug: 'document-format',
    kind: 'type',
    label: 'Document Formats',
    icon: FileType,
    description: 'File format types',
  },
  {
    slug: 'license',
    kind: 'type',
    label: 'Licenses',
    icon: Scale,
    description: 'Distribution licenses',
  },
  {
    slug: 'publication-status',
    kind: 'type',
    label: 'Publication Statuses',
    icon: Clock,
    description: 'Publication lifecycle stages',
  },
  {
    slug: 'institution-type',
    kind: 'type',
    label: 'Institution Types',
    icon: Building2,
    description: 'Organization classifications',
  },
  {
    slug: 'paper-type',
    kind: 'type',
    label: 'Paper Types',
    icon: FileType,
    description: 'Research document types',
  },
  // Object nodes
  {
    slug: 'institution',
    kind: 'object',
    label: 'Institutions',
    icon: Building2,
    description: 'Research organizations',
  },
  {
    slug: 'person',
    kind: 'object',
    label: 'People',
    icon: User,
    description: 'Named individuals',
  },
  {
    slug: 'event',
    kind: 'object',
    label: 'Events',
    icon: Clock,
    description: 'Conferences and workshops',
  },
];

/**
 * Lookup map from subkind slug to its configuration.
 */
export const SUBKIND_BY_SLUG = new Map<string, SubkindConfig>(
  SUBKIND_CONFIGS.map((c) => [c.slug, c])
);

// =============================================================================
// STATUS COLOR HELPER
// =============================================================================

/**
 * Returns Tailwind class names for a node status badge.
 *
 * @param status - the node status
 * @returns CSS class string for background and text color
 */
export function getStatusColor(status: NodeStatus): string {
  switch (status) {
    case 'established':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'provisional':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'proposed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'deprecated':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
}

// =============================================================================
// NORMALIZER FUNCTIONS
// =============================================================================

/**
 * Converts a GraphNode into the unified NodeCardData shape.
 *
 * @param node - a node from the knowledge graph API
 * @returns unified card data for rendering in NodeCard
 */
export function graphNodeToCardData(node: GraphNode): NodeCardData {
  return {
    uri: node.uri,
    id: node.id,
    label: node.label,
    alternateLabels: node.alternateLabels,
    description: node.description,
    kind: node.kind,
    subkind: node.subkind,
    status: node.status,
    externalIds: node.externalIds,
    itemType: 'graphNode',
    createdAt: node.createdAt,
    detailPageUrl: node.subkind === 'field' ? `/fields/${node.id}` : null,
  };
}

/**
 * Converts a CollectionItemView into the unified NodeCardData shape.
 *
 * @remarks
 * All collection items are personal graph nodes. Detail page URLs are derived
 * from subkind + metadata rather than itemType:
 * - `subkind === 'eprint'` + `metadata.eprintUri` -> /eprints/{eprintUri}
 * - `subkind === 'person'` + `metadata.did` -> /authors/{did}
 * - `subkind === 'field'` -> /fields/{id}
 *
 * @param item - a collection item from the collections API
 * @returns unified card data for rendering in NodeCard
 */
export function collectionItemToCardData(item: CollectionItemView): NodeCardData {
  const id = item.itemUri.split('/').pop() ?? item.itemUri;
  const metadata = item.metadata ?? {};

  let detailPageUrl: string | null = null;
  if (item.subkind === 'eprint' && metadata.eprintUri) {
    detailPageUrl = `/eprints/${encodeURIComponent(metadata.eprintUri as string)}`;
  } else if (item.subkind === 'person' && metadata.did) {
    detailPageUrl = `/authors/${metadata.did as string}`;
  } else if (item.subkind === 'field') {
    detailPageUrl = `/fields/${id}`;
  }

  return {
    uri: item.itemUri,
    id,
    label: item.label ?? item.title ?? id,
    description: item.description,
    kind: item.kind as NodeKind | undefined,
    subkind: item.subkind,
    itemType: item.subkind ?? item.itemType,
    note: item.note,
    authors: item.authors,
    createdAt: item.addedAt,
    detailPageUrl,
    avatar: item.avatar,
    source: item.source as 'community' | 'personal' | undefined,
  };
}
