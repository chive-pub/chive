/**
 * Knowledge graph components barrel export.
 *
 * @remarks
 * This module exports all knowledge graph-related components for
 * displaying fields, hierarchies, relationships, and navigation.
 *
 * @example
 * ```tsx
 * import {
 *   FieldCard,
 *   FieldBreadcrumb,
 *   FieldRelationships,
 *   FieldPreprints,
 * } from '@/components/knowledge-graph';
 * ```
 */

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

// Field preprints
export { FieldPreprints, FieldPreprintsSkeleton } from './field-preprints';
export type { FieldPreprintsProps, FieldPreprintsSkeletonProps } from './field-preprints';

// Field visualization
export { FieldVisualization, FieldVisualizationSkeleton } from './field-visualization';
export type { FieldVisualizationProps } from './field-visualization';
