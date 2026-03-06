/**
 * XRPC handler for pub.chive.admin.triggerBackfill.
 *
 * @remarks
 * Generic handler for triggering any supported backfill operation type.
 * Requires admin authentication. The operation type must be one of the
 * supported BackfillOperationType values.
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

interface TriggerBackfillInput {
  readonly type: string;
  readonly [key: string]: unknown;
}

const VALID_TYPES = [
  'pdsScan',
  'freshnessScan',
  'citationExtraction',
  'fullReindex',
  'governanceSync',
  'didSync',
] as const;

export const triggerBackfill: XRPCMethod<void, TriggerBackfillInput, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input?.type) {
      throw new ValidationError('Backfill type is required', 'type', 'required');
    }

    if (!VALID_TYPES.includes(input.type as (typeof VALID_TYPES)[number])) {
      throw new ValidationError(`Invalid backfill type: ${input.type}`, 'type', 'enum');
    }

    const backfillManager = c.get('services').backfillManager;
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }

    const { type, ...metadata } = input;
    const { operation } = await backfillManager.startOperation(
      type as (typeof VALID_TYPES)[number],
      { ...metadata, startedBy: user.did }
    );

    const logger = c.get('logger');
    logger.info('Backfill triggered via admin dashboard', {
      type,
      operationId: operation.id,
      startedBy: user.did,
    });

    return { encoding: 'application/json', body: { operation } };
  },
};
