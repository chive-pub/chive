/**
 * Backlink XRPC endpoints.
 *
 * @remarks
 * Exports all backlink-related XRPC endpoint definitions.
 *
 * @packageDocumentation
 * @public
 */

import { createBacklinkEndpoint } from './create.js';
import { deleteBacklinkEndpoint } from './delete.js';
import { getBacklinkCountsEndpoint } from './getCounts.js';
import { listBacklinksEndpoint } from './list.js';

export { listBacklinksEndpoint, listBacklinksHandler } from './list.js';
export { getBacklinkCountsEndpoint, getBacklinkCountsHandler } from './getCounts.js';
export { createBacklinkEndpoint, createBacklinkHandler } from './create.js';
export { deleteBacklinkEndpoint, deleteBacklinkHandler } from './delete.js';

/**
 * All backlink endpoints.
 *
 * @public
 */
export const backlinkEndpoints = [
  listBacklinksEndpoint,
  getBacklinkCountsEndpoint,
  createBacklinkEndpoint,
  deleteBacklinkEndpoint,
] as const;
