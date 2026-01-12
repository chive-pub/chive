/**
 * Review XRPC endpoint exports.
 *
 * @packageDocumentation
 * @public
 */

export { listForEprintEndpoint, listForEprintHandler } from './listForEprint.js';
export { listForAuthorEndpoint, listForAuthorHandler } from './listForAuthor.js';
export { getThreadEndpoint, getThreadHandler } from './getThread.js';

import { getThreadEndpoint } from './getThread.js';
import { listForAuthorEndpoint } from './listForAuthor.js';
import { listForEprintEndpoint } from './listForEprint.js';

/**
 * All review XRPC endpoints.
 */
export const reviewEndpoints = [
  listForEprintEndpoint,
  listForAuthorEndpoint,
  getThreadEndpoint,
] as const;
