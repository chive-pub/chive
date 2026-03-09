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
  RelatedPapersSignals,
  RelatedPapersWeights,
  RelatedPapersThresholds,
  TrendingPreferences,
} from '../../../../lexicons/generated/types/pub/chive/actor/getDiscoverySettings.js';
import type { DID } from '../../../../types/atproto.js';
import { AuthenticationError, NotFoundError } from '../../../../types/errors.js';
import type { ILogger } from '../../../../types/interfaces/logger.interface.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Default related papers weights matching DEFAULT_DISCOVERY_WEIGHTS in the ranking service.
 */
const DEFAULT_RELATED_PAPERS_WEIGHTS: Omit<Required<RelatedPapersWeights>, '$type'> = {
  semantic: 25,
  coCitation: 20,
  conceptOverlap: 15,
  authorNetwork: 30,
  collaborative: 10,
};

/**
 * Default related papers thresholds.
 */
const DEFAULT_RELATED_PAPERS_THRESHOLDS: Omit<Required<RelatedPapersThresholds>, '$type'> = {
  minScore: 5,
  maxResults: 10,
};

/**
 * Default trending preferences.
 */
const DEFAULT_TRENDING_PREFERENCES: Omit<Required<TrendingPreferences>, '$type'> = {
  defaultWindow: '7d',
  defaultLimit: 20,
};

/**
 * Default discovery settings when user has none saved.
 */
const DEFAULT_DISCOVERY_SETTINGS: OutputSchema = {
  enablePersonalization: true,
  relatedPapersSignals: {
    semantic: true,
    citations: true,
    topics: true,
    authors: true,
    coCitation: false,
    bibliographicCoupling: false,
    collaborative: false,
  },
  relatedPapersWeights: DEFAULT_RELATED_PAPERS_WEIGHTS,
  relatedPapersThresholds: DEFAULT_RELATED_PAPERS_THRESHOLDS,
  trendingPreferences: DEFAULT_TRENDING_PREFERENCES,
  citationNetworkDisplay: 'preview',
  showRecommendationReasons: true,
  recommendationDiversity: 'medium',
  minimumEndorsementThreshold: 0,
  followedFieldUris: [],
  followingTabIncludesWorkFields: false,
};

/**
 * Raw PDS settings shape.
 */
interface RawPDSSettings {
  enablePersonalization?: boolean;
  relatedPapersSignals?: {
    semantic?: boolean;
    citations?: boolean;
    topics?: boolean;
    authors?: boolean;
    coCitation?: boolean;
    bibliographicCoupling?: boolean;
    collaborative?: boolean;
  };
  relatedPapersWeights?: {
    semantic?: number;
    coCitation?: number;
    conceptOverlap?: number;
    authorNetwork?: number;
    collaborative?: number;
  };
  relatedPapersThresholds?: {
    minScore?: number;
    maxResults?: number;
  };
  trendingPreferences?: {
    defaultWindow?: string;
    defaultLimit?: number;
  };
  citationNetworkDisplay?: 'hidden' | 'preview' | 'expanded';
  showRecommendationReasons?: boolean;
  recommendationDiversity?: 'low' | 'medium' | 'high';
  minimumEndorsementThreshold?: number;
  followedFieldUris?: string[];
  followingTabIncludesWorkFields?: boolean;
}

/**
 * Clamps a weight value to the valid range.
 */
function clampWeight(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Normalizes raw PDS settings to the expected schema format.
 */
function normalizeSettings(raw: RawPDSSettings): OutputSchema {
  const relatedPapersSignals: RelatedPapersSignals = {
    semantic:
      raw.relatedPapersSignals?.semantic ??
      DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.semantic,
    citations:
      raw.relatedPapersSignals?.citations ??
      DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.citations,
    topics:
      raw.relatedPapersSignals?.topics ?? DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.topics,
    authors:
      raw.relatedPapersSignals?.authors ?? DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.authors,
    coCitation:
      raw.relatedPapersSignals?.coCitation ??
      DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.coCitation,
    bibliographicCoupling:
      raw.relatedPapersSignals?.bibliographicCoupling ??
      DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.bibliographicCoupling,
    collaborative:
      raw.relatedPapersSignals?.collaborative ??
      DEFAULT_DISCOVERY_SETTINGS.relatedPapersSignals.collaborative,
  };

  const relatedPapersWeights: RelatedPapersWeights = {
    semantic: clampWeight(
      raw.relatedPapersWeights?.semantic,
      DEFAULT_RELATED_PAPERS_WEIGHTS.semantic
    ),
    coCitation: clampWeight(
      raw.relatedPapersWeights?.coCitation,
      DEFAULT_RELATED_PAPERS_WEIGHTS.coCitation
    ),
    conceptOverlap: clampWeight(
      raw.relatedPapersWeights?.conceptOverlap,
      DEFAULT_RELATED_PAPERS_WEIGHTS.conceptOverlap
    ),
    authorNetwork: clampWeight(
      raw.relatedPapersWeights?.authorNetwork,
      DEFAULT_RELATED_PAPERS_WEIGHTS.authorNetwork
    ),
    collaborative: clampWeight(
      raw.relatedPapersWeights?.collaborative,
      DEFAULT_RELATED_PAPERS_WEIGHTS.collaborative
    ),
  };

  const relatedPapersThresholds: RelatedPapersThresholds = {
    minScore: clampWeight(
      raw.relatedPapersThresholds?.minScore,
      DEFAULT_RELATED_PAPERS_THRESHOLDS.minScore
    ),
    maxResults: Math.max(
      1,
      Math.min(
        50,
        raw.relatedPapersThresholds?.maxResults ?? DEFAULT_RELATED_PAPERS_THRESHOLDS.maxResults
      )
    ),
  };

  const validWindows = ['24h', '7d', '30d'];
  const rawWindow = raw.trendingPreferences?.defaultWindow;
  const trendingPreferences: TrendingPreferences = {
    defaultWindow:
      rawWindow && validWindows.includes(rawWindow)
        ? rawWindow
        : DEFAULT_TRENDING_PREFERENCES.defaultWindow,
    defaultLimit: Math.max(
      5,
      Math.min(
        100,
        raw.trendingPreferences?.defaultLimit ?? DEFAULT_TRENDING_PREFERENCES.defaultLimit
      )
    ),
  };

  return {
    enablePersonalization:
      raw.enablePersonalization ?? DEFAULT_DISCOVERY_SETTINGS.enablePersonalization,
    relatedPapersSignals,
    relatedPapersWeights,
    relatedPapersThresholds,
    trendingPreferences,
    citationNetworkDisplay:
      raw.citationNetworkDisplay ?? DEFAULT_DISCOVERY_SETTINGS.citationNetworkDisplay,
    showRecommendationReasons:
      raw.showRecommendationReasons ?? DEFAULT_DISCOVERY_SETTINGS.showRecommendationReasons,
    recommendationDiversity:
      raw.recommendationDiversity ?? DEFAULT_DISCOVERY_SETTINGS.recommendationDiversity,
    minimumEndorsementThreshold:
      raw.minimumEndorsementThreshold ?? DEFAULT_DISCOVERY_SETTINGS.minimumEndorsementThreshold,
    followedFieldUris: raw.followedFieldUris ?? DEFAULT_DISCOVERY_SETTINGS.followedFieldUris,
    followingTabIncludesWorkFields:
      raw.followingTabIncludesWorkFields ??
      DEFAULT_DISCOVERY_SETTINGS.followingTabIncludesWorkFields,
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
