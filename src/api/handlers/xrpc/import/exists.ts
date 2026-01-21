/**
 * Handler for pub.chive.import.exists.
 *
 * @remarks
 * Checks if an eprint has been imported.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/import/exists.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Check if an eprint has been imported.
 *
 * @public
 */
export const exists: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { import: importService } = c.get('services');

    logger.debug('Checking import exists', {
      source: params.source,
      externalId: params.externalId,
    });

    const existsResult = await importService.exists(params.source, params.externalId);

    return {
      encoding: 'application/json',
      body: { exists: existsResult },
    };
  },
};
