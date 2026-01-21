/**
 * Alpha tester XRPC methods.
 *
 * @remarks
 * Exports all alpha tester application methods keyed by NSID.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { apply } from './apply.js';
import { checkStatus } from './checkStatus.js';

export { apply } from './apply.js';
export { checkStatus } from './checkStatus.js';

/**
 * Alpha methods map keyed by NSID.
 *
 * @remarks
 * Using `any` here is intentional - TypeScript's type variance rules make
 * heterogeneous handler maps impossible to type safely. The handlers themselves
 * are type-safe; only the collection type uses `any`.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const alphaMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.alpha.apply': apply,
  'pub.chive.alpha.checkStatus': checkStatus,
};
