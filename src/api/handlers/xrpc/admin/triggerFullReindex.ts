/**
 * XRPC handler for pub.chive.admin.triggerFullReindex.
 *
 * @remarks
 * Triggers a full Elasticsearch reindex by reading all eprints from
 * PostgreSQL and re-indexing each into Elasticsearch via the search service.
 * The actual work runs in the background; the handler returns immediately
 * with the operation ID.
 *
 * Search documents are built with {@link mapEprintToDocument}, the same mapper
 * `scripts/reindex-all-eprints.ts` uses. Elasticsearch indexing replaces the
 * whole document rather than merging into it, so any field a projection omits
 * is destroyed for every eprint the reindex touches. A hand-rolled projection
 * here previously wrote about nine fields and thereby wiped DOIs, publication
 * status, external IDs, funding, repositories, related works, supplementary
 * materials, license and document metadata across the index.
 *
 * @packageDocumentation
 * @public
 */

import type { EprintView } from '../../../../services/eprint/eprint-service.js';
import { mapEprintToDocument } from '../../../../storage/elasticsearch/document-mapper.js';
import { toTimestamp } from '../../../../types/atproto-validators.js';
import type { AtUri } from '../../../../types/atproto.js';
import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { IndexableEprintDocument as SimpleIndexableDocument } from '../../../../types/interfaces/search.interface.js';
import type { Eprint } from '../../../../types/models/eprint.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Projects an indexed eprint back onto the {@link Eprint} domain model.
 *
 * @param stored - Eprint as held by Chive's PostgreSQL index
 * @returns Domain record accepted by {@link mapEprintToDocument}
 *
 * @remarks
 * PostgreSQL holds every field the Elasticsearch mapper reads except `facets`,
 * which ride on the PDS record and are never persisted to the index. They are
 * therefore empty here: restoring facets requires reading the PDS, which is
 * what `scripts/reindex-all-eprints.ts` does.
 *
 * `version` is normalized to the integer form the mapper expects by taking the
 * major component of a semantic version — the inverse of `integerToSemantic`.
 */
function toDomainEprint(stored: EprintView): Eprint {
  return {
    ...stored,
    keywords: stored.keywords ?? [],
    facets: [],
    version: typeof stored.version === 'number' ? stored.version : stored.version.major,
    createdAt: toTimestamp(stored.createdAt),
  };
}

export const triggerFullReindex: XRPCMethod<void, void, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const logger = c.get('logger');
    const {
      backfillManager,
      admin,
      eprint: eprintService,
      search: searchService,
    } = c.get('services');
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }

    // `startOperation` hands back an AbortSignal alongside the operation.
    // Dropping it meant `admin.cancelBackfill` flipped the operation's state in
    // Redis while this loop kept running to completion — a cancel button that
    // reported success and cancelled nothing.
    const { operation, signal } = await backfillManager.startOperation('fullReindex');

    logger.info('Full Elasticsearch reindex triggered', { operationId: operation.id });

    // Fire-and-forget: re-index all eprints from PostgreSQL to Elasticsearch
    void (async () => {
      try {
        // Collect all eprint URIs via admin service
        const batchSize = 500;
        let offset = 0;
        let allUris: string[] = [];
        let hasMore = true;

        while (hasMore) {
          if (signal.aborted) {
            logger.info('Full reindex cancelled while collecting URIs', {
              operationId: operation.id,
              collected: allUris.length,
            });
            return;
          }
          const batch = await admin.listImports(batchSize, offset);
          allUris = allUris.concat(batch.items.map((item) => item.uri));
          offset += batchSize;
          hasMore = batch.items.length === batchSize;
        }

        let indexed = 0;
        let failed = 0;

        for (const uri of allUris) {
          if (signal.aborted) {
            logger.info('Full reindex cancelled', {
              operationId: operation.id,
              indexed,
              failed,
              remaining: allUris.length - indexed - failed,
            });
            return;
          }

          try {
            const stored = await eprintService.getEprint(uri as AtUri);
            if (!stored) {
              failed++;
              continue;
            }

            const document = mapEprintToDocument(toDomainEprint(stored), stored.pdsUrl);

            // `ISearchEngine.indexEprint` is typed for the narrow document the
            // live indexing path writes, but the Elasticsearch adapter accepts
            // the mapper's full document too and dispatches on it. Widening the
            // interface is the real fix; until then the cast is what keeps a
            // reindex from replacing complete documents with partial ones.
            const result = await searchService.indexEprintForSearch(
              document as unknown as SimpleIndexableDocument
            );

            if (result.ok) {
              indexed++;
            } else {
              failed++;
            }
          } catch (err) {
            failed++;
            logger.warn('Failed to reindex eprint', {
              uri,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          if ((indexed + failed) % 50 === 0) {
            await backfillManager.updateProgress(
              operation.id,
              Math.round(((indexed + failed) / allUris.length) * 100),
              indexed
            );
          }
        }

        logger.info('Full reindex completed', { indexed, failed, total: allUris.length });
        await backfillManager.completeOperation(operation.id, indexed);
      } catch (error) {
        await backfillManager.failOperation(
          operation.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    })();

    return { encoding: 'application/json', body: { operationId: operation.id, status: 'running' } };
  },
};
