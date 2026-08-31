/**
 * XRPC handler for pub.chive.backlink.list.
 *
 * @remarks
 * Lists backlinks to an eprint from ATProto ecosystem sources including
 * Cosmik collections, Leaflet lists, Whitewind blogs, and Bluesky shares.
 *
 * **ATProto Compliance:**
 * - Read-only query from Chive's backlink index
 * - Never writes to user PDSes
 * - Index data rebuildable from firehose events
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/backlink/list.js';
import type { BacklinkSourceType } from '../../../../types/interfaces/plugin.interface.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.backlink.list.
 *
 * @public
 */
export const list: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { backlink } = c.get('services');

    // Debug logging for E2E test debugging
    logger.info('listBacklinks called', {
      targetUri: params.targetUri,
      sourceType: params.sourceType,
      limit: params.limit,
      cursor: params.cursor,
    });

    // The lexicon types this as `(string & {})` for extensibility, so it is
    // narrowed to the canonical union here. This used to redeclare its own
    // copy of the list, which had drifted: it was missing the two cosmik
    // types and all three margin ones, and still named `leaflet.list`.
    type ServiceSourceType = BacklinkSourceType;

    const result = await backlink.getBacklinks(params.targetUri, {
      sourceType: params.sourceType as ServiceSourceType | undefined,
      limit: params.limit ?? 50,
      cursor: params.cursor,
    });

    // Debug: log result count
    logger.info('listBacklinks result', {
      targetUri: params.targetUri,
      sourceType: params.sourceType,
      backlinksCount: result.backlinks.length,
      hasCursor: !!result.cursor,
    });

    const response: OutputSchema = {
      backlinks: result.backlinks.map((bl) => ({
        id: bl.id,
        sourceUri: bl.sourceUri,
        sourceType: bl.sourceType,
        targetUri: bl.targetUri,
        context: bl.context,
        indexedAt: bl.indexedAt.toISOString(),
        deleted: bl.deleted,
      })),
      cursor: result.cursor,
      hasMore: result.cursor !== undefined,
    };

    return { encoding: 'application/json', body: response };
  },
};
