/**
 * Sync XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

export { checkStaleness } from './checkStaleness.js';
export { indexRecord } from './indexRecord.js';
export { refreshRecord } from './refreshRecord.js';
export { registerPDS } from './registerPDS.js';
export { verify } from './verify.js';

import { checkStaleness } from './checkStaleness.js';
import { indexRecord } from './indexRecord.js';
import { refreshRecord } from './refreshRecord.js';
import { registerPDS } from './registerPDS.js';
import { verify } from './verify.js';

/**
 * All sync XRPC methods keyed by NSID.
 */
export const syncMethods = {
  'pub.chive.sync.checkStaleness': checkStaleness,
  'pub.chive.sync.indexRecord': indexRecord,
  'pub.chive.sync.refreshRecord': refreshRecord,
  'pub.chive.sync.registerPDS': registerPDS,
  'pub.chive.sync.verify': verify,
} as const;
