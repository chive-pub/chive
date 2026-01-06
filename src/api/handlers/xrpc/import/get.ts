/**
 * Handler for pub.chive.import.get.
 *
 * @remarks
 * Gets an imported preprint by source and external ID.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getImportParamsSchema,
  importedPreprintSchema,
  type GetImportParams,
  type ImportedPreprint,
} from '../../../schemas/import.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.import.get.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Imported preprint
 *
 * @throws {NotFoundError} When import is not found
 *
 * @public
 */
export async function getImportHandler(
  c: Context<ChiveEnv>,
  params: GetImportParams
): Promise<ImportedPreprint> {
  const logger = c.get('logger');
  const { import: importService } = c.get('services');

  logger.debug('Getting import', { source: params.source, externalId: params.externalId });

  const result = await importService.get(params.source, params.externalId);

  if (!result) {
    throw new NotFoundError('ImportedPreprint', `${params.source}:${params.externalId}`);
  }

  return {
    id: result.id,
    source: result.source,
    externalId: result.externalId,
    url: result.url,
    title: result.title,
    abstract: result.abstract,
    authors: result.authors.map((a) => ({
      name: a.name,
      orcid: a.orcid,
      affiliation: a.affiliation,
      email: a.email,
    })),
    publicationDate: result.publicationDate?.toISOString(),
    categories: result.categories as string[] | undefined,
    doi: result.doi,
    pdfUrl: result.pdfUrl,
    importedByPlugin: result.importedByPlugin,
    importedAt: result.importedAt.toISOString(),
    lastSyncedAt: result.lastSyncedAt?.toISOString(),
    syncStatus: result.syncStatus,
    claimStatus: result.claimStatus,
    canonicalUri: result.canonicalUri,
    claimedByDid: result.claimedByDid,
    claimedAt: result.claimedAt?.toISOString(),
  };
}

/**
 * Endpoint definition for pub.chive.import.get.
 *
 * @public
 */
export const getImportEndpoint: XRPCEndpoint<GetImportParams, ImportedPreprint> = {
  method: 'pub.chive.import.get' as never,
  type: 'query',
  description: 'Get an imported preprint by source and external ID',
  inputSchema: getImportParamsSchema,
  outputSchema: importedPreprintSchema,
  handler: getImportHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
