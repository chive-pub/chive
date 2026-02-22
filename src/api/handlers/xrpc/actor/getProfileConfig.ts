/**
 * XRPC handler for pub.chive.actor.getProfileConfig.
 *
 * @remarks
 * Retrieves profile display configuration for a user. Queries the
 * profile_config table via the collection service (indexed from the firehose).
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Query parameters for pub.chive.actor.getProfileConfig.
 *
 * @public
 */
export interface GetProfileConfigParams {
  /** DID of the user whose profile config to retrieve. */
  did: string;
}

/**
 * Profile section in the API response.
 *
 * @public
 */
export interface ProfileSectionView {
  /** Section type identifier. */
  type: string;
  /** Whether this section is visible. */
  visible: boolean;
  /** Display order. */
  order: number;
  /** Section-specific configuration. */
  config?: Record<string, unknown>;
}

/**
 * Output schema for pub.chive.actor.getProfileConfig.
 *
 * @public
 */
export interface GetProfileConfigOutput {
  /** DID of the profile owner. */
  did: string;
  /** AT-URI of the profile config record. */
  uri?: string;
  /** Profile type (individual, lab, organization). */
  profileType: string;
  /** Ordered list of profile sections. */
  sections: ProfileSectionView[];
  /** AT-URI of the featured collection. */
  featuredCollectionUri?: string;
}

/**
 * XRPC method for pub.chive.actor.getProfileConfig query.
 *
 * @public
 */
export const getProfileConfig: XRPCMethod<GetProfileConfigParams, void, GetProfileConfigOutput> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<GetProfileConfigOutput>> => {
    const logger = c.get('logger');
    const { collection: collectionService } = c.get('services');

    if (!params.did) {
      throw new ValidationError('Missing required parameter: did', 'did');
    }

    logger.debug('Getting profile config', { did: params.did });

    if (!collectionService) {
      return {
        encoding: 'application/json',
        body: {
          did: params.did,
          profileType: 'individual',
          sections: [],
        },
      };
    }

    const config = await collectionService.getProfileConfig(params.did as DID);

    if (!config) {
      return {
        encoding: 'application/json',
        body: {
          did: params.did,
          profileType: 'individual',
          sections: [],
        },
      };
    }

    const response: GetProfileConfigOutput = {
      did: config.did as string,
      uri: config.uri as string,
      profileType: config.profileType,
      sections: config.sections.map((s) => ({
        type: s.type,
        visible: s.visible,
        order: s.order,
        config: s.config,
      })),
      featuredCollectionUri: config.featuredCollectionUri as string | undefined,
    };

    logger.info('Profile config retrieved', {
      did: params.did,
      profileType: response.profileType,
      sectionCount: response.sections.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
