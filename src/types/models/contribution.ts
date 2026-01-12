/**
 * Contribution type domain models.
 *
 * @remarks
 * This module defines domain models for contribution types (CRediT taxonomy)
 * and contribution type proposals. All models are immutable (readonly properties).
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, DID, Timestamp } from '../atproto.js';

/**
 * Semantic match type for external mappings.
 *
 * @public
 */
export type SemanticMatchType = 'exact-match' | 'close-match' | 'broad-match' | 'narrow-match';

/**
 * External system identifier for contribution type mappings.
 *
 * @public
 */
export type ContributionMappingSystem = 'credit' | 'cro' | 'scoro' | 'pro';

/**
 * External mapping to ontology or standard.
 *
 * @remarks
 * Links contribution types to external ontologies like CRediT, CRO, SCoRO.
 *
 * @public
 */
export interface ContributionTypeExternalMapping {
  /**
   * External system identifier.
   */
  readonly system: ContributionMappingSystem;

  /**
   * Identifier in the external system.
   *
   * @example "conceptualization", "CRO:0000064"
   */
  readonly identifier: string;

  /**
   * Full URI in the external system.
   *
   * @example "https://credit.niso.org/contributor-roles/conceptualization/"
   */
  readonly uri?: string;

  /**
   * Type of semantic match.
   */
  readonly matchType?: SemanticMatchType;
}

/**
 * Authority record status.
 *
 * @public
 */
export type ContributionTypeStatus = 'established' | 'provisional' | 'deprecated';

/**
 * Contribution type authority record.
 *
 * @remarks
 * Represents a contribution type in the Governance PDS. Based on CRediT
 * (Contributor Roles Taxonomy) standard.
 *
 * @see {@link https://credit.niso.org/ | CRediT - NISO}
 * @public
 */
export interface ContributionType {
  /**
   * AT URI of the contribution type record.
   *
   * @example "at://did:plc:chive-governance/pub.chive.contribution.type/conceptualization"
   */
  readonly uri: AtUri;

  /**
   * Contribution type identifier.
   *
   * @example "conceptualization", "data-curation"
   */
  readonly id: string;

  /**
   * Human-readable label.
   *
   * @example "Conceptualization", "Data Curation"
   */
  readonly label: string;

  /**
   * Detailed description of the contribution type.
   *
   * @example "Ideas; formulation or evolution of overarching research goals and aims"
   */
  readonly description: string;

  /**
   * Links to external ontologies (CRediT, CRO, SCoRO, etc.).
   */
  readonly externalMappings: readonly ContributionTypeExternalMapping[];

  /**
   * Authority record status.
   */
  readonly status: ContributionTypeStatus;

  /**
   * AT URI of the proposal that created this type (null for seeded types).
   */
  readonly proposalUri?: AtUri;

  /**
   * AT URI of the type that supersedes this one (if deprecated).
   */
  readonly deprecatedBy?: AtUri;

  /**
   * Creation timestamp.
   */
  readonly createdAt: Timestamp;

  /**
   * Last update timestamp.
   */
  readonly updatedAt?: Timestamp;
}

/**
 * Proposal type for contribution type changes.
 *
 * @public
 */
export type ContributionTypeProposalType = 'create' | 'update' | 'deprecate';

/**
 * Vote tally for a proposal.
 *
 * @public
 */
export interface ProposalVoteTally {
  /**
   * Number of approve votes.
   */
  readonly approve: number;

  /**
   * Number of reject votes.
   */
  readonly reject: number;

  /**
   * Total number of votes.
   */
  readonly total: number;

  /**
   * Number of expert votes.
   */
  readonly expertVotes: number;

  /**
   * Whether quorum has been met.
   */
  readonly quorumMet: boolean;

  /**
   * Whether all thresholds have been met.
   */
  readonly thresholdsMet: boolean;
}

/**
 * Proposal status.
 *
 * @public
 */
export type ContributionTypeProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Community proposal for new contribution type.
 *
 * @remarks
 * Stored in user's PDS, indexed by Chive AppView. Following the governance
 * pattern for field proposals.
 *
 * @public
 */
export interface ContributionTypeProposal {
  /**
   * AT URI of the proposal record.
   */
  readonly uri: AtUri;

  /**
   * DID of the user who created the proposal.
   */
  readonly proposer: DID;

  /**
   * Type of proposal.
   */
  readonly proposalType: ContributionTypeProposalType;

  /**
   * Existing type ID (for updates/deprecations).
   */
  readonly typeId?: string;

  /**
   * Proposed type identifier.
   *
   * @example "clinical-trials"
   */
  readonly proposedId: string;

  /**
   * Human-readable label.
   *
   * @example "Clinical Trials"
   */
  readonly proposedLabel: string;

  /**
   * Detailed description of contribution type.
   */
  readonly proposedDescription?: string;

  /**
   * Links to external ontologies.
   */
  readonly externalMappings: readonly ContributionTypeExternalMapping[];

  /**
   * Justification for proposal.
   */
  readonly rationale: string;

  /**
   * AT URI of type to be deprecated (for deprecate proposals).
   */
  readonly supersedes?: AtUri;

  /**
   * Current proposal status.
   */
  readonly status: ContributionTypeProposalStatus;

  /**
   * Current vote tally (computed by AppView).
   */
  readonly voteTally?: ProposalVoteTally;

  /**
   * Proposal creation timestamp.
   */
  readonly createdAt: Timestamp;

  /**
   * Voting deadline (computed from createdAt + review period).
   */
  readonly votingDeadline?: Timestamp;
}

/**
 * CRediT taxonomy role definition.
 *
 * @remarks
 * Used for seeding the 14 standard CRediT roles.
 *
 * @public
 */
export interface CreditRole {
  /**
   * Role identifier (kebab-case).
   */
  readonly id: string;

  /**
   * Human-readable label.
   */
  readonly label: string;

  /**
   * Official CRediT description.
   */
  readonly description: string;

  /**
   * CRediT URI.
   */
  readonly creditUri: string;

  /**
   * CRO identifier (if available).
   */
  readonly croId?: string;
}

/**
 * Standard CRediT taxonomy roles (14 roles).
 *
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | CRediT Roles}
 * @public
 */
export const CREDIT_TAXONOMY: readonly CreditRole[] = [
  {
    id: 'conceptualization',
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims',
    creditUri: 'https://credit.niso.org/contributor-roles/conceptualization/',
  },
  {
    id: 'data-curation',
    label: 'Data Curation',
    description:
      'Management activities to annotate (produce metadata), scrub data and maintain research data for initial use and later reuse',
    creditUri: 'https://credit.niso.org/contributor-roles/data-curation/',
  },
  {
    id: 'formal-analysis',
    label: 'Formal Analysis',
    description:
      'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data',
    creditUri: 'https://credit.niso.org/contributor-roles/formal-analysis/',
  },
  {
    id: 'funding-acquisition',
    label: 'Funding Acquisition',
    description: 'Acquisition of the financial support for the project leading to this publication',
    creditUri: 'https://credit.niso.org/contributor-roles/funding-acquisition/',
  },
  {
    id: 'investigation',
    label: 'Investigation',
    description:
      'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection',
    creditUri: 'https://credit.niso.org/contributor-roles/investigation/',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    description: 'Development or design of methodology; creation of models',
    creditUri: 'https://credit.niso.org/contributor-roles/methodology/',
  },
  {
    id: 'project-administration',
    label: 'Project Administration',
    description:
      'Management and coordination responsibility for the research activity planning and execution',
    creditUri: 'https://credit.niso.org/contributor-roles/project-administration/',
  },
  {
    id: 'resources',
    label: 'Resources',
    description:
      'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools',
    creditUri: 'https://credit.niso.org/contributor-roles/resources/',
  },
  {
    id: 'software',
    label: 'Software',
    description:
      'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms; testing of existing code components',
    creditUri: 'https://credit.niso.org/contributor-roles/software/',
  },
  {
    id: 'supervision',
    label: 'Supervision',
    description:
      'Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team',
    creditUri: 'https://credit.niso.org/contributor-roles/supervision/',
  },
  {
    id: 'validation',
    label: 'Validation',
    description:
      'Verification, whether as a part of the activity or separate, of the overall replication/reproducibility of results/experiments and other research outputs',
    creditUri: 'https://credit.niso.org/contributor-roles/validation/',
  },
  {
    id: 'visualization',
    label: 'Visualization',
    description:
      'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation',
    creditUri: 'https://credit.niso.org/contributor-roles/visualization/',
  },
  {
    id: 'writing-original-draft',
    label: 'Writing - Original Draft',
    description:
      'Preparation, creation and/or presentation of the published work, specifically writing the initial draft (including substantive translation)',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-original-draft/',
  },
  {
    id: 'writing-review-editing',
    label: 'Writing - Review & Editing',
    description:
      'Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision – including pre- or post-publication stages',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-review-editing/',
  },
] as const;
