/**
 * Alpha tester XRPC endpoints.
 *
 * @remarks
 * Exports all alpha tester application endpoint definitions.
 *
 * @packageDocumentation
 * @public
 */

import { applyEndpoint } from './apply.js';
import { checkStatusEndpoint } from './checkStatus.js';

export { applyEndpoint, applyHandler } from './apply.js';
export { checkStatusEndpoint, checkStatusHandler } from './checkStatus.js';

/**
 * All alpha endpoints.
 *
 * @public
 */
export const alphaEndpoints = [applyEndpoint, checkStatusEndpoint] as const;
