/**
 * XRPC contribution handler exports.
 *
 * @packageDocumentation
 * @public
 */

export { listContributionTypesHandler, listContributionTypesEndpoint } from './listTypes.js';
export { getContributionTypeHandler, getContributionTypeEndpoint } from './getType.js';
export { searchContributionTypesHandler, searchContributionTypesEndpoint } from './searchTypes.js';

/**
 * All contribution XRPC endpoints.
 */
import { getContributionTypeEndpoint } from './getType.js';
import { listContributionTypesEndpoint } from './listTypes.js';
import { searchContributionTypesEndpoint } from './searchTypes.js';

export const contributionEndpoints = [
  listContributionTypesEndpoint,
  getContributionTypeEndpoint,
  searchContributionTypesEndpoint,
] as const;
