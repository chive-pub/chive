/**
 * Preprint components barrel export.
 *
 * @remarks
 * This module exports all preprint-related components for displaying
 * and interacting with preprint data from the Chive ATProto AppView.
 *
 * @example
 * ```tsx
 * import {
 *   PreprintCard,
 *   PreprintList,
 *   PreprintHeader,
 *   PreprintAbstract,
 *   PDFViewer,
 * } from '@/components/preprints';
 * ```
 */

// Author components
export { AuthorChip, AuthorChipList } from './author-chip';
export type { AuthorChipProps, AuthorChipListProps } from './author-chip';

// Field components
export { FieldBadge, FieldBadgeList } from './field-badge';
export type { FieldBadgeProps, FieldBadgeListProps } from './field-badge';

// Preprint card and list
export { PreprintCard, PreprintCardSkeleton } from './preprint-card';
export type { PreprintCardProps, PreprintCardSkeletonProps } from './preprint-card';

export {
  PreprintList,
  PreprintListSkeleton,
  PreprintListEmpty,
  InfinitePreprintList,
} from './preprint-list';
export type {
  PreprintListProps,
  PreprintListSkeletonProps,
  PreprintListEmptyProps,
  InfinitePreprintListProps,
} from './preprint-list';

// Preprint detail components
export { PreprintHeader, PreprintHeaderSkeleton, CompactPreprintHeader } from './preprint-header';
export type {
  PreprintHeaderProps,
  PreprintHeaderSkeletonProps,
  CompactPreprintHeaderProps,
} from './preprint-header';

export { PreprintAbstract, StaticAbstract } from './preprint-abstract';
export type { PreprintAbstractProps, StaticAbstractProps } from './preprint-abstract';

export { PreprintMetadata, KeywordList, LicenseBadge, DoiLink } from './preprint-metadata';
export type {
  PreprintMetadataProps,
  KeywordListProps,
  LicenseBadgeProps,
  DoiLinkProps,
} from './preprint-metadata';

export { PreprintMetrics, MetricCard } from './preprint-metrics';
export type { PreprintMetricsProps, MetricCardProps } from './preprint-metrics';

export { PreprintSource } from './preprint-source';
export type { PreprintSourceProps } from './preprint-source';

// Version components
export {
  PreprintVersionSelector,
  PreprintVersionTimeline,
  VersionBadge,
} from './preprint-versions';
export type {
  PreprintVersionSelectorProps,
  PreprintVersionTimelineProps,
  VersionBadgeProps,
} from './preprint-versions';

// PDF viewer
export { PDFViewer, PDFViewerSkeleton, PDFDownloadButton } from './pdf-viewer';
export type { PDFViewerProps, PDFViewerSkeletonProps, PDFDownloadButtonProps } from './pdf-viewer';

// Annotated PDF viewer (with react-pdf-highlighter-extended)
// NOTE: AnnotatedPDFViewer must be imported dynamically with ssr:false to avoid
// pdfjs-dist SSR errors. Use:
//   const AnnotatedPDFViewer = dynamic(
//     () => import('@/components/preprints/pdf-viewer-annotated').then((mod) => mod.AnnotatedPDFViewer),
//     { ssr: false, loading: () => <AnnotatedPDFViewerSkeleton /> }
//   );
// The skeleton is in a separate file for SSR-safe imports
export { AnnotatedPDFViewerSkeleton } from './pdf-viewer-skeleton';
// For types, import directly: import type { AnnotatedPDFViewerProps, ChiveHighlight } from '@/components/preprints/pdf-viewer-annotated'

// Author profile components
export { AuthorHeader, AuthorHeaderSkeleton } from './author-header';
export type { AuthorHeaderProps, AuthorHeaderSkeletonProps } from './author-header';

export { AuthorStats, AuthorStatsSkeleton } from './author-stats';
export type { AuthorStatsProps, AuthorStatsSkeletonProps } from './author-stats';

export { AuthorPreprints, AuthorPreprintsSkeleton } from './author-preprints';
export type { AuthorPreprintsProps, AuthorPreprintsSkeletonProps } from './author-preprints';

export { OrcidBadge, OrcidLink, isValidOrcid } from './orcid-badge';
export type { OrcidBadgeProps, OrcidLinkProps } from './orcid-badge';
