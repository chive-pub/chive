/**
 * XRPC handler for pub.chive.eprint.getSubmission.
 *
 * @remarks
 * Retrieves an eprint by AT URI from Chive's index. Returns the full
 * eprint record with enriched metadata, version history, and metrics.
 *
 * **ATProto Compliance:**
 * - Returns pdsUrl for source transparency
 * - Never writes to user PDS
 * - Index data only (rebuildable from firehose)
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import { extractPlainText } from '../../../../utils/rich-text.js';
import { STALENESS_THRESHOLD_MS } from '../../../config.js';
import {
  getSubmissionParamsSchema,
  eprintResponseSchema,
  type GetSubmissionParams,
  type EprintResponse,
} from '../../../schemas/eprint.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.eprint.getSubmission query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Eprint submission with pdsUrl
 * @throws NotFoundError if eprint is not indexed
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.eprint.getSubmission?uri=at://did:plc:abc/pub.chive.eprint.submission/xyz
 *
 * Response:
 * {
 *   "uri": "at://did:plc:abc/pub.chive.eprint.submission/xyz",
 *   "title": "Quantum Computing Advances",
 *   "pdsUrl": "https://bsky.social",
 *   ...
 * }
 * ```
 *
 * @public
 */
export async function getSubmissionHandler(
  c: Context<ChiveEnv>,
  params: GetSubmissionParams
): Promise<EprintResponse> {
  const { eprint, metrics } = c.get('services');
  const logger = c.get('logger');
  const user = c.get('user');

  logger.debug('Getting eprint submission', { uri: params.uri });

  const result = await eprint.getEprint(params.uri as AtUri);

  if (!result) {
    throw new NotFoundError('Eprint', params.uri);
  }

  // Record view metric (non-blocking)
  metrics.recordView(params.uri as AtUri, user?.did).catch((err) => {
    logger.warn('Failed to record view', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  });

  // Extract rkey from AT URI for record URL
  const rkey = result.uri.split('/').pop() ?? '';

  // Calculate staleness using configured threshold
  const stalenessThreshold = Date.now() - STALENESS_THRESHOLD_MS;
  const isStale = result.indexedAt.getTime() < stalenessThreshold;

  // Determine which PDS holds the record (paper's PDS if paperDid set, otherwise submitter's)
  const recordOwner = result.paperDid ?? result.submittedBy;

  // Build record URL for direct PDS access
  const recordUrl = `${result.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(recordOwner)}&collection=pub.chive.eprint.submission&rkey=${rkey}`;

  // Build blob URL for direct PDS access
  const blobUrl = `${result.pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(recordOwner)}&cid=${result.documentBlobRef.ref}`;

  // Map authors to response format
  const authorsResponse = result.authors.map((author) => ({
    did: author.did,
    name: author.name,
    orcid: author.orcid,
    email: author.email,
    order: author.order,
    affiliations: author.affiliations.map((aff) => ({
      name: aff.name,
      rorId: aff.rorId,
      department: aff.department,
    })),
    contributions: author.contributions.map((contrib) => ({
      typeUri: contrib.typeUri,
      typeId: contrib.typeId,
      typeLabel: contrib.typeLabel,
      degree: contrib.degree,
    })),
    isCorrespondingAuthor: author.isCorrespondingAuthor,
    isHighlighted: author.isHighlighted,
    // Handle/avatar would be resolved from identity service
    handle: undefined,
    avatarUrl: undefined,
  }));

  // Map stored eprint to response format
  const response: EprintResponse = {
    uri: result.uri,
    cid: result.cid,
    title: result.title,
    abstract: result.abstractPlainText ?? extractPlainText(result.abstract),
    authors: authorsResponse,
    submittedBy: result.submittedBy,
    paperDid: result.paperDid,
    document: {
      $type: 'blob',
      ref: result.documentBlobRef.ref,
      mimeType: result.documentBlobRef.mimeType,
      size: result.documentBlobRef.size,
    },
    documentFormat: result.documentFormat,
    supplementary: result.supplementaryMaterials?.map((item) => ({
      blob: {
        $type: 'blob',
        ref: item.blobRef.ref,
        mimeType: item.blobRef.mimeType,
        size: item.blobRef.size,
      },
      label: item.label,
      description: item.description,
      category: item.category,
      detectedFormat: item.detectedFormat,
      order: item.order,
    })),
    fields: undefined,
    keywords: result.keywords ? [...result.keywords] : undefined,
    license: result.license,
    doi: undefined,
    createdAt: result.createdAt.toISOString(),
    updatedAt: undefined,
    indexedAt: result.indexedAt.toISOString(),

    // ATProto compliance: source information for verification and credible exit
    source: {
      pdsEndpoint: result.pdsUrl,
      recordUrl,
      blobUrl,
      lastVerifiedAt: result.indexedAt.toISOString(),
      stale: isStale,
    },

    // Enriched data
    metrics: result.metrics
      ? {
          views: result.metrics.views,
          downloads: result.metrics.downloads,
          endorsements: result.metrics.endorsements,
        }
      : undefined,
    versions: result.versions.map((v) => ({
      version: v.versionNumber,
      cid: v.cid,
      createdAt: new Date(v.createdAt).toISOString(),
      changelog: v.changes,
    })),
  };

  return response;
}

/**
 * Endpoint definition for pub.chive.eprint.getSubmission.
 *
 * @public
 */
export const getSubmissionEndpoint: XRPCEndpoint<GetSubmissionParams, EprintResponse> = {
  method: 'pub.chive.eprint.getSubmission' as never,
  type: 'query',
  description: 'Get an eprint submission by AT URI',
  inputSchema: getSubmissionParamsSchema,
  outputSchema: eprintResponseSchema,
  handler: getSubmissionHandler,
  auth: 'optional',
  rateLimit: 'authenticated',
};
