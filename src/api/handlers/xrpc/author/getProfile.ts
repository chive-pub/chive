/**
 * Author profile handler.
 *
 * @remarks
 * Returns author profile information and aggregated metrics.
 * Profile data is resolved from the user's PDS via identity resolution.
 * Metrics are computed by the AppView from indexed preprints.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { MetricsService } from '../../../../services/metrics/metrics-service.js';
import type { PreprintService } from '../../../../services/preprint/preprint-service.js';
import type { DID } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { ILogger } from '../../../../types/interfaces/logger.interface.js';
import {
  authorProfileResponseSchema,
  getAuthorProfileParamsSchema,
  type AuthorProfileResponse,
  type GetAuthorProfileParams,
} from '../../../schemas/author.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Affiliation from PDS profile.
 */
interface ProfileAffiliation {
  name: string;
  rorId?: string;
}

/**
 * Research keyword from PDS profile.
 */
interface ProfileKeyword {
  label: string;
  fastId?: string;
  wikidataId?: string;
}

/**
 * Combined profile data from both Bluesky and Chive profile records.
 */
interface CombinedProfileData {
  handle?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  affiliation?: string;
  affiliations?: ProfileAffiliation[];
  orcid?: string;
  website?: string;
  fields?: string[];
  nameVariants?: string[];
  previousAffiliations?: ProfileAffiliation[];
  researchKeywords?: ProfileKeyword[];
  semanticScholarId?: string;
  openAlexId?: string;
  googleScholarId?: string;
  arxivAuthorId?: string;
  openReviewId?: string;
  dblpId?: string;
  scopusAuthorId?: string;
}

/**
 * Fetches author profile from PDS via identity resolution.
 *
 * @param did - Author DID
 * @param pdsEndpoint - PDS endpoint URL
 * @param logger - Logger instance
 * @returns Combined profile data from app.bsky.actor.profile and pub.chive.actor.profile
 */
async function fetchProfileFromPDS(
  did: DID,
  pdsEndpoint: string,
  logger: ILogger
): Promise<CombinedProfileData | null> {
  try {
    // Fetch both Bluesky and Chive profile records in parallel
    const [bskyResponse, chiveResponse] = await Promise.all([
      fetch(
        `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        }
      ),
      fetch(
        `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=pub.chive.actor.profile&rkey=self`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        }
      ).catch(() => null), // Chive profile is optional
    ]);

    const result: CombinedProfileData = {};

    // Parse Bluesky profile
    if (bskyResponse.ok) {
      const bskyData = (await bskyResponse.json()) as {
        value?: {
          displayName?: string;
          description?: string;
          avatar?: { ref?: { $link?: string } };
        };
      };

      const bskyProfile = bskyData.value;
      if (bskyProfile) {
        result.displayName = bskyProfile.displayName;
        result.bio = bskyProfile.description;

        // Extract avatar URL if present
        if (bskyProfile.avatar?.ref?.$link) {
          result.avatar = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${bskyProfile.avatar.ref.$link}`;
        }
      }
    } else {
      logger.debug('Bluesky profile fetch failed', { did, status: bskyResponse.status });
    }

    // Parse Chive profile (contains academic-specific fields)
    if (chiveResponse?.ok) {
      const chiveData = (await chiveResponse.json()) as {
        value?: {
          displayName?: string;
          bio?: string;
          avatar?: { ref?: { $link?: string } };
          orcid?: string;
          affiliations?: { name: string; rorId?: string }[];
          fields?: string[];
          nameVariants?: string[];
          previousAffiliations?: { name: string; rorId?: string }[];
          researchKeywords?: { label: string; fastId?: string; wikidataId?: string }[];
          semanticScholarId?: string;
          openAlexId?: string;
          googleScholarId?: string;
          arxivAuthorId?: string;
          openReviewId?: string;
          dblpId?: string;
          scopusAuthorId?: string;
        };
      };

      const chiveProfile = chiveData.value;
      if (chiveProfile) {
        // Chive profile overrides Bluesky profile for display name/bio if present
        if (chiveProfile.displayName) result.displayName = chiveProfile.displayName;
        if (chiveProfile.bio) result.bio = chiveProfile.bio;

        // Chive-specific avatar (if set)
        if (chiveProfile.avatar?.ref?.$link && !result.avatar) {
          result.avatar = `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${chiveProfile.avatar.ref.$link}`;
        }

        // Academic identity fields
        result.orcid = chiveProfile.orcid;
        result.affiliations = chiveProfile.affiliations;
        result.affiliation = chiveProfile.affiliations?.[0]?.name; // Primary affiliation name for display
        result.fields = chiveProfile.fields;

        // Paper matching fields
        result.nameVariants = chiveProfile.nameVariants;
        result.previousAffiliations = chiveProfile.previousAffiliations;
        result.researchKeywords = chiveProfile.researchKeywords;

        // External authority IDs
        result.semanticScholarId = chiveProfile.semanticScholarId;
        result.openAlexId = chiveProfile.openAlexId;
        result.googleScholarId = chiveProfile.googleScholarId;
        result.arxivAuthorId = chiveProfile.arxivAuthorId;
        result.openReviewId = chiveProfile.openReviewId;
        result.dblpId = chiveProfile.dblpId;
        result.scopusAuthorId = chiveProfile.scopusAuthorId;
      }
    } else if (chiveResponse) {
      logger.debug('Chive profile not found (optional)', { did, status: chiveResponse.status });
    }

    // Return null only if we got nothing at all
    if (Object.keys(result).length === 0) {
      return null;
    }

    return result;
  } catch (error) {
    logger.debug('Profile fetch error', {
      did,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Handler for pub.chive.author.getProfile.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Author profile response with profile and metrics
 *
 * @throws {NotFoundError} When the author is not found in the index
 */
export async function getProfileHandler(
  c: Context<ChiveEnv>,
  params: GetAuthorProfileParams
): Promise<AuthorProfileResponse> {
  const logger = c.get('logger');
  const redis = c.get('redis');
  const { preprint, metrics } = c.get('services');

  const did = params.did as DID;

  logger.debug('Fetching author profile', { did });

  // Try to get cached profile first
  const cacheKey = `chive:author:profile:${did}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached) as AuthorProfileResponse;
    } catch {
      // Invalid cache, continue to fetch
    }
  }

  // Resolve DID to get PDS endpoint and handle
  // Use the DID resolver from auth context (injected by middleware)
  const didResolver = (
    c.get as unknown as (key: 'didResolver') => {
      resolveDID: (did: DID) => Promise<{
        alsoKnownAs?: readonly string[];
        service?: readonly { id: string; type: string; serviceEndpoint: string }[];
      } | null>;
      getPDSEndpoint: (did: DID) => Promise<string | null>;
    }
  )('didResolver');

  let pdsEndpoint: string | undefined;
  let handle: string | undefined;

  if (didResolver) {
    const [pds, didDoc] = await Promise.all([
      didResolver.getPDSEndpoint(did),
      didResolver.resolveDID(did),
    ]);

    pdsEndpoint = pds ?? undefined;

    // Extract handle from alsoKnownAs
    if (didDoc?.alsoKnownAs) {
      const handleEntry = didDoc.alsoKnownAs.find((aka) => aka.startsWith('at://'));
      if (handleEntry) {
        handle = handleEntry.replace('at://', '');
      }
    }
  }

  // Get author's preprints to verify they exist in our system
  const authorPreprints = await preprint.getPreprintsByAuthor(did, { limit: 1 });

  if (!pdsEndpoint && authorPreprints.preprints.length === 0) {
    throw new NotFoundError('Author', did);
  }

  // Fetch profile from PDS if available
  let profileData: Awaited<ReturnType<typeof fetchProfileFromPDS>> = null;
  if (pdsEndpoint) {
    profileData = await fetchProfileFromPDS(did, pdsEndpoint, logger);
  }

  // Compute author metrics from indexed data
  const [totalViews, totalDownloads, endorsementCount] = await Promise.all([
    // Aggregate views across all preprints
    aggregateAuthorViews(did, preprint, metrics, logger),
    // Aggregate downloads
    aggregateAuthorDownloads(did, preprint, metrics, logger),
    // Count endorsements (from review service)
    countAuthorEndorsements(did, c),
  ]);

  const response: AuthorProfileResponse = {
    profile: {
      did,
      handle: handle ?? profileData?.handle,
      displayName: profileData?.displayName,
      avatar: profileData?.avatar,
      bio: profileData?.bio,
      affiliation: profileData?.affiliation,
      affiliations: profileData?.affiliations,
      orcid: profileData?.orcid,
      website: profileData?.website,
      pdsEndpoint: pdsEndpoint ?? 'unknown',
      // Research fields
      fields: profileData?.fields,
      // Paper matching fields
      nameVariants: profileData?.nameVariants,
      previousAffiliations: profileData?.previousAffiliations,
      researchKeywords: profileData?.researchKeywords,
      // External authority IDs
      semanticScholarId: profileData?.semanticScholarId,
      openAlexId: profileData?.openAlexId,
      googleScholarId: profileData?.googleScholarId,
      arxivAuthorId: profileData?.arxivAuthorId,
      openReviewId: profileData?.openReviewId,
      dblpId: profileData?.dblpId,
      scopusAuthorId: profileData?.scopusAuthorId,
    },
    metrics: {
      totalPreprints: authorPreprints.total ?? 0,
      totalViews,
      totalDownloads,
      totalEndorsements: endorsementCount,
    },
  };

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(response));

  return response;
}

/**
 * Aggregates total views across all author's preprints.
 */
async function aggregateAuthorViews(
  did: DID,
  preprintService: PreprintService,
  metricsService: MetricsService,
  logger: ILogger
): Promise<number> {
  try {
    // Get all author's preprints
    const result = await preprintService.getPreprintsByAuthor(did, { limit: 100 });

    if (result.preprints.length === 0) {
      return 0;
    }

    // Sum up views for all preprints
    const viewCounts = await Promise.all(
      result.preprints.map((p) => metricsService.getViewCount(p.uri))
    );

    return viewCounts.reduce((sum: number, count: number) => sum + count, 0);
  } catch (error) {
    logger.debug('Failed to aggregate author views', {
      did,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * Aggregates total downloads across all author's preprints.
 */
async function aggregateAuthorDownloads(
  did: DID,
  preprintService: PreprintService,
  metricsService: MetricsService,
  logger: ILogger
): Promise<number> {
  try {
    const result = await preprintService.getPreprintsByAuthor(did, { limit: 100 });

    if (result.preprints.length === 0) {
      return 0;
    }

    const downloadCounts = await Promise.all(
      result.preprints.map(async (p) => {
        const m = await metricsService.getMetrics(p.uri);
        return m.totalDownloads;
      })
    );

    return downloadCounts.reduce((sum: number, count: number) => sum + count, 0);
  } catch (error) {
    logger.debug('Failed to aggregate author downloads', {
      did,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * Counts total endorsements received by author's preprints.
 */
async function countAuthorEndorsements(did: DID, c: Context<ChiveEnv>): Promise<number> {
  try {
    const { review, preprint } = c.get('services');

    const result = await preprint.getPreprintsByAuthor(did, { limit: 100 });

    if (result.preprints.length === 0) {
      return 0;
    }

    // Get endorsement summaries for each preprint
    const endorsementCounts = await Promise.all(
      result.preprints.map(async (p) => {
        try {
          const summary = await review.getEndorsementSummary(p.uri);
          return summary.total;
        } catch {
          return 0;
        }
      })
    );

    return endorsementCounts.reduce((sum: number, count: number) => sum + count, 0);
  } catch (error) {
    const logger = c.get('logger');
    logger.debug('Failed to count author endorsements', {
      did,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * XRPC endpoint definition for pub.chive.author.getProfile.
 *
 * @public
 */
export const getProfileEndpoint: XRPCEndpoint<GetAuthorProfileParams, AuthorProfileResponse> = {
  method: 'pub.chive.author.getProfile' as never,
  type: 'query',
  description: 'Get author profile and metrics by DID',
  inputSchema: getAuthorProfileParamsSchema,
  outputSchema: authorProfileResponseSchema,
  handler: getProfileHandler,
  auth: 'optional',
  rateLimit: 'authenticated',
};
