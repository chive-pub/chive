/**
 * Handler for pub.chive.sync.indexRecord.
 *
 * @remarks
 * Fetches a record from a user's PDS and indexes it in Chive.
 * This is used to manually trigger indexing when the firehose
 * doesn't deliver events (e.g., non-Bluesky relays).
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { RecordMetadata } from '../../../../services/eprint/eprint-service.js';
import type { AtUri, CID, DID } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '../../../../types/errors.js';
import type { Eprint } from '../../../../types/models/eprint.js';
import {
  indexRecordInputSchema,
  indexRecordResponseSchema,
  type IndexRecordInput,
  type IndexRecordResponse,
} from '../../../schemas/sync.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

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
): Promise<{ uri: string; cid: string; value: Eprint } | null> {
  try {
    const url = new URL('/xrpc/com.atproto.repo.getRecord', pdsUrl);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', collection);
    url.searchParams.set('rkey', rkey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }

    const record = (await response.json()) as { uri: string; cid: string; value: Eprint };
    return record;
  } catch {
    return null;
  }
}

/**
 * Handler for pub.chive.sync.indexRecord.
 *
 * @param c - Hono context
 * @param input - Request input
 * @returns Index result
 *
 * @throws {ValidationError} When URI is invalid
 * @throws {NotFoundError} When record is not found on PDS
 * @throws {DatabaseError} When indexing fails
 *
 * @public
 */
export async function indexRecordHandler(
  c: Context<ChiveEnv>,
  input: IndexRecordInput
): Promise<IndexRecordResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { eprint: eprintService } = c.get('services');

  if (!user) {
    throw new AuthenticationError('Authentication required');
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
    throw new ValidationError('Can only index your own records', 'uri');
  }

  // Only support eprint submissions for now
  if (collection !== 'pub.chive.eprint.submission') {
    throw new ValidationError(`Collection ${collection} not supported for manual indexing`, 'uri');
  }

  try {
    // Resolve PDS endpoint for the DID
    const pdsUrl = await resolvePdsEndpoint(did);
    if (!pdsUrl) {
      throw new NotFoundError('PDS endpoint', did);
    }

    logger.debug('Resolved PDS endpoint', { did, pdsUrl });

    // Fetch the record from the PDS
    const record = await fetchRecordFromPds(pdsUrl, did, collection, rkey);
    if (!record) {
      throw new NotFoundError('Record', input.uri);
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

    // Index the eprint
    const result = await eprintService.indexEprint(record.value, metadata);

    if (!result.ok) {
      logger.error('Failed to index record', result.error as Error, { uri: input.uri });
      return {
        uri: input.uri,
        indexed: false,
        error: result.error.message,
      };
    }

    logger.info('Successfully indexed record', { uri: input.uri, cid: record.cid });

    return {
      uri: input.uri,
      indexed: true,
      cid: record.cid,
    };
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

    throw new DatabaseError('INDEX', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Endpoint definition for pub.chive.sync.indexRecord.
 *
 * @public
 */
export const indexRecordEndpoint: XRPCEndpoint<IndexRecordInput, IndexRecordResponse> = {
  method: 'pub.chive.sync.indexRecord' as never,
  type: 'procedure',
  description: 'Index a record from PDS (owner or admin only)',
  inputSchema: indexRecordInputSchema,
  outputSchema: indexRecordResponseSchema,
  handler: indexRecordHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
