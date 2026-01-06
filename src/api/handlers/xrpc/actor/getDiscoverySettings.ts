/**
 * Get current user's discovery settings handler.
 *
 * @remarks
 * Returns the authenticated user's pub.chive.actor.discoverySettings record.
 * Requires authentication since it accesses the user's own settings.
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
 * For You signals schema.
 */
const forYouSignalsSchema = z.object({
  fields: z.boolean().optional(),
  citations: z.boolean().optional(),
  collaborators: z.boolean().optional(),
  trending: z.boolean().optional(),
});

/**
 * Related papers signals schema.
 */
const relatedPapersSignalsSchema = z.object({
  citations: z.boolean().optional(),
  topics: z.boolean().optional(),
});

/**
 * Discovery settings response schema.
 */
const discoverySettingsSchema = z.object({
  enablePersonalization: z.boolean(),
  enableForYouFeed: z.boolean(),
  forYouSignals: forYouSignalsSchema,
  relatedPapersSignals: relatedPapersSignalsSchema,
  citationNetworkDisplay: z.enum(['hidden', 'preview', 'expanded']),
  showRecommendationReasons: z.boolean(),
});

export type DiscoverySettings = z.infer<typeof discoverySettingsSchema>;

/**
 * Default discovery settings when user has none saved.
 */
const DEFAULT_DISCOVERY_SETTINGS: DiscoverySettings = {
  enablePersonalization: true,
  enableForYouFeed: true,
  forYouSignals: {
    fields: true,
    citations: true,
    collaborators: true,
    trending: true,
  },
  relatedPapersSignals: {
    citations: true,
    topics: true,
  },
  citationNetworkDisplay: 'preview',
  showRecommendationReasons: true,
};

/**
 * Raw PDS settings shape.
 */
interface RawPDSSettings {
  enablePersonalization?: boolean;
  enableForYouFeed?: boolean;
  forYouSignals?: {
    fields?: boolean;
    citations?: boolean;
    collaborators?: boolean;
    trending?: boolean;
  };
  relatedPapersSignals?: {
    citations?: boolean;
    topics?: boolean;
  };
  citationNetworkDisplay?: 'hidden' | 'preview' | 'expanded';
  showRecommendationReasons?: boolean;
}

/**
 * Normalizes raw PDS settings to the expected schema format.
 */
function normalizeSettings(raw: RawPDSSettings): DiscoverySettings {
  return {
    enablePersonalization:
      raw.enablePersonalization ?? DEFAULT_DISCOVERY_SETTINGS.enablePersonalization,
    enableForYouFeed: raw.enableForYouFeed ?? DEFAULT_DISCOVERY_SETTINGS.enableForYouFeed,
    forYouSignals: {
      fields: raw.forYouSignals?.fields ?? DEFAULT_DISCOVERY_SETTINGS.forYouSignals.fields,
      citations: raw.forYouSignals?.citations ?? DEFAULT_DISCOVERY_SETTINGS.forYouSignals.citations,
      collaborators:
        raw.forYouSignals?.collaborators ?? DEFAULT_DISCOVERY_SETTINGS.forYouSignals.collaborators,
      trending: raw.forYouSignals?.trending ?? DEFAULT_DISCOVERY_SETTINGS.forYouSignals.trending,
    },
    relatedPapersSignals: {
      citations:
        raw.relatedPapersSignals?.citations ??
        DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.citations,
      topics:
        raw.relatedPapersSignals?.topics ?? DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.topics,
    },
    citationNetworkDisplay:
      raw.citationNetworkDisplay ?? DEFAULT_DISCOVERY_SETTINGS.citationNetworkDisplay,
    showRecommendationReasons:
      raw.showRecommendationReasons ?? DEFAULT_DISCOVERY_SETTINGS.showRecommendationReasons,
  };
}

/**
 * Fetches the user's discovery settings from their PDS.
 */
async function fetchDiscoverySettingsFromPDS(
  did: DID,
  pdsEndpoint: string,
  logger: ILogger
): Promise<DiscoverySettings> {
  try {
    const settingsUrl = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=pub.chive.actor.discoverySettings&rkey=self`;

    const response = await fetch(settingsUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return DEFAULT_DISCOVERY_SETTINGS;
      }
      logger.debug('Discovery settings fetch failed', { did, status: response.status });
      return DEFAULT_DISCOVERY_SETTINGS;
    }

    const data = (await response.json()) as { value?: RawPDSSettings };
    if (!data.value) {
      return DEFAULT_DISCOVERY_SETTINGS;
    }

    return normalizeSettings(data.value);
  } catch (error) {
    logger.debug('Discovery settings fetch error', {
      did,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return DEFAULT_DISCOVERY_SETTINGS;
  }
}

/**
 * Handler for pub.chive.actor.getDiscoverySettings.
 *
 * @param c - Hono context
 * @param _params - Optional empty params (unused)
 * @returns The user's discovery settings
 */
export async function getDiscoverySettingsHandler(
  c: Context<ChiveEnv>,
  _params?: Record<string, never>
): Promise<DiscoverySettings> {
  const logger = c.get('logger');
  const user = c.get('user');

  if (!user?.did) {
    throw new AuthenticationError('Authentication required');
  }

  const did = user.did;
  const redis = c.get('redis');
  logger.debug('Fetching discovery settings', { did });

  // Resolve DID to get PDS endpoint
  const didResolver = new DIDResolver({ redis, logger });
  const pdsEndpoint = await didResolver.getPDSEndpoint(did);

  if (!pdsEndpoint) {
    throw new NotFoundError('PDS endpoint', did);
  }

  return fetchDiscoverySettingsFromPDS(did, pdsEndpoint, logger);
}

/**
 * Empty input schema for getDiscoverySettings.
 */
const getDiscoverySettingsInputSchema = z.object({}).optional();

type GetDiscoverySettingsInput = z.infer<typeof getDiscoverySettingsInputSchema>;

/**
 * XRPC endpoint definition for pub.chive.actor.getDiscoverySettings.
 *
 * @public
 */
export const getDiscoverySettingsEndpoint: XRPCEndpoint<
  GetDiscoverySettingsInput,
  DiscoverySettings
> = {
  method: 'pub.chive.actor.getDiscoverySettings' as never,
  type: 'query',
  description: "Get the authenticated user's discovery settings",
  inputSchema: getDiscoverySettingsInputSchema,
  outputSchema: discoverySettingsSchema,
  handler: getDiscoverySettingsHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
