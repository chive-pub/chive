/**
 * XRPC handler for pub.chive.sync.indexRecord.
 *
 * @remarks
 * Fetches a record from a user's PDS and indexes it in Chive.
 *
 * This endpoint serves as a UX optimization and fallback mechanism:
 * - **Immediate indexing**: Provides instant visibility after submission
 *   instead of waiting for firehose propagation latency
 * - **Missed records**: Recovers records that the firehose may have
 *   missed due to temporary disconnection or backpressure
 * - **Re-indexing**: Allows users to request re-indexing if data
 *   appears stale
 *
 * The firehose (via Jetstream with `wantedCollections=pub.chive.*`) remains
 * the primary indexing mechanism. This endpoint supplements it for better UX.
 *
 * Supported collections:
 * - `pub.chive.eprint.submission` - Eprint submissions
 * - `pub.chive.review.comment` - Review comments and annotations
 * - `pub.chive.review.endorsement` - Endorsements
 * - `pub.chive.eprint.citation` - User-curated citations
 * - `pub.chive.eprint.relatedWork` - User-curated related work links
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/sync/indexRecord.js';
import type { RecordMetadata } from '../../../../services/eprint/eprint-service.js';
import { transformPDSRecord } from '../../../../services/eprint/pds-record-transformer.js';
import type { AtUri, CID, DID } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '../../../../types/errors.js';
import { isErr } from '../../../../types/result.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

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
 * Resolve DID to PDS endpoint using PLC directory.
 */
async function resolvePdsEndpoint(did: DID): Promise<string | null> {
  try {
    // Handle did:plc DIDs via PLC directory
    if (did.startsWith('did:plc:')) {
      const response = await fetch(`https://plc.directory/${did}`);
      if (!response.ok) {
        return null;
      }
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pdsService = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pdsService?.serviceEndpoint ?? null;
    }

    // Handle did:web DIDs
    if (did.startsWith('did:web:')) {
      const domain = did.replace('did:web:', '').replace(/%3A/g, ':');
      const response = await fetch(`https://${domain}/.well-known/did.json`);
      if (!response.ok) {
        return null;
      }
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pdsService = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pdsService?.serviceEndpoint ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a record from a PDS.
 */
async function fetchRecordFromPds(
  pdsUrl: string,
  did: DID,
  collection: string,
  rkey: string
): Promise<{ uri: string; cid: string; value: unknown } | null> {
  try {
    const url = new URL('/xrpc/com.atproto.repo.getRecord', pdsUrl);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', collection);
    url.searchParams.set('rkey', rkey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }

    const record = (await response.json()) as { uri: string; cid: string; value: unknown };
    return record;
  } catch {
    return null;
  }
}

/**
 * XRPC method for pub.chive.sync.indexRecord.
 *
 * @public
 */
export const indexRecord: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { eprint: eprintService, pdsRegistry } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new ValidationError('Input required', 'uri');
    }

    logger.info('Indexing record from PDS', { uri: input.uri, requestedBy: user.did });

    // Parse the AT URI
    const parsed = parseAtUri(input.uri);
    if (!parsed) {
      throw new ValidationError('Invalid AT URI format', 'uri');
    }

    const { did, collection, rkey } = parsed;

    // Users can only index their own records (or admins can index any)
    if (!user.isAdmin && user.did !== did) {
      // Log DID mismatch for debugging (at debug level per industry standard)
      logger.debug('DID ownership check failed', {
        userDid: user.did,
        recordDid: did,
        uri: input.uri,
      });
      throw new ValidationError('Can only index your own records', 'uri');
    }

    // Supported collections for manual indexing
    const supportedCollections = [
      'pub.chive.eprint.submission',
      'pub.chive.review.comment',
      'pub.chive.review.endorsement',
      'pub.chive.annotation.comment',
      'pub.chive.annotation.entityLink',
      'pub.chive.eprint.userTag',
      'pub.chive.eprint.citation',
      'pub.chive.eprint.relatedWork',
    ];

    if (!supportedCollections.includes(collection)) {
      throw new ValidationError(
        `Collection ${collection} not supported for manual indexing`,
        'uri'
      );
    }

    try {
      // Resolve PDS endpoint for the DID
      const pdsUrl = await resolvePdsEndpoint(did);
      if (!pdsUrl) {
        throw new NotFoundError('PDS endpoint', did);
      }

      logger.debug('Resolved PDS endpoint', { did, pdsUrl });

      // Register the PDS for future scanning (fire-and-forget)
      if (pdsRegistry) {
        pdsRegistry.registerPDS(pdsUrl, 'did_mention').catch((err) => {
          logger.debug('PDS registration skipped', {
            pdsUrl,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      // Fetch the record from the PDS
      const record = await fetchRecordFromPds(pdsUrl, did, collection, rkey);
      if (!record) {
        // Record was deleted from PDS -- remove from our index
        logger.info('Record not found at PDS, removing from index', { uri: input.uri, pdsUrl });
        try {
          await eprintService.deleteFromIndex(input.uri as AtUri, collection);
        } catch (deleteErr) {
          logger.debug('Index deletion skipped (may not exist)', {
            uri: input.uri,
            error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr),
          });
        }
        const body: OutputSchema = {
          uri: input.uri,
          indexed: false,
          error: 'Record deleted from PDS; removed from index',
        };
        return { encoding: 'application/json', body };
      }

      logger.debug('Fetched record from PDS', {
        uri: input.uri,
        cid: record.cid,
        pdsUrl,
      });

      // Build metadata for indexing
      const metadata: RecordMetadata = {
        uri: input.uri as AtUri,
        cid: record.cid as CID,
        pdsUrl,
        indexedAt: new Date(),
      };

      // Index based on collection type
      let result;

      if (collection === 'pub.chive.eprint.submission') {
        // Transform PDS record to internal Eprint model
        const eprintRecord = transformPDSRecord(
          record.value,
          input.uri as AtUri,
          record.cid as CID
        );
        result = await eprintService.indexEprint(eprintRecord, metadata);
      } else if (collection === 'pub.chive.review.comment') {
        // Index review comment directly
        const reviewService = c.get('services').review;
        if (!reviewService) {
          throw new DatabaseError('INDEX', 'Review service not available');
        }
        result = await reviewService.indexReview(record.value, metadata);
      } else if (collection === 'pub.chive.review.endorsement') {
        // Index endorsement directly
        const reviewService = c.get('services').review;
        if (!reviewService) {
          throw new DatabaseError('INDEX', 'Review service not available');
        }
        result = await reviewService.indexEndorsement(record.value, metadata);
      } else if (collection === 'pub.chive.annotation.comment') {
        const annotationService = c.get('services').annotation;
        if (!annotationService) {
          throw new DatabaseError('INDEX', 'Annotation service not available');
        }
        result = await annotationService.indexAnnotation(record.value, metadata);
      } else if (collection === 'pub.chive.annotation.entityLink') {
        const annotationService = c.get('services').annotation;
        if (!annotationService) {
          throw new DatabaseError('INDEX', 'Annotation service not available');
        }
        result = await annotationService.indexEntityLink(record.value, metadata);
      } else if (collection === 'pub.chive.eprint.userTag') {
        result = await eprintService.indexTag(record.value, metadata);
      } else if (collection === 'pub.chive.eprint.citation') {
        result = await eprintService.indexCitation(record.value, metadata);
      } else if (collection === 'pub.chive.eprint.relatedWork') {
        result = await eprintService.indexRelatedWork(record.value, metadata);
      } else {
        throw new ValidationError(`Collection ${collection} not supported`, 'uri');
      }

      if (isErr(result)) {
        const indexError = result.error;
        logger.error('Failed to index record', indexError, { uri: input.uri });

        // Queue for retry if worker is available
        const { indexRetryWorker } = c.get('services');
        if (indexRetryWorker) {
          try {
            await indexRetryWorker.enqueueRetry({
              uri: input.uri,
              did,
              collection,
              rkey,
              pdsUrl,
              originalError: indexError.message,
              failedAt: new Date().toISOString(),
              requestedBy: user?.did,
            });
            logger.info('Queued failed index for retry', { uri: input.uri });
          } catch (queueError) {
            logger.warn('Failed to queue retry', {
              uri: input.uri,
              error: queueError instanceof Error ? queueError.message : String(queueError),
            });
          }
        }

        const body: OutputSchema = {
          uri: input.uri,
          indexed: false,
          error: indexError.message,
        };

        return { encoding: 'application/json', body };
      }

      logger.info('Successfully indexed record', { uri: input.uri, cid: record.cid });

      const body: OutputSchema = {
        uri: input.uri,
        indexed: true,
        cid: record.cid,
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

      logger.error('Error indexing record', error instanceof Error ? error : undefined, {
        uri: input.uri,
      });

      // Queue for retry on unexpected errors if worker is available
      const { indexRetryWorker } = c.get('services');
      if (indexRetryWorker && parsed) {
        try {
          await indexRetryWorker.enqueueRetry({
            uri: input.uri,
            did: parsed.did,
            collection: parsed.collection,
            rkey: parsed.rkey,
            originalError: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date().toISOString(),
            requestedBy: user?.did,
          });
          logger.info('Queued failed index for retry', { uri: input.uri });
        } catch (queueError) {
          logger.warn('Failed to queue retry', {
            uri: input.uri,
            error: queueError instanceof Error ? queueError.message : String(queueError),
          });
        }
      }

      throw new DatabaseError('INDEX', error instanceof Error ? error.message : 'Unknown error');
    }
  },
};
