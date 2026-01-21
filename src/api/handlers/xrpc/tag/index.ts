/**
 * Tag XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

import { getDetail } from './getDetail.js';
import { getSuggestions } from './getSuggestions.js';
import { getTrending } from './getTrending.js';
import { listForEprint } from './listForEprint.js';
import { search } from './search.js';

export { getDetail as tagGetDetail } from './getDetail.js';
export { getSuggestions as tagGetSuggestions } from './getSuggestions.js';
export { getTrending as tagGetTrending } from './getTrending.js';
export { listForEprint as tagListForEprint } from './listForEprint.js';
export { search as tagSearch } from './search.js';

/**
 * Tag XRPC methods keyed by NSID.
 *
 * @public
 */
export const tagMethods = {
  'pub.chive.tag.getDetail': getDetail,
  'pub.chive.tag.getSuggestions': getSuggestions,
  'pub.chive.tag.getTrending': getTrending,
  'pub.chive.tag.listForEprint': listForEprint,
  'pub.chive.tag.search': search,
} as const;
