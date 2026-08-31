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
import type { BacklinkSourceType } from '../../../../types/interfaces/plugin.interface.js';
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

    // The lexicon types this as `(string & {})` for extensibility, so it is
    // narrowed to the canonical union here. This used to redeclare its own
    // copy of the list, which had drifted: it was missing the two cosmik
    // types and all three margin ones, and still named `leaflet.list`.
    type ServiceSourceType = BacklinkSourceType;

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
