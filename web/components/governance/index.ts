/**
 * Governance components for Chive.
 *
 * @remarks
 * Provides UI components for the community governance system
 * including proposal creation, voting, knowledge graph management,
 * and consensus visualization.
 *
 * @packageDocumentation
 */

// =============================================================================
// PROPOSAL COMPONENTS
// =============================================================================

export { ProposalForm, type ProposalFormProps, type ProposalFormValues } from './proposal-form';

// =============================================================================
// KNOWLEDGE GRAPH NODE MANAGEMENT
// =============================================================================

export {
  KnowledgeGraphNodeForm,
  type KnowledgeGraphNodeFormProps,
  type KnowledgeGraphNodeFormValues,
  type NodeKind,
  type NodeStatus,
  type ExternalIdSystem,
  type ExternalId,
} from './knowledge-graph-node-form';

// =============================================================================
// VOTING COMPONENTS
// =============================================================================

export {
  ContributionTypeVotePanel,
  ContributionTypeVoteList,
  type ContributionTypeVotePanelProps,
  type ContributionTypeVoteListProps,
} from './contribution-type-vote';

// =============================================================================
// TRUSTED EDITOR COMPONENTS
// =============================================================================

export {
  TrustedEditorStatus,
  TrustedEditorStatusSkeleton,
  type TrustedEditorStatusProps,
  type GovernanceRole,
  type ReputationMetrics,
  type EditorStatus,
} from './trusted-editor-status';

export {
  ConnectedTrustedEditorStatus,
  type ConnectedTrustedEditorStatusProps,
} from './connected-trusted-editor-status';

// =============================================================================
// ADMIN COMPONENTS
// =============================================================================

export {
  GovernanceAdminDashboard,
  GovernanceAdminDashboardSkeleton,
  type GovernanceAdminDashboardProps,
  type TrustedEditorRecord,
  type ElevationRequest,
  type DelegationRecord,
} from './governance-admin-dashboard';

export {
  ConnectedGovernanceAdminDashboard,
  type ConnectedGovernanceAdminDashboardProps,
} from './connected-governance-admin-dashboard';
