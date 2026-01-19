/**
 * Author XRPC endpoints.
 *
 * @remarks
 * Exports all author-related XRPC endpoint definitions.
 *
 * @packageDocumentation
 * @public
 */

import { getProfileEndpoint } from './getProfile.js';
import { searchAuthorsEndpoint } from './searchAuthors.js';

export { getProfileEndpoint, getProfileHandler } from './getProfile.js';
export { searchAuthorsEndpoint, searchAuthorsHandler } from './searchAuthors.js';

/**
 * All author endpoints.
 *
 * @public
 */
export const authorEndpoints = [getProfileEndpoint, searchAuthorsEndpoint] as const;
