/**
 * XRPC handler for `com.atproto.repo.getRecord`, limited to Chive's
 * lexicon schema records.
 *
 * @remarks
 * Only serves records in the `com.atproto.lexicon.schema` collection
 * owned by `did:web:chive.pub`. This is the minimum PDS surface needed
 * so other ATProto services can resolve NSIDs in Chive's namespace per
 * the lexicon resolution protocol. Chive is not a general-purpose PDS.
 *
 * @packageDocumentation
 * @public
 */

import {
  CHIVE_LEXICON_DID,
  LEXICON_COLLECTION,
  getLexiconRecord,
} from '../../../../atproto/lexicon-server/loader.js';
import { NotFoundError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export interface GetRecordParams {
  repo: string;
  collection: string;
  rkey: string;
  cid?: string;
}

export interface GetRecordOutput {
  uri: string;
  cid: string;
  value: unknown;
}

export const getRecord: XRPCMethod<GetRecordParams, void, GetRecordOutput> = {
  auth: false,
  handler: ({ params }): Promise<XRPCResponse<GetRecordOutput>> => {
    if (!params.repo || !params.collection || !params.rkey) {
      throw new ValidationError('`repo`, `collection`, and `rkey` are required', 'params');
    }
    if (params.repo !== CHIVE_LEXICON_DID) {
      throw new NotFoundError('Repo', params.repo);
    }
    if (params.collection !== LEXICON_COLLECTION) {
      throw new NotFoundError('Collection', params.collection);
    }

    const record = getLexiconRecord(params.rkey);
    if (!record) {
      throw new NotFoundError('Lexicon', params.rkey);
    }
    if (params.cid && params.cid !== record.cid) {
      throw new NotFoundError('Lexicon (cid mismatch)', params.rkey);
    }

    return Promise.resolve({
      encoding: 'application/json',
      body: { uri: record.uri, cid: record.cid, value: record.value },
    });
  },
};
