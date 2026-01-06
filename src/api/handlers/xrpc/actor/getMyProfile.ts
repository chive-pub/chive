/**
 * Get current user's Chive profile handler.
 *
 * @remarks
 * Returns the authenticated user's pub.chive.actor.profile record.
 * Requires authentication since it accesses the user's own profile.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type { DID } from '../../../../types/atproto.js';
import { AuthenticationError, NotFoundError } from '../../../../types/errors.js';
import type { ILogger } from '../../../../types/interfaces/logger.interface.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Affiliation schema.
 */
const affiliationSchema = z.object({
  name: z.string(),
  rorId: z.string().optional(),
});

/**
 * Research keyword schema.
 */
const keywordSchema = z.object({
  label: z.string(),
  fastId: z.string().optional(),
  wikidataId: z.string().optional(),
});

/**
 * Chive profile response schema.
 */
const chiveProfileSchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().optional(),
  orcid: z.string().optional(),
  affiliations: z.array(affiliationSchema).optional(),
  fields: z.array(z.string()).optional(),
  nameVariants: z.array(z.string()).optional(),
  previousAffiliations: z.array(affiliationSchema).optional(),
  researchKeywords: z.array(keywordSchema).optional(),
  semanticScholarId: z.string().optional(),
  openAlexId: z.string().optional(),
  googleScholarId: z.string().optional(),
  arxivAuthorId: z.string().optional(),
  openReviewId: z.string().optional(),
  dblpId: z.string().optional(),
  scopusAuthorId: z.string().optional(),
});

export type ChiveProfile = z.infer<typeof chiveProfileSchema>;

/**
 * Raw PDS profile shape (may have legacy string[] or new object[] format).
 */
interface RawPDSProfile {
  displayName?: string;
  bio?: string;
  orcid?: string;
  affiliations?: string[] | { name: string; rorId?: string }[];
  fields?: string[];
  nameVariants?: string[];
  previousAffiliations?: string[] | { name: string; rorId?: string }[];
  researchKeywords?: string[] | { label: string; fastId?: string; wikidataId?: string }[];
  semanticScholarId?: string;
  openAlexId?: string;
  googleScholarId?: string;
  arxivAuthorId?: string;
  openReviewId?: string;
  dblpId?: string;
  scopusAuthorId?: string;
}

/**
 * Normalizes affiliations from legacy string[] or new object[] format.
 */
function normalizeAffiliations(
  affiliations: string[] | { name: string; rorId?: string }[] | undefined
): { name: string; rorId?: string }[] | undefined {
  if (!affiliations || affiliations.length === 0) {
    return undefined;
  }

  return affiliations.map((aff) => {
    if (typeof aff === 'string') {
      return { name: aff };
    }
    return aff;
  });
}

/**
 * Normalizes keywords from legacy string[] or new object[] format.
 */
function normalizeKeywords(
  keywords: string[] | { label: string; fastId?: string; wikidataId?: string }[] | undefined
): { label: string; fastId?: string; wikidataId?: string }[] | undefined {
  if (!keywords || keywords.length === 0) {
    return undefined;
  }

  return keywords.map((kw) => {
    if (typeof kw === 'string') {
      return { label: kw };
    }
    return kw;
  });
}

/**
 * Normalizes raw PDS profile data to the expected schema format.
 */
function normalizeProfile(raw: RawPDSProfile): ChiveProfile {
  return {
    displayName: raw.displayName,
    bio: raw.bio,
    orcid: raw.orcid,
    affiliations: normalizeAffiliations(raw.affiliations),
    fields: raw.fields,
    nameVariants: raw.nameVariants,
    previousAffiliations: normalizeAffiliations(raw.previousAffiliations),
    researchKeywords: normalizeKeywords(raw.researchKeywords),
    semanticScholarId: raw.semanticScholarId,
    openAlexId: raw.openAlexId,
    googleScholarId: raw.googleScholarId,
    arxivAuthorId: raw.arxivAuthorId,
    openReviewId: raw.openReviewId,
    dblpId: raw.dblpId,
    scopusAuthorId: raw.scopusAuthorId,
  };
}

/**
 * Fetches the user's Chive profile from their PDS.
 */
async function fetchChiveProfileFromPDS(
  did: DID,
  pdsEndpoint: string,
  logger: ILogger
): Promise<ChiveProfile | null> {
  try {
    const profileUrl = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=pub.chive.actor.profile&rkey=self`;

    const response = await fetch(profileUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      logger.debug('Chive profile fetch failed', { did, status: response.status });
      return null;
    }

    const data = (await response.json()) as { value?: RawPDSProfile };
    if (!data.value) {
      return null;
    }

    // Normalize legacy string[] formats to new object[] formats
    return normalizeProfile(data.value);
  } catch (error) {
    logger.debug('Chive profile fetch error', {
      did,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Handler for pub.chive.actor.getMyProfile.
 *
 * @param c - Hono context
 * @param _params - Optional empty params (unused)
 * @returns The user's Chive profile
 */
export async function getMyProfileHandler(
  c: Context<ChiveEnv>,
  _params?: Record<string, never>
): Promise<ChiveProfile> {
  const logger = c.get('logger');
  const user = c.get('user');

  if (!user?.did) {
    throw new AuthenticationError('Authentication required');
  }

  const did = user.did;
  const redis = c.get('redis');
  logger.debug('Fetching my Chive profile', { did });

  // Resolve DID to get PDS endpoint
  const didResolver = new DIDResolver({ redis, logger });
  const pdsEndpoint = await didResolver.getPDSEndpoint(did);

  if (!pdsEndpoint) {
    throw new NotFoundError('PDS endpoint', did);
  }

  const profile = await fetchChiveProfileFromPDS(did, pdsEndpoint, logger);

  if (!profile) {
    // Return empty profile if none exists (user can create one)
    return {};
  }

  return profile;
}

/**
 * Empty input schema for getMyProfile.
 */
const getMyProfileInputSchema = z.object({}).optional();

type GetMyProfileInput = z.infer<typeof getMyProfileInputSchema>;

/**
 * XRPC endpoint definition for pub.chive.actor.getMyProfile.
 *
 * @public
 */
export const getMyProfileEndpoint: XRPCEndpoint<GetMyProfileInput, ChiveProfile> = {
  method: 'pub.chive.actor.getMyProfile' as never,
  type: 'query',
  description: "Get the authenticated user's Chive profile",
  inputSchema: getMyProfileInputSchema,
  outputSchema: chiveProfileSchema,
  handler: getMyProfileHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
