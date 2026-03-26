/**
 * Moderation XRPC handlers.
 *
 * @remarks
 * Handles pub.chive.moderation.* endpoints for content reporting and flagging.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { createReport } from './createReport.js';

export { createReport } from './createReport.js';

/**
 * Moderation methods map keyed by NSID.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const moderationMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.moderation.createReport': createReport,
};
