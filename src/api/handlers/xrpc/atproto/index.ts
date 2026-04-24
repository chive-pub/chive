/**
 * XRPC handlers that expose a minimal `com.atproto.repo.*` surface for
 * serving Chive's lexicon schemas as ATProto records.
 *
 * @remarks
 * Enables NSID resolution in Chive's namespace by other ATProto services,
 * without publishing lexicons to a real PDS (which would make them
 * immutable). Redeploying the API updates the served lexicons.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { describeRepo } from './describeRepo.js';
import { getRecord } from './getRecord.js';
import { listRecords } from './listRecords.js';

export { describeRepo, getRecord, listRecords };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const atprotoMethods: Record<string, XRPCMethod<any, any, any>> = {
  'com.atproto.repo.getRecord': getRecord,
  'com.atproto.repo.listRecords': listRecords,
  'com.atproto.repo.describeRepo': describeRepo,
};
