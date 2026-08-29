/**
 * XRPC handler for pub.chive.eprint.listDataLinks.
 *
 * @remarks
 * Federates to the Layers AppView rather than reading a Chive index. See
 * {@link LayersDataLinkService} for why: each AppView stays authoritative for
 * its own records, and Chive's view cannot drift from Layers'.
 *
 * This is deliberately a separate endpoint rather than a field on
 * `getSubmission`. Folding it in would put an eprint page's render behind
 * another service's availability; as a separate call the page renders first and
 * the panel fills in, or does not.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/listDataLinks.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters for pub.chive.eprint.listDataLinks. */
export type ListDataLinksParams = QueryParams;

/** Re-exported output schema for pub.chive.eprint.listDataLinks. */
export type ListDataLinksOutput = OutputSchema;

/**
 * XRPC method for pub.chive.eprint.listDataLinks query.
 *
 * @public
 */
export const listDataLinks: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { layersDataLinks } = c.get('services');

    if (!params.eprintUri) {
      throw new ValidationError('Missing required parameter: eprintUri', 'eprintUri');
    }

    if (!layersDataLinks) {
      // Not configured is not an error: an instance that does not federate to
      // Layers simply has nothing to show, and says so in the same shape.
      logger.debug('Layers federation is not configured');
      return {
        encoding: 'application/json',
        body: { dataLinks: [], source: 'unavailable' },
      };
    }

    const result = await layersDataLinks.listForEprint(params.eprintUri);

    logger.debug('Listed Layers data links', {
      eprintUri: params.eprintUri,
      count: result.dataLinks.length,
      source: result.source,
    });

    return {
      encoding: 'application/json',
      body: { dataLinks: result.dataLinks, source: result.source },
    };
  },
};
