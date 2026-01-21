/**
 * Get current user's discovery settings handler.
 *
 * @remarks
 * Returns the authenticated user's pub.chive.discovery.settings record.
 * Requires authentication since it accesses the user's own settings.
 *
 * @packageDocumentation
 * @public
 */

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type {
  QueryParams,
  OutputSchema,
  ForYouSignals,
  RelatedPapersSignals,
} from '../../../../lexicons/generated/types/pub/chive/actor/getDiscoverySettings.js';
import type { DID } from '../../../../types/atproto.js';
import { AuthenticationError, NotFoundError } from '../../../../types/errors.js';
import type { ILogger } from '../../../../types/interfaces/logger.interface.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Default discovery settings when user has none saved.
 */
const DEFAULT_DISCOVERY_SETTINGS: OutputSchema = {
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
function normalizeSettings(raw: RawPDSSettings): OutputSchema {
  const forYouSignals: ForYouSignals = {
    fields: raw.forYouSignals?.fields ?? DEFAULT_DISCOVERY_SETTINGS.forYouSignals.fields,
    citations: raw.forYouSignals?.citations ?? DEFAULT_DISCOVERY_SETTINGS.forYouSignals.citations,
    collaborators:
      raw.forYouSignals?.collaborators ?? DEFAULT_DISCOVERY_SETTINGS.forYouSignals.collaborators,
    trending: raw.forYouSignals?.trending ?? DEFAULT_DISCOVERY_SETTINGS.forYouSignals.trending,
  };

  const relatedPapersSignals: RelatedPapersSignals = {
    citations:
      raw.relatedPapersSignals?.citations ??
      DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.citations,
    topics:
      raw.relatedPapersSignals?.topics ?? DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.topics,
  };

  return {
    enablePersonalization:
      raw.enablePersonalization ?? DEFAULT_DISCOVERY_SETTINGS.enablePersonalization,
    enableForYouFeed: raw.enableForYouFeed ?? DEFAULT_DISCOVERY_SETTINGS.enableForYouFeed,
    forYouSignals,
    relatedPapersSignals,
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
): Promise<OutputSchema> {
  try {
    const settingsUrl = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=pub.chive.discovery.settings&rkey=self`;

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
 * XRPC method for pub.chive.discovery.getSettings.
 *
 * @public
 */
export const getDiscoverySettings: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<OutputSchema>> => {
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

    const settings = await fetchDiscoverySettingsFromPDS(did, pdsEndpoint, logger);

    return { encoding: 'application/json', body: settings };
  },
};
