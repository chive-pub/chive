/**
 * XRPC handler for pub.chive.backlink.create.
 *
 * @remarks
 * Creates a backlink record. Internal/plugin use only.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/backlink/create.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.backlink.create.
 *
 * @public
 */
export const create: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { backlink } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new ValidationError('Request body is required', 'input', 'required');
    }

    logger.debug('Creating backlink', {
      sourceUri: input.sourceUri,
      sourceType: input.sourceType,
      targetUri: input.targetUri,
    });

    // Cast lexicon type to service type (lexicon uses (string & {}) for extensibility)
    type ServiceSourceType =
      | 'semble.collection'
      | 'leaflet.list'
      | 'whitewind.blog'
      | 'bluesky.post'
      | 'bluesky.embed'
      | 'other';

    const result = await backlink.createBacklink({
      sourceUri: input.sourceUri,
      sourceType: input.sourceType as ServiceSourceType,
      targetUri: input.targetUri,
      context: input.context,
    });

    const response: OutputSchema = {
      id: result.id,
      sourceUri: result.sourceUri,
      sourceType: result.sourceType,
      targetUri: result.targetUri,
      context: result.context,
      indexedAt: result.indexedAt.toISOString(),
      deleted: result.deleted,
    };

    return { encoding: 'application/json', body: response };
  },
};
