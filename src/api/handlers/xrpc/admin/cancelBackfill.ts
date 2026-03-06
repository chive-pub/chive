/**
 * XRPC handler for pub.chive.admin.cancelBackfill.
 *
 * @packageDocumentation
 * @public
 */

import {
  AuthorizationError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface CancelBackfillInput {
  readonly id: string;
}

interface CancelBackfillOutput {
  readonly success: boolean;
  readonly id: string;
}

export const cancelBackfill: XRPCMethod<void, CancelBackfillInput, CancelBackfillOutput> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<CancelBackfillOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input?.id) {
      throw new ValidationError('Operation ID is required', 'id', 'required');
    }

    const backfillManager = c.get('services').backfillManager;
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }
    const cancelled = await backfillManager.cancelOperation(input.id);

    c.get('logger').info('Backfill cancellation requested', {
      operationId: input.id,
      cancelled,
    });

    return {
      encoding: 'application/json',
      body: { success: cancelled, id: input.id },
    };
  },
};
