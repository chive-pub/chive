/**
 * Author XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

export { getProfile } from './getProfile.js';
export { initiateOrcidVerification } from './initiateOrcidVerification.js';
export { searchAuthors } from './searchAuthors.js';

import { getProfile } from './getProfile.js';
import { initiateOrcidVerification } from './initiateOrcidVerification.js';
import { searchAuthors } from './searchAuthors.js';

/**
 * All author XRPC methods keyed by NSID.
 */
export const authorMethods = {
  'pub.chive.author.getProfile': getProfile,
  'pub.chive.author.initiateOrcidVerification': initiateOrcidVerification,
  'pub.chive.author.searchAuthors': searchAuthors,
} as const;
