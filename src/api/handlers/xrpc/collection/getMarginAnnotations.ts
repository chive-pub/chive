/**
 * XRPC handler for pub.chive.collection.getMarginAnnotations.
 *
 * @remarks
 * Returns Margin annotations (at.margin.annotation, at.margin.highlight)
 * that target a specific Chive eprint. These are indexed from the firehose
 * by the MarginAnnotationsPlugin and MarginHighlightsPlugin.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/getMarginAnnotations.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters. */
export type GetMarginAnnotationsParams = QueryParams;

/** Re-exported output schema. */
export type GetMarginAnnotationsOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.getMarginAnnotations query.
 *
 * @public
 */
export const getMarginAnnotations: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');

    if (!params.eprintUri) {
      throw new ValidationError('Missing required parameter: eprintUri', 'eprintUri');
    }

    if (!collectionService) {
      return {
        encoding: 'application/json',
        body: { annotations: [], hasMore: false, total: 0 },
      };
    }

    const result = await collectionService.getMarginAnnotationsForEprint(
      params.eprintUri as AtUri,
      { limit: params.limit, cursor: params.cursor }
    );

    logger.debug('Margin annotations retrieved', {
      eprintUri: params.eprintUri,
      count: result.items.length,
      total: result.total,
    });

    return {
      encoding: 'application/json',
      body: {
        annotations: result.items.map((item) => ({
          uri: item.uri,
          authorDid: item.authorDid,
          recordType: item.recordType,
          motivation: item.motivation,
          body: item.body,
          bodyFormat: item.bodyFormat,
          pageTitle: item.pageTitle,
          color: item.color,
          tags: item.tags,
          createdAt: item.createdAt.toISOString(),
        })),
        cursor: result.cursor,
        hasMore: result.hasMore,
        total: result.total,
      },
    };
  },
};
