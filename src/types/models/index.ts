/**
 * Barrel export for all domain models.
 *
 * @packageDocumentation
 * @public
 */

export * from './annotation.js';
// Export all from author except ContributionDegree (also in contribution.ts)
export {
  type EprintAuthorAffiliation,
  type EprintAuthorContribution,
  type EprintAuthor,
  type Affiliation,
  type ResearchKeyword,
  type Author,
  type AuthorMetrics,
} from './author.js';
// Export all from contribution (includes ContributionDegree)
export * from './contribution.js';
// Export all from governance except ConsensusResult (also in graph.interface.ts)
export {
  type FacetDimension,
  type AuthorityStatus,
  type ExternalSource,
  type GovernanceAuthorityRecord,
  type GovernanceFacet,
  type GovernanceOrganization,
  type GovernanceReconciliation,
  type ReconciliationEvidence,
  type GovernanceListOptions,
  type GovernanceUpdateEvent,
  type GovernanceUpdateHandler,
  type GovernanceSubscription,
} from './governance.js';
// Export all from eprint except DocumentFormat (already exported from annotation)
export {
  type SupplementaryCategory,
  type SupplementaryMaterial,
  type PublicationStatus,
  type AccessType,
  type PublishedVersion,
  type RelatedWorkIdentifierType,
  type RelationType,
  type RelatedWork,
  type ExternalIds,
  type CodePlatform,
  type DataPlatform,
  type PreregistrationPlatform,
  type ProtocolPlatform,
  type CodeRepository,
  type DataRepository,
  type Preregistration,
  type Protocol,
  type Material,
  type Repositories,
  type FundingSource,
  type PresentationType,
  type ConferencePresentation,
  type Eprint,
  type EprintVersion,
  type UserTag,
} from './eprint.js';
// Export all from review except TextSpanTarget (re-exported from annotation.js)
export {
  type TextItem,
  type NodeRefItem,
  type EprintRefItem,
  type RichTextItem,
  type MotivationType,
  type Review,
  type Endorsement,
} from './review.js';
