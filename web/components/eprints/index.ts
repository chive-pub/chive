/**
 * Eprint components barrel export.
 *
 * @remarks
 * This module exports all eprint-related components for displaying
 * and interacting with eprint data from the Chive ATProto AppView.
 *
 * @example
 * ```tsx
 * import {
 *   EprintCard,
 *   EprintList,
 *   EprintHeader,
 *   EprintAbstract,
 *   PDFViewer,
 * } from '@/components/eprints';
 * ```
 */

// Author components
export { AuthorChip, AuthorChipList } from './author-chip';
export type { AuthorChipProps, AuthorChipListProps } from './author-chip';

// Field components
export { FieldBadge, FieldBadgeList } from './field-badge';
export type { FieldBadgeProps, FieldBadgeListProps } from './field-badge';

// Eprint card and list
export { EprintCard, EprintCardSkeleton } from './eprint-card';
export type { EprintCardProps, EprintCardSkeletonProps } from './eprint-card';

export { EprintList, EprintListSkeleton, EprintListEmpty, InfiniteEprintList } from './eprint-list';
export type {
  EprintListProps,
  EprintListSkeletonProps,
  EprintListEmptyProps,
  InfiniteEprintListProps,
} from './eprint-list';

// Eprint detail components
export { EprintHeader, EprintHeaderSkeleton, CompactEprintHeader } from './eprint-header';
export type {
  EprintHeaderProps,
  EprintHeaderSkeletonProps,
  CompactEprintHeaderProps,
} from './eprint-header';

export { EprintAbstract, StaticAbstract } from './eprint-abstract';
export type { EprintAbstractProps, StaticAbstractProps } from './eprint-abstract';

export { EprintMetadata, KeywordList, LicenseBadge, DoiLink } from './eprint-metadata';
export type {
  EprintMetadataProps,
  KeywordListProps,
  LicenseBadgeProps,
  DoiLinkProps,
} from './eprint-metadata';

export { EprintMetrics, MetricCard } from './eprint-metrics';
export type { EprintMetricsProps, MetricCardProps } from './eprint-metrics';

export { EprintSource } from './eprint-source';
export type { EprintSourceProps } from './eprint-source';

// Version components
export { EprintVersionSelector, EprintVersionTimeline, VersionBadge } from './eprint-versions';
export type {
  EprintVersionSelectorProps,
  EprintVersionTimelineProps,
  VersionBadgeProps,
} from './eprint-versions';

// PDF viewer
export { PDFViewer, PDFViewerSkeleton, PDFDownloadButton } from './pdf-viewer';
export type { PDFViewerProps, PDFViewerSkeletonProps, PDFDownloadButtonProps } from './pdf-viewer';

// Annotated PDF viewer (with react-pdf-highlighter-extended)
// NOTE: AnnotatedPDFViewer must be imported dynamically with ssr:false to avoid
// pdfjs-dist SSR errors. Use:
//   const AnnotatedPDFViewer = dynamic(
//     () => import('@/components/eprints/pdf-viewer-annotated').then((mod) => mod.AnnotatedPDFViewer),
//     { ssr: false, loading: () => <AnnotatedPDFViewerSkeleton /> }
//   );
// The skeleton is in a separate file for SSR-safe imports
export { AnnotatedPDFViewerSkeleton } from './pdf-viewer-skeleton';
// For types, import directly: import type { AnnotatedPDFViewerProps, ChiveHighlight } from '@/components/eprints/pdf-viewer-annotated'

// Author profile components
export { AuthorHeader, AuthorHeaderSkeleton } from './author-header';
export type { AuthorHeaderProps, AuthorHeaderSkeletonProps } from './author-header';

export { AuthorStats, AuthorStatsSkeleton } from './author-stats';
export type { AuthorStatsProps, AuthorStatsSkeletonProps } from './author-stats';

export { AuthorEprints, AuthorEprintsSkeleton } from './author-eprints';
export type { AuthorEprintsProps, AuthorEprintsSkeletonProps } from './author-eprints';

export { OrcidBadge, OrcidLink, isValidOrcid } from './orcid-badge';
export type { OrcidBadgeProps, OrcidLinkProps } from './orcid-badge';

// Publication badge
export { PublicationBadge } from './publication-badge';
export type {
  PublicationBadgeProps,
  PublicationStatus,
  PublishedVersion,
} from './publication-badge';

// Supplementary materials panel
export { SupplementaryPanel } from './supplementary-panel';
export type {
  SupplementaryPanelProps,
  SupplementaryItem,
  SupplementaryCategory,
} from './supplementary-panel';

// Repositories panel (code, data, models)
export { RepositoriesPanel } from './repositories-panel';
export type { RepositoriesPanelProps } from './repositories-panel';

// Funding panel
export { FundingPanel } from './funding-panel';
export type { FundingPanelProps, FundingSource } from './funding-panel';

// Citation visualization
export { CitationVisualization, CitationVisualizationSkeleton } from './citation-visualization';
export type { CitationVisualizationProps } from './citation-visualization';
