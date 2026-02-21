/**
 * Discovery components for personalized recommendations.
 *
 * @remarks
 * Components for the "For You" feed, related papers features,
 * user-curated related works, and citation management.
 * All components work with the discovery API endpoints.
 *
 * @packageDocumentation
 */

export { ForYouFeed, ForYouFeedSkeleton, type ForYouFeedProps } from './for-you-feed';
export {
  FeedEprintCard,
  FeedEprintCardSkeleton,
  type FeedEprintCardProps,
} from './feed-eprint-card';
export { FeedEmptyState, type FeedEmptyStateProps } from './feed-empty-state';
export {
  RecommendationBadge,
  RecommendationBadgeList,
  type RecommendationBadgeProps,
  type RecommendationBadgeListProps,
} from './recommendation-badge';

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
