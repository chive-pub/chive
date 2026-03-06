/**
 * XRPC handler for pub.chive.admin.deleteContent.
 *
 * @remarks
 * Soft-deletes content by setting deleted_at. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { adminMetrics } from '../../../../observability/prometheus-registry.js';
import {
  AuthorizationError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface DeleteContentInput {
  readonly uri: string;
  readonly collection: string;
  readonly reason?: string;
}

interface DeleteContentOutput {
  readonly success: boolean;
  readonly uri: string;
}

export const deleteContent: XRPCMethod<void, DeleteContentInput, DeleteContentOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<DeleteContentOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input?.uri || !input.collection) {
      throw new ValidationError('URI and collection are required', 'input', 'required');
    }

    const logger = c.get('logger');
    const redis = c.get('redis');

    // Determine table from collection
    const tableMap: Record<string, string> = {
      'pub.chive.eprint.submission': 'eprints_index',
      'pub.chive.review.comment': 'reviews_index',
      'pub.chive.review.endorsement': 'endorsements_index',
      'pub.chive.eprint.userTag': 'user_tags_index',
    };

    const table = tableMap[input.collection];
    if (!table) {
      throw new ValidationError(
        `Unsupported collection: ${input.collection}`,
        'collection',
        'enum'
      );
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }

    // Perform the actual soft-delete in the database
    const { deleted } = await admin.deleteContent(input.uri, table);

    // Publish deletion event for audit trail
    await redis.publish(
      'chive:admin:content-deleted',
      JSON.stringify({
        uri: input.uri,
        collection: input.collection,
        reason: input.reason,
        deletedBy: user.did,
        deletedAt: new Date().toISOString(),
      })
    );

    adminMetrics.actionsTotal.inc({ action: 'delete', target: input.collection });

    logger.info('Content soft-deleted by admin', {
      uri: input.uri,
      collection: input.collection,
      reason: input.reason,
      deletedBy: user.did,
      deleted,
    });

    return {
      encoding: 'application/json',
      body: { success: deleted, uri: input.uri },
    };
  },
};
