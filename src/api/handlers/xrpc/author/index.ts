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

export { getProfileEndpoint, getProfileHandler } from './getProfile.js';

/**
 * All author endpoints.
 *
 * @public
 */
export const authorEndpoints = [getProfileEndpoint] as const;
