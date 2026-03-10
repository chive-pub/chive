/**
 * Discovery components for related papers, citations, and onboarding.
 *
 * @packageDocumentation
 */

// Related papers components
export {
  RelatedPapersPanel,
  RelatedPapersPanelSkeleton,
  type RelatedPapersPanelProps,
  CitationSummary,
  CitationSummarySkeleton,
  type CitationSummaryProps,
  RelationshipBadge,
  RelationshipBadgeList,
  type RelationshipBadgeProps,
  type RelationshipBadgeListProps,
  AddRelatedPaperDialog,
  type AddRelatedPaperDialogProps,
} from './related';

// Citation components
export {
  CitationListPanel,
  type CitationListPanelProps,
  AddCitationDialog,
  type AddCitationDialogProps,
} from './citations';

// Onboarding components
export { AccountLinkingWizard, AccountLinkingDialog } from './onboarding';
