/**
 * Handler for pub.chive.claiming.getSuggestions.
 *
 * @remarks
 * Returns suggested papers for the authenticated user to claim based on
 * their Chive profile (name variants, ORCID, affiliations, keywords).
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/getSuggestions.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.getSuggestions.
 *
 * @remarks
 * Uses the authenticated user's Chive profile to find papers they may have
 * authored. Papers are scored based on:
 * - ORCID match (highest confidence)
 * - Name similarity to profile's name variants
 * - Affiliation overlap
 * - Research keyword matches
 *
 * Requires authentication to access user's profile data.
 *
 * @public
 */
export const getSuggestions: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { claiming } = c.get('services');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required to get suggestions');
    }

    const did = user.did;
    logger.debug('Getting paper suggestions', { did, limit: params.limit });

    // Get suggested papers from claiming service
    const suggestions = await claiming.getSuggestedPapers(did, {
      limit: params.limit,
      timeoutMs: 10000, // 10 second timeout for suggestions
    });

    // Map to response format
    const papers = suggestions.papers.map((p) => ({
      externalId: p.externalId,
      url: p.url,
      title: p.title,
      abstract: p.abstract,
      authors: p.authors.map((a) => ({
        name: a.name,
        orcid: a.orcid,
        affiliation: a.affiliation,
        email: a.email,
      })),
      publicationDate: p.publicationDate?.toISOString(),
      doi: p.doi,
      pdfUrl: p.pdfUrl,
      categories: p.categories ? [...p.categories] : undefined,
      source: p.source,
      matchScore: p.matchScore,
      matchReason: p.matchReason,
    }));

    logger.info('Paper suggestions returned', {
      did,
      count: papers.length,
      hasOrcid: suggestions.profileUsed.hasOrcid,
      nameVariantCount: suggestions.profileUsed.nameVariants.length,
    });

    return {
      encoding: 'application/json',
      body: {
        papers,
        profileUsed: {
          displayName: suggestions.profileUsed.displayName,
          nameVariants: [...suggestions.profileUsed.nameVariants],
          hasOrcid: suggestions.profileUsed.hasOrcid,
          hasExternalIds: suggestions.profileUsed.hasExternalIds,
        },
      },
    };
  },
};
