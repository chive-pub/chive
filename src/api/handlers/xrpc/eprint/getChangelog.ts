/**
 * XRPC handler for pub.chive.eprint.getChangelog.
 *
 * @remarks
 * Retrieves a single changelog entry by AT URI from Chive's index.
 * Changelogs describe changes between eprint versions.
 *
 * **ATProto Compliance:**
 * - Returns pdsUrl for source transparency
 * - Never writes to user PDS
 * - Index data only (rebuildable from firehose)
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/getChangelog.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.eprint.getChangelog.
 *
 * @remarks
 * Returns a changelog entry by AT URI with all fields including
 * version, previousVersion, summary, sections, and reviewerResponse.
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.eprint.getChangelog?uri=at://did:plc:abc/pub.chive.eprint.changelog/xyz
 *
 * Response:
 * {
 *   "uri": "at://did:plc:abc/pub.chive.eprint.changelog/xyz",
 *   "cid": "bafyrei...",
 *   "eprintUri": "at://did:plc:abc/pub.chive.eprint.submission/abc",
 *   "version": { "major": 2, "minor": 0, "patch": 0 },
 *   "previousVersion": { "major": 1, "minor": 0, "patch": 0 },
 *   "summary": "Major revision addressing reviewer feedback",
 *   "sections": [...],
 *   "createdAt": "2024-01-01T00:00:00Z"
 * }
 * ```
 *
 * @public
 */
export const getChangelog: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { eprint } = c.get('services');
    const logger = c.get('logger');

    // Validate required parameter
    if (!params.uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    logger.debug('Getting changelog', { uri: params.uri });

    // Fetch changelog from storage via eprint service
    const result = await eprint.getChangelog(params.uri as AtUri);

    if (!result) {
      throw new NotFoundError('Changelog', params.uri);
    }

    // Build response matching OutputSchema
    // Convert readonly arrays to mutable for lexicon compatibility
    const response: OutputSchema = {
      uri: result.uri,
      cid: result.cid,
      eprintUri: result.eprintUri,
      version: result.version,
      previousVersion: result.previousVersion,
      summary: result.summary,
      sections: result.sections.map((section) => ({
        category: section.category,
        items: section.items.map((item) => ({ ...item })),
      })),
      reviewerResponse: result.reviewerResponse,
      createdAt: result.createdAt,
    };

    logger.info('Changelog retrieved', { uri: params.uri });

    return { encoding: 'application/json', body: response };
  },
};
