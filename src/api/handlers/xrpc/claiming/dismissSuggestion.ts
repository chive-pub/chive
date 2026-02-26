/**
 * Handler for pub.chive.claiming.dismissSuggestion.
 *
 * @remarks
 * Dismisses a paper suggestion so it no longer appears in the user's
 * suggestions list. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface InputSchema {
  source: string;
  externalId: string;
}

interface OutputSchema {
  success: boolean;
}

/**
 * XRPC method for pub.chive.claiming.dismissSuggestion.
 *
 * @remarks
 * Records that the authenticated user does not want to see a particular
 * paper suggestion. The paper will be filtered out of future suggestions.
 *
 * @public
 */
export const dismissSuggestion: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  type: 'procedure',
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    if (!input) {
      throw new ValidationError('Input is required', 'input');
    }

    const logger = c.get('logger');
    const user = c.get('user');
    const { claiming } = c.get('services');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required to dismiss suggestions');
    }

    const { source, externalId } = input;

    if (!source || !externalId) {
      throw new ValidationError('Both source and externalId are required', 'input');
    }

    logger.debug('Dismissing suggestion', {
      did: user.did,
      source,
      externalId,
    });

    await claiming.dismissSuggestion(user.did, source, externalId);

    logger.info('Suggestion dismissed', {
      did: user.did,
      source,
      externalId,
    });

    return {
      encoding: 'application/json',
      body: { success: true },
    };
  },
};
