/**
 * XRPC methods for the standard.site subscription graph.
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { getStatus } from './getStatus.js';

export { getStatus } from './getStatus.js';

/**
 * Method map for the subscription namespace.
 *
 * @public
 */
export const subscriptionMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.subscription.getStatus': getStatus,
};
