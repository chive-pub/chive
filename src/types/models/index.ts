/**
 * Barrel export for all domain models.
 *
 * @packageDocumentation
 * @public
 */

export * from './annotation.js';
export * from './author.js';
export * from './contribution.js';
export * from './governance.js';
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
export * from './review.js';
