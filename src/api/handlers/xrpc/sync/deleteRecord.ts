/**
 * XRPC handler for pub.chive.sync.deleteRecord.
 *
 * @remarks
 * Marks a record as deleted (soft-delete) in Chive's index. This endpoint
 * provides immediate feedback to users after deleting from their PDS,
 * without waiting for firehose propagation.
 *
 * The firehose remains the primary deletion mechanism; this endpoint is
 * a UX optimization for immediate feedback.
 *
 * Supported collections:
 * - `pub.chive.review.comment` - Review comments and annotations
 * - `pub.chive.review.endorsement` - Endorsements
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, DID } from '../../../../types/atproto.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../../../../types/errors.js';
import { isErr } from '../../../../types/result.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Input schema for deleteRecord.
 */
export interface InputSchema {
  uri: string;
}

/**
 * Output schema for deleteRecord.
 */
export interface OutputSchema {
  uri: string;
  deleted: boolean;
  error?: string;
}

/**
 * Parse an AT URI into its components.
 */
function parseAtUri(uri: string): { did: DID; collection: string; rkey: string } | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  return {
    did: match[1] as DID,
    collection: match[2],
    rkey: match[3],
  };
}

/**
 * XRPC method for pub.chive.sync.deleteRecord.
 *
 * @public
 */
export const deleteRecord: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const services = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new ValidationError('Input required', 'uri');
    }

    logger.info('Marking record as deleted', { uri: input.uri, requestedBy: user.did });

    // Parse the AT URI
    const parsed = parseAtUri(input.uri);
    if (!parsed) {
      throw new ValidationError('Invalid AT URI format', 'uri');
    }

    const { did, collection } = parsed;

    // Users can only delete their own records (or admins can delete any)
    if (!user.isAdmin && user.did !== did) {
      logger.debug('DID ownership check failed', {
        userDid: user.did,
        recordDid: did,
        uri: input.uri,
      });
      throw new ValidationError('Can only delete your own records', 'uri');
    }

    // Supported collections for deletion
    const supportedCollections = ['pub.chive.review.comment', 'pub.chive.review.endorsement'];

    if (!supportedCollections.includes(collection)) {
      throw new ValidationError(
        `Collection ${collection} not supported for deletion via this endpoint`,
        'uri'
      );
    }

    try {
      if (collection === 'pub.chive.review.comment') {
        const reviewService = services.review;
        if (!reviewService) {
          const body: OutputSchema = {
            uri: input.uri,
            deleted: false,
            error: 'Review service not available',
          };
          return { encoding: 'application/json', body };
        }

        const result = await reviewService.softDeleteReview(input.uri as AtUri, 'admin');
        if (isErr(result)) {
          const body: OutputSchema = {
            uri: input.uri,
            deleted: false,
            error: result.error.message,
          };
          return { encoding: 'application/json', body };
        }
      } else if (collection === 'pub.chive.review.endorsement') {
        // Soft-delete endorsement via review service
        const reviewService = services.review;
        if (!reviewService) {
          const body: OutputSchema = {
            uri: input.uri,
            deleted: false,
            error: 'Review service not available',
          };
          return { encoding: 'application/json', body };
        }
        const result = await reviewService.softDeleteEndorsement(input.uri as AtUri, 'admin');
        if (isErr(result)) {
          const body: OutputSchema = {
            uri: input.uri,
            deleted: false,
            error: result.error.message,
          };
          return { encoding: 'application/json', body };
        }
      }

      logger.info('Successfully marked record as deleted', { uri: input.uri });

      const body: OutputSchema = {
        uri: input.uri,
        deleted: true,
      };

      return { encoding: 'application/json', body };
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof AuthenticationError
      ) {
        throw error;
      }

      logger.error('Error deleting record', error instanceof Error ? error : undefined, {
        uri: input.uri,
      });

      const body: OutputSchema = {
        uri: input.uri,
        deleted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return { encoding: 'application/json', body };
    }
  },
};
