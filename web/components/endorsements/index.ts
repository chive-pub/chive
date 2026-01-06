/**
 * Endorsement components for fine-grained contribution endorsements.
 *
 * Supports 15 contribution types derived from CRediT taxonomy:
 *
 * **Core Research**: methodological, analytical, theoretical, empirical, conceptual
 * **Technical**: technical, data
 * **Validation**: replication, reproducibility
 * **Synthesis**: synthesis, interdisciplinary
 * **Communication**: pedagogical, visualization
 * **Impact**: societal-impact, clinical
 *
 * Endorsers can select any subset of contribution types (minimum 1).
 *
 * @example
 * ```tsx
 * import { EndorsementPanel, EndorsementBadgeGroup } from '@/components/endorsements';
 *
 * // Full panel with list and filtering
 * <EndorsementPanel preprintUri={preprintUri} onEndorse={handleEndorse} />
 *
 * // Compact badges showing counts by contribution type
 * <EndorsementBadgeGroup summary={endorsementSummary} maxBadges={5} />
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// BADGE COMPONENTS
// =============================================================================

export {
  EndorsementBadge,
  EndorsementBadgeGroup,
  EndorsementBadgeSkeleton,
  EndorsementSummaryBadge,
  CONTRIBUTION_CONFIG,
  type EndorsementBadgeProps,
  type EndorsementBadgeGroupProps,
  type EndorsementSummaryBadgeProps,
} from './endorsement-badge';

// =============================================================================
// LIST COMPONENTS
// =============================================================================

export {
  EndorsementList,
  EndorsementItem,
  EndorserAvatarStack,
  EndorsementListSkeleton,
  type EndorsementListProps,
  type EndorsementItemProps,
} from './endorsement-list';

// =============================================================================
// PANEL COMPONENTS
// =============================================================================

export {
  EndorsementPanel,
  EndorsementSummaryCompact,
  EndorsementIndicator,
  type EndorsementPanelProps,
} from './endorsement-panel';

// =============================================================================
// FORM COMPONENTS
// =============================================================================

export {
  EndorsementForm,
  type EndorsementFormProps,
  type EndorsementFormData,
} from './endorsement-form';
