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
import type { DID } from '../../../../types/atproto.js';
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
    const { backlink, profileHydrator } = c.get('services');

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

    // Some applications address a record by its author's handle rather than
    // their DID: Margin renders an annotation at `margin.at/{handle}/annotation
    // /{rkey}` and answers "Not found" to the DID form. The AT-URI carries only
    // the DID, so without this the card can offer no way through to the record
    // on the service that published it. Hydration is batched and cached, and
    // best-effort -- a card without a handle simply keeps its record link.
    const didOf = (uri: string): DID | undefined =>
      /^at:\/\/(did:[a-z]+:[a-zA-Z0-9._:%-]+)/.exec(uri)?.[1] as DID | undefined;

    const sourceDids = [
      ...new Set(
        result.backlinks.map((bl) => didOf(bl.sourceUri)).filter((did): did is DID => Boolean(did))
      ),
    ];

    const profiles = profileHydrator
      ? await profileHydrator.hydrate(sourceDids)
      : new Map<DID, { handle?: string; displayName?: string; avatar?: string }>();

    const response: OutputSchema = {
      backlinks: result.backlinks.map((bl) => ({
        id: bl.id,
        sourceUri: bl.sourceUri,
        sourceType: bl.sourceType,
        targetUri: bl.targetUri,
        context: bl.context,
        contextLabel: bl.contextLabel,
        contextDetail: bl.contextDetail,
        ...(() => {
          const did = didOf(bl.sourceUri);
          const profile = did ? profiles.get(did) : undefined;
          return {
            sourceHandle: profile?.handle,
            sourceDisplayName: profile?.displayName,
            sourceAvatar: profile?.avatar,
          };
        })(),
        containerUri: bl.containerUri,
        containerName: bl.containerName,
        relatedUri: bl.relatedUri,
        relatedTitle: bl.relatedTitle,
        indexedAt: bl.indexedAt.toISOString(),
        deleted: bl.deleted,
      })),
      cursor: result.cursor,
      hasMore: result.cursor !== undefined,
    };

    return { encoding: 'application/json', body: response };
  },
};
