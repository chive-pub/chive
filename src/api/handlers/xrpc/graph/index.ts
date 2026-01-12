/**
 * XRPC graph handler exports.
 *
 * @packageDocumentation
 * @public
 */

export { getFieldHandler, getFieldEndpoint } from './getField.js';
export { listFieldsHandler, listFieldsEndpoint } from './listFields.js';
export { searchAuthoritiesHandler, searchAuthoritiesEndpoint } from './searchAuthorities.js';
export { browseFacetedHandler, browseFacetedEndpoint } from './browseFaceted.js';
export { getFieldEprintsHandler, getFieldEprintsEndpoint } from './getFieldEprints.js';
export { getAuthorityHandler, getAuthorityEndpoint } from './getAuthority.js';
export {
  getAuthorityReconciliationsHandler,
  getAuthorityReconciliationsEndpoint,
} from './getAuthorityReconciliations.js';

/**
 * All graph XRPC endpoints.
 */
import { browseFacetedEndpoint } from './browseFaceted.js';
import { getAuthorityEndpoint } from './getAuthority.js';
import { getAuthorityReconciliationsEndpoint } from './getAuthorityReconciliations.js';
import { getFieldEndpoint } from './getField.js';
import { getFieldEprintsEndpoint } from './getFieldEprints.js';
import { listFieldsEndpoint } from './listFields.js';
import { searchAuthoritiesEndpoint } from './searchAuthorities.js';

export const graphEndpoints = [
  getFieldEndpoint,
  listFieldsEndpoint,
  searchAuthoritiesEndpoint,
  browseFacetedEndpoint,
  getFieldEprintsEndpoint,
  getAuthorityEndpoint,
  getAuthorityReconciliationsEndpoint,
] as const;
