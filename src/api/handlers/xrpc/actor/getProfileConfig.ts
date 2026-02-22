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

import type {
  QueryParams,
  OutputSchema,
  ProfileSectionView,
} from '../../../../lexicons/generated/types/pub/chive/actor/getProfileConfig.js';
import type { DID } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters for pub.chive.actor.getProfileConfig. */
export type GetProfileConfigParams = QueryParams;

/** Re-exported profile section view type. */
export type { ProfileSectionView };

/** Re-exported output schema for pub.chive.actor.getProfileConfig. */
export type GetProfileConfigOutput = OutputSchema;

/**
 * XRPC method for pub.chive.actor.getProfileConfig query.
 *
 * @public
 */
export const getProfileConfig: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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

    const response: OutputSchema = {
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
