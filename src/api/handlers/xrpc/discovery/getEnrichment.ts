/**
 * XRPC method for pub.chive.discovery.getEnrichment.
 *
 * @remarks
 * Returns enrichment data for an eprint, including external IDs,
 * citation counts, concepts, and topics from Semantic Scholar and OpenAlex.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/discovery/getEnrichment.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
// Use generated types from lexicons
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.discovery.getEnrichment.
 *
 * @remarks
 * Enrichment data includes:
 * - External IDs (Semantic Scholar, OpenAlex)
 * - Citation counts (total, influential, references)
 * - OpenAlex concepts with Wikidata IDs
 * - OpenAlex topics with hierarchical classification
 *
 * Enrichment data is computed asynchronously when eprints are indexed.
 * If enrichment is not yet available, returns { available: false }.
 *
 * @public
 */
export const getEnrichment: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { discovery, eprint } = c.get('services');

    logger.debug('Getting enrichment', { uri: params.uri });

    if (!discovery) {
      throw new ServiceUnavailableError('Discovery service not available');
    }

    // Verify eprint exists
    const sourceEprint = await eprint.getEprint(params.uri as AtUri);
    if (!sourceEprint) {
      throw new NotFoundError('Eprint', params.uri);
    }

    // Get enrichment data from discovery service
    let enrichment;
    try {
      enrichment = await discovery.getEnrichment(params.uri as AtUri);
    } catch (error) {
      // Log but don't fail - return unavailable response
      logger.warn('Failed to get enrichment data', {
        uri: params.uri,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        encoding: 'application/json',
        body: {
          enrichment: undefined,
          available: false,
        },
      };
    }

    if (!enrichment) {
      logger.debug('No enrichment data available', { uri: params.uri });
      return {
        encoding: 'application/json',
        body: {
          enrichment: undefined,
          available: false,
        },
      };
    }

    logger.info('Enrichment returned', {
      uri: params.uri,
      hasS2Id: !!enrichment.semanticScholarId,
      hasOAId: !!enrichment.openAlexId,
      conceptCount: enrichment.concepts?.length ?? 0,
    });

    return {
      encoding: 'application/json',
      body: {
        enrichment: {
          uri: params.uri,
          semanticScholarId: enrichment.semanticScholarId,
          openAlexId: enrichment.openAlexId,
          citationCount: enrichment.citationCount,
          influentialCitationCount: enrichment.influentialCitationCount,
          referencesCount: enrichment.referencesCount,
          concepts: enrichment.concepts?.map((c) => ({
            id: c.id,
            displayName: c.displayName,
            wikidataId: c.wikidataId,
            score: c.score,
          })),
          topics: enrichment.topics?.map((t) => ({
            id: t.id,
            displayName: t.displayName,
            subfield: t.subfield,
            field: t.field,
            domain: t.domain,
            score: t.score,
          })),
          lastEnrichedAt: enrichment.lastEnrichedAt?.toISOString(),
        },
        available: true,
      },
    };
  },
};
