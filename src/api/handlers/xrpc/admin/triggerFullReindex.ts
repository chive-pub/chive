/**
 * XRPC handler for pub.chive.admin.triggerFullReindex.
 *
 * @remarks
 * Triggers a full Elasticsearch reindex by reading all eprints from
 * PostgreSQL and re-indexing each into Elasticsearch via the search service.
 * The actual work runs in the background; the handler returns immediately
 * with the operation ID.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../../../types/atproto.js';
import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

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

    const { operation } = await backfillManager.startOperation('fullReindex');

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
          const batch = await admin.listImports(batchSize, offset);
          allUris = allUris.concat(batch.items.map((item) => item.uri));
          offset += batchSize;
          hasMore = batch.items.length === batchSize;
        }

        let indexed = 0;
        let failed = 0;

        for (const uri of allUris) {
          try {
            const stored = await eprintService.getEprint(uri as AtUri);
            if (!stored) {
              failed++;
              continue;
            }

            // Build an IndexableEprintDocument from the stored eprint
            const primaryAuthor = stored.authors?.find((a) => a.order === 1) ?? stored.authors?.[0];
            const authorDid = primaryAuthor?.did ?? stored.submittedBy;
            const authorName = primaryAuthor?.name ?? stored.submittedBy ?? 'Unknown';

            const fieldNodes =
              stored.fields
                ?.filter((f): f is typeof f & { id: string } => f.id !== undefined)
                .map((f) => ({ id: f.id, label: f.label })) ?? [];

            const result = await searchService.indexEprintForSearch({
              uri: uri as AtUri,
              author: authorDid,
              authorName,
              title: stored.title,
              abstract: stored.abstractPlainText ?? '',
              keywords: (stored.keywords as string[]) ?? [],
              fieldNodes,
              createdAt: stored.createdAt ?? new Date(),
              indexedAt: stored.indexedAt ?? new Date(),
            });

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
