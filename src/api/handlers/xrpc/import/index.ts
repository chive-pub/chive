/**
 * Import XRPC methods.
 *
 * @remarks
 * Exports all import-related XRPC method definitions keyed by NSID.
 *
 * @packageDocumentation
 * @public
 */

import { exists } from './exists.js';
import { get } from './get.js';
import { search } from './search.js';

export { get } from './get.js';
export { search } from './search.js';
export { exists } from './exists.js';

/**
 * Import methods map keyed by NSID.
 *
 * @public
 */
export const importMethods = {
  'pub.chive.import.get': get,
  'pub.chive.import.search': search,
  'pub.chive.import.exists': exists,
} as const;
