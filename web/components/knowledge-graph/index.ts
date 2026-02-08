/**
 * Knowledge graph components barrel export.
 *
 * @remarks
 * This module exports all knowledge graph-related components for
 * displaying nodes, fields, hierarchies, relationships, and navigation.
 * The unified knowledge graph model uses a single node type with
 * kind (type/object) and subkind (field, facet, institution, etc.).
 *
 * @example
 * ```tsx
 * import {
 *   KnowledgeGraphViewer,
 *   NodeSearch,
 *   FieldCard,
 *   FieldBreadcrumb,
 *   FieldRelationships,
 * } from '@/components/knowledge-graph';
 * ```
 */

// =============================================================================
// UNIFIED KNOWLEDGE GRAPH COMPONENTS
// =============================================================================

// Knowledge Graph Viewer - comprehensive graph exploration
export { KnowledgeGraphViewer, KnowledgeGraphViewerSkeleton } from './knowledge-graph-viewer';
export type {
  KnowledgeGraphViewerProps,
  GraphNode,
  GraphEdge,
  NodeKind,
  NodeStatus,
  ExternalId,
} from './knowledge-graph-viewer';

// Node Search - unified search component
export { NodeSearch } from './node-search';
export type {
  NodeSearchProps,
  NodeResult,
  NodeKind as NodeSearchKind,
  NodeStatus as NodeSearchStatus,
} from './node-search';

// =============================================================================
// FIELD COMPONENTS
// =============================================================================

// Field card
export { FieldCard, FieldCardSkeleton } from './field-card';
export type { FieldCardProps, FieldCardSkeletonProps } from './field-card';

// Field hierarchy
export {
  FieldBreadcrumb,
  FieldChildren,
  FieldTree,
  FieldBreadcrumbSkeleton,
} from './field-hierarchy';
export type {
  FieldBreadcrumbProps,
  FieldChildrenProps,
  FieldTreeProps,
  FieldBreadcrumbSkeletonProps,
} from './field-hierarchy';

// Field relationships
export {
  FieldRelationships,
  RelatedFieldBadges,
  FieldRelationshipsSkeleton,
} from './field-relationships';
export type {
  FieldRelationshipsProps,
  RelatedFieldBadgesProps,
  FieldRelationshipsSkeletonProps,
} from './field-relationships';

// Field external IDs
export { FieldExternalIds, FieldExternalIdsSkeleton } from './field-external-ids';
export type { FieldExternalIdsProps, FieldExternalIdsSkeletonProps } from './field-external-ids';

// Institution external IDs
export { InstitutionExternalIds, InstitutionExternalIdsSkeleton } from './institution-external-ids';
export type {
  InstitutionExternalIdsProps,
  InstitutionExternalIdsSkeletonProps,
  InstitutionExternalId,
  InstitutionIdSource,
} from './institution-external-ids';

// Node external IDs
export { NodeExternalIds, NodeExternalIdsSkeleton } from './node-external-ids';
export type {
  NodeExternalIdsProps,
  NodeExternalIdsSkeletonProps,
  NodeExternalId,
  NodeIdSource,
} from './node-external-ids';

// Author external IDs
export { AuthorExternalIds, AuthorExternalIdsSkeleton } from './author-external-ids';
export type {
  AuthorExternalIdsProps,
  AuthorExternalIdsSkeletonProps,
  AuthorExternalId,
  AuthorIdSource,
} from './author-external-ids';

// Field eprints
export { FieldEprints, FieldEprintsSkeleton } from './field-eprints';
export type { FieldEprintsProps, FieldEprintsSkeletonProps } from './field-eprints';

// Field visualization
export { FieldVisualization, FieldVisualizationSkeleton } from './field-visualization';
export type { FieldVisualizationProps } from './field-visualization';
