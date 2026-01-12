/**
 * Tag XRPC endpoint exports.
 *
 * @packageDocumentation
 * @public
 */

export {
  listForEprintEndpoint as listTagsForEprintEndpoint,
  listForEprintHandler as listTagsForEprintHandler,
} from './listForEprint.js';
export { getSuggestionsEndpoint, getSuggestionsHandler } from './getSuggestions.js';
export {
  getTrendingEndpoint as getTrendingTagsEndpoint,
  getTrendingHandler as getTrendingTagsHandler,
} from './getTrending.js';
export {
  searchEndpoint as searchTagsEndpoint,
  searchHandler as searchTagsHandler,
} from './search.js';
export {
  getDetailEndpoint as getTagDetailEndpoint,
  getDetailHandler as getTagDetailHandler,
} from './getDetail.js';

import { getDetailEndpoint } from './getDetail.js';
import { getSuggestionsEndpoint } from './getSuggestions.js';
import { getTrendingEndpoint } from './getTrending.js';
import { listForEprintEndpoint } from './listForEprint.js';
import { searchEndpoint } from './search.js';

/**
 * All tag XRPC endpoints.
 */
export const tagEndpoints = [
  listForEprintEndpoint,
  getSuggestionsEndpoint,
  getTrendingEndpoint,
  searchEndpoint,
  getDetailEndpoint,
] as const;
