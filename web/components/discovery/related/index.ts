/**
 * Related papers components for discovery features.
 *
 * @remarks
 * Components for displaying related papers, citation networks,
 * relationship badges, and user-curated related work links
 * on eprint detail pages.
 *
 * @packageDocumentation
 */

export {
  RelatedPapersPanel,
  RelatedPapersPanelSkeleton,
  type RelatedPapersPanelProps,
} from './related-papers-panel';

export {
  CitationSummary,
  CitationSummarySkeleton,
  type CitationSummaryProps,
} from './citation-summary';

export {
  RelationshipBadge,
  RelationshipBadgeList,
  type RelationshipBadgeProps,
  type RelationshipBadgeListProps,
} from './relationship-badge';

export { AddRelatedPaperDialog, type AddRelatedPaperDialogProps } from './add-related-paper-dialog';
