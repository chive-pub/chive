/**
 * Actor XRPC handlers.
 *
 * @remarks
 * Handles pub.chive.actor.* endpoints for user profile management.
 *
 * @packageDocumentation
 * @public
 */

import { autocompleteAffiliationEndpoint } from './autocompleteAffiliation.js';
import { autocompleteKeywordEndpoint } from './autocompleteKeyword.js';
import { autocompleteOpenReviewEndpoint } from './autocompleteOpenReview.js';
import { autocompleteOrcidEndpoint } from './autocompleteOrcid.js';
import { discoverAuthorIdsEndpoint } from './discoverAuthorIds.js';
import { getDiscoverySettingsEndpoint } from './getDiscoverySettings.js';
import { getMyProfileEndpoint } from './getMyProfile.js';

export {
  autocompleteAffiliationEndpoint,
  autocompleteAffiliationHandler,
} from './autocompleteAffiliation.js';
export type {
  AffiliationSuggestion,
  AutocompleteAffiliationParams,
  AutocompleteAffiliationResponse,
} from './autocompleteAffiliation.js';

export { autocompleteKeywordEndpoint, autocompleteKeywordHandler } from './autocompleteKeyword.js';
export type {
  AutocompleteKeywordParams,
  AutocompleteKeywordResponse,
  KeywordSuggestion,
} from './autocompleteKeyword.js';

export { autocompleteOrcidEndpoint, autocompleteOrcidHandler } from './autocompleteOrcid.js';
export type {
  AutocompleteOrcidParams,
  AutocompleteOrcidResponse,
  OrcidSuggestion,
} from './autocompleteOrcid.js';

export {
  autocompleteOpenReviewEndpoint,
  autocompleteOpenReviewHandler,
} from './autocompleteOpenReview.js';
export type {
  AutocompleteOpenReviewParams,
  AutocompleteOpenReviewResponse,
  OpenReviewSuggestion,
} from './autocompleteOpenReview.js';

export { discoverAuthorIdsEndpoint, discoverAuthorIdsHandler } from './discoverAuthorIds.js';
export type {
  AuthorMatch,
  DiscoverAuthorIdsParams,
  DiscoverAuthorIdsResponse,
} from './discoverAuthorIds.js';

export { getMyProfileEndpoint, getMyProfileHandler } from './getMyProfile.js';
export type { ChiveProfile } from './getMyProfile.js';

export {
  getDiscoverySettingsEndpoint,
  getDiscoverySettingsHandler,
} from './getDiscoverySettings.js';
export type { DiscoverySettings } from './getDiscoverySettings.js';

/**
 * All actor endpoints.
 *
 * @public
 */
export const actorEndpoints = [
  autocompleteAffiliationEndpoint,
  autocompleteKeywordEndpoint,
  autocompleteOpenReviewEndpoint,
  autocompleteOrcidEndpoint,
  discoverAuthorIdsEndpoint,
  getDiscoverySettingsEndpoint,
  getMyProfileEndpoint,
] as const;
