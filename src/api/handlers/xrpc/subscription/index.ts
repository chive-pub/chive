/**
 * XRPC methods for the standard.site subscription graph.
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { getFeed } from './getFeed.js';
import { getStatus } from './getStatus.js';

export { getFeed } from './getFeed.js';
export { getStatus } from './getStatus.js';

/**
 * Method map for the subscription namespace.
 *
 * @public
 */
export const subscriptionMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.subscription.getFeed': getFeed,
  'pub.chive.subscription.getStatus': getStatus,
};
