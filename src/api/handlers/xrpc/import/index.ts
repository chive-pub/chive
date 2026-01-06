/**
 * Import XRPC endpoints.
 *
 * @remarks
 * Exports all import-related XRPC endpoint definitions.
 *
 * @packageDocumentation
 * @public
 */

import { importExistsEndpoint } from './exists.js';
import { getImportEndpoint } from './get.js';
import { searchImportsEndpoint } from './search.js';

export { searchImportsEndpoint, searchImportsHandler } from './search.js';
export { getImportEndpoint, getImportHandler } from './get.js';
export { importExistsEndpoint, importExistsHandler } from './exists.js';

/**
 * All import endpoints.
 *
 * @public
 */
export const importEndpoints = [
  searchImportsEndpoint,
  getImportEndpoint,
  importExistsEndpoint,
] as const;
