/**
 * XRPC handler for `com.atproto.repo.listRecords`, limited to Chive's
 * lexicon schema collection.
 *
 * @packageDocumentation
 * @public
 */

import {
  CHIVE_LEXICON_DID,
  LEXICON_COLLECTION,
  getLexiconRecords,
} from '../../../../atproto/lexicon-server/loader.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export interface ListRecordsParams {
  repo: string;
  collection: string;
  limit?: number;
  cursor?: string;
  reverse?: boolean;
}

export interface ListRecordsOutput {
  cursor?: string;
  records: { uri: string; cid: string; value: unknown }[];
}

export const listRecords: XRPCMethod<ListRecordsParams, void, ListRecordsOutput> = {
  auth: false,
  handler: ({ params }): Promise<XRPCResponse<ListRecordsOutput>> => {
    if (params.repo !== CHIVE_LEXICON_DID) {
      throw new NotFoundError('Repo', params.repo);
    }
    if (params.collection !== LEXICON_COLLECTION) {
      throw new NotFoundError('Collection', params.collection);
    }

    const all = Array.from(getLexiconRecords().entries()).map(([, rec]) => ({
      uri: rec.uri,
      cid: rec.cid,
      value: rec.value,
    }));
    all.sort((a, b) => a.uri.localeCompare(b.uri));
    if (params.reverse) all.reverse();

    const limit = Math.min(params.limit ?? 50, 100);
    const startIdx = params.cursor ? all.findIndex((r) => r.uri === params.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < all.length ? slice[slice.length - 1]?.uri : undefined;

    return Promise.resolve({
      encoding: 'application/json',
      body: { cursor: nextCursor, records: slice },
    });
  },
};
