/**
 * XRPC preprint handler exports.
 *
 * @packageDocumentation
 * @public
 */

export { getSubmissionHandler, getSubmissionEndpoint } from './getSubmission.js';

export { searchSubmissionsHandler, searchSubmissionsEndpoint } from './searchSubmissions.js';

export { listByAuthorHandler, listByAuthorEndpoint } from './listByAuthor.js';

import { getSubmissionEndpoint } from './getSubmission.js';
import { listByAuthorEndpoint } from './listByAuthor.js';
import { searchSubmissionsEndpoint } from './searchSubmissions.js';

/**
 * All preprint XRPC endpoints.
 */
export const preprintEndpoints = [
  getSubmissionEndpoint,
  searchSubmissionsEndpoint,
  listByAuthorEndpoint,
] as const;
