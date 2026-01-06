/**
 * Review XRPC endpoint exports.
 *
 * @packageDocumentation
 * @public
 */

export { listForPreprintEndpoint, listForPreprintHandler } from './listForPreprint.js';
export { listForAuthorEndpoint, listForAuthorHandler } from './listForAuthor.js';
export { getThreadEndpoint, getThreadHandler } from './getThread.js';

import { getThreadEndpoint } from './getThread.js';
import { listForAuthorEndpoint } from './listForAuthor.js';
import { listForPreprintEndpoint } from './listForPreprint.js';

/**
 * All review XRPC endpoints.
 */
export const reviewEndpoints = [
  listForPreprintEndpoint,
  listForAuthorEndpoint,
  getThreadEndpoint,
] as const;
