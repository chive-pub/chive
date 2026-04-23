/**
 * XRPC handler for `com.atproto.repo.describeRepo`, scoped to Chive's
 * lexicon-hosting DID.
 *
 * @packageDocumentation
 * @public
 */

import {
  CHIVE_LEXICON_DID,
  LEXICON_COLLECTION,
} from '../../../../atproto/lexicon-server/loader.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export interface DescribeRepoParams {
  repo: string;
}

export interface DescribeRepoOutput {
  handle: string;
  did: string;
  didDoc: Record<string, unknown>;
  collections: string[];
  handleIsCorrect: boolean;
}

export const describeRepo: XRPCMethod<DescribeRepoParams, void, DescribeRepoOutput> = {
  auth: false,
  handler: ({ params, c }): Promise<XRPCResponse<DescribeRepoOutput>> => {
    if (params.repo !== CHIVE_LEXICON_DID) {
      throw new NotFoundError('Repo', params.repo);
    }

    const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? 'chive.pub';
    const endpoint = `https://${host.replace(/^api\./, '')}`;

    return Promise.resolve({
      encoding: 'application/json',
      body: {
        handle: 'chive.pub',
        did: CHIVE_LEXICON_DID,
        didDoc: {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: CHIVE_LEXICON_DID,
          alsoKnownAs: ['at://chive.pub'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: endpoint,
            },
          ],
        },
        collections: [LEXICON_COLLECTION],
        handleIsCorrect: true,
      },
    });
  },
};
