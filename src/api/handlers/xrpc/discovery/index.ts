/**
 * XRPC discovery handler exports.
 *
 * @remarks
 * Exports all discovery-related XRPC methods:
 * - getSimilar: Related papers for an eprint
 * - getCitations: Citation network data
 * - getEnrichment: External API enrichment data
 * - recordInteraction: Record user interactions for feedback loop
 *
 * @packageDocumentation
 * @public
 */

export { getCitations } from './getCitations.js';
export { getEnrichment } from './getEnrichment.js';
export { getSimilar } from './getSimilar.js';
export { recordInteraction } from './recordInteraction.js';

import { getCitations } from './getCitations.js';
import { getEnrichment } from './getEnrichment.js';
import { getSimilar } from './getSimilar.js';
import { recordInteraction } from './recordInteraction.js';

/**
 * All discovery XRPC methods keyed by NSID.
 */
export const discoveryMethods = {
  'pub.chive.discovery.getSimilar': getSimilar,
  'pub.chive.discovery.getCitations': getCitations,
  'pub.chive.discovery.getEnrichment': getEnrichment,
  'pub.chive.discovery.recordInteraction': recordInteraction,
} as const;
