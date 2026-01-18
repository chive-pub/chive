/**
 * Sync XRPC endpoints.
 *
 * @remarks
 * Exports all PDS sync-related XRPC endpoint definitions.
 *
 * @packageDocumentation
 * @public
 */

import { checkStalenessEndpoint } from './checkStaleness.js';
import { indexRecordEndpoint } from './indexRecord.js';
import { refreshRecordEndpoint } from './refreshRecord.js';
import { verifySyncEndpoint } from './verify.js';

export { checkStalenessEndpoint, checkStalenessHandler } from './checkStaleness.js';
export { indexRecordEndpoint, indexRecordHandler } from './indexRecord.js';
export { refreshRecordEndpoint, refreshRecordHandler } from './refreshRecord.js';
export { verifySyncEndpoint, verifySyncHandler } from './verify.js';

/**
 * All sync endpoints.
 *
 * @public
 */
export const syncEndpoints = [
  checkStalenessEndpoint,
  indexRecordEndpoint,
  refreshRecordEndpoint,
  verifySyncEndpoint,
] as const;
