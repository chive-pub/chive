/**
 * Discovery XRPC handlers.
 *
 * @remarks
 * Exports all discovery-related XRPC endpoint handlers:
 * - getRecommendations: Personalized paper recommendations
 * - getSimilar: Related papers for a preprint
 * - getCitations: Citation network data
 * - getEnrichment: External API enrichment data
 * - recordInteraction: Record user interactions for feedback loop
 *
 * @packageDocumentation
 * @public
 */

export { getRecommendationsHandler, getRecommendationsEndpoint } from './getRecommendations.js';
export { getForYouHandler, getForYouEndpoint } from './getForYou.js';
export { getSimilarHandler, getSimilarEndpoint } from './getSimilar.js';
export { getCitationsHandler, getCitationsEndpoint } from './getCitations.js';
export { getEnrichmentHandler, getEnrichmentEndpoint } from './getEnrichment.js';
export { recordInteractionHandler, recordInteractionEndpoint } from './recordInteraction.js';

import { getCitationsEndpoint } from './getCitations.js';
import { getEnrichmentEndpoint } from './getEnrichment.js';
import { getForYouEndpoint } from './getForYou.js';
import { getRecommendationsEndpoint } from './getRecommendations.js';
import { getSimilarEndpoint } from './getSimilar.js';
import { recordInteractionEndpoint } from './recordInteraction.js';

/**
 * All discovery XRPC endpoints.
 *
 * @public
 */
export const discoveryEndpoints = [
  getRecommendationsEndpoint,
  getForYouEndpoint,
  getSimilarEndpoint,
  getCitationsEndpoint,
  getEnrichmentEndpoint,
  recordInteractionEndpoint,
] as const;
