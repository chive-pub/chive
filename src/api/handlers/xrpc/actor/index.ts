/**
 * Actor XRPC handlers.
 *
 * @remarks
 * Handles pub.chive.actor.* endpoints for user profile management.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { autocompleteAffiliation } from './autocompleteAffiliation.js';
import { autocompleteKeyword } from './autocompleteKeyword.js';
import { autocompleteOpenReview } from './autocompleteOpenReview.js';
import { autocompleteOrcid } from './autocompleteOrcid.js';
import { discoverAuthorIds } from './discoverAuthorIds.js';
import { getDiscoverySettings } from './getDiscoverySettings.js';
import { getMyProfile } from './getMyProfile.js';

// Re-export handlers
export { autocompleteAffiliation } from './autocompleteAffiliation.js';
export { autocompleteKeyword } from './autocompleteKeyword.js';
export { autocompleteOrcid } from './autocompleteOrcid.js';
export { autocompleteOpenReview } from './autocompleteOpenReview.js';
export { discoverAuthorIds } from './discoverAuthorIds.js';
export { getMyProfile } from './getMyProfile.js';
export { getDiscoverySettings } from './getDiscoverySettings.js';

// Re-export types from generated lexicons for external consumers
export type {
  AffiliationSuggestion,
  QueryParams as AutocompleteAffiliationParams,
  OutputSchema as AutocompleteAffiliationResponse,
} from '../../../../lexicons/generated/types/pub/chive/actor/autocompleteAffiliation.js';

export type {
  QueryParams as AutocompleteKeywordParams,
  OutputSchema as AutocompleteKeywordResponse,
  KeywordSuggestion,
} from '../../../../lexicons/generated/types/pub/chive/actor/autocompleteKeyword.js';

export type {
  QueryParams as AutocompleteOrcidParams,
  OutputSchema as AutocompleteOrcidResponse,
  OrcidSuggestion,
} from '../../../../lexicons/generated/types/pub/chive/actor/autocompleteOrcid.js';

export type {
  QueryParams as AutocompleteOpenReviewParams,
  OutputSchema as AutocompleteOpenReviewResponse,
  OpenReviewSuggestion,
} from '../../../../lexicons/generated/types/pub/chive/actor/autocompleteOpenReview.js';

export type {
  AuthorMatch,
  QueryParams as DiscoverAuthorIdsParams,
  OutputSchema as DiscoverAuthorIdsResponse,
  ExternalIds,
} from '../../../../lexicons/generated/types/pub/chive/actor/discoverAuthorIds.js';

export type {
  Affiliation,
  OutputSchema as ChiveProfile,
  ResearchKeyword,
} from '../../../../lexicons/generated/types/pub/chive/actor/getMyProfile.js';

export type {
  OutputSchema as DiscoverySettings,
  ForYouSignals,
  RelatedPapersSignals,
} from '../../../../lexicons/generated/types/pub/chive/actor/getDiscoverySettings.js';

/**
 * Actor methods map keyed by NSID.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const actorMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.actor.autocompleteAffiliation': autocompleteAffiliation,
  'pub.chive.actor.autocompleteKeyword': autocompleteKeyword,
  'pub.chive.actor.autocompleteOpenReview': autocompleteOpenReview,
  'pub.chive.actor.autocompleteOrcid': autocompleteOrcid,
  'pub.chive.actor.discoverAuthorIds': discoverAuthorIds,
  'pub.chive.actor.getDiscoverySettings': getDiscoverySettings,
  'pub.chive.actor.getMyProfile': getMyProfile,
};
