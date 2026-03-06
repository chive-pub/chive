/**
 * XRPC handler for pub.chive.admin.triggerCitationExtraction.
 *
 * @remarks
 * Triggers citation extraction for all indexed eprints by querying PostgreSQL
 * for eprint URIs (via the admin service) and running the
 * CitationExtractionService against each. The actual work runs in the
 * background; the handler returns immediately with the operation ID.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../../../types/atproto.js';
import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const triggerCitationExtraction: XRPCMethod<void, void, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const logger = c.get('logger');
    const { backfillManager, citationExtraction, admin } = c.get('services');
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }
    if (!citationExtraction) {
      throw new ServiceUnavailableError('Citation extraction service is not configured');
    }
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }

    const { operation } = await backfillManager.startOperation('citationExtraction');

    logger.info('Citation extraction triggered', { operationId: operation.id });

    // Fire-and-forget: extract citations for all eprints in the background
    void (async () => {
      try {
        // Fetch all eprint URIs via the admin service list
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

        let processed = 0;
        let totalExtracted = 0;

        for (const eprintUri of allUris) {
          try {
            const extractionResult = await citationExtraction.extractCitations(eprintUri as AtUri, {
              useCrossref: true,
              useSemanticScholar: true,
              useGrobid: true,
            });
            totalExtracted += extractionResult.totalExtracted;
          } catch (err) {
            logger.warn('Citation extraction failed for eprint', {
              eprintUri,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          processed++;
          if (processed % 10 === 0) {
            await backfillManager.updateProgress(
              operation.id,
              Math.round((processed / allUris.length) * 100),
              totalExtracted
            );
          }
        }

        await backfillManager.completeOperation(operation.id, totalExtracted);
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
