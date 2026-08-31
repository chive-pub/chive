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
  // The handler contract returns a Promise and every path here throws. Making
  // it synchronous would turn a rejected promise into a synchronous throw,
  // which the XRPC adapter and its callers do not expect.
  // eslint-disable-next-line @typescript-eslint/require-await
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

    // This used to call `startOperation` and return, running nothing. Each of
    // the six types has a dedicated endpoint that does the work — this one
    // recorded an operation that stayed pending forever, so an admin saw a
    // backfill start and never finish.
    //
    // Rather than duplicate five handlers' worth of service wiring here, it
    // says where the work lives. Nothing calls this endpoint today; if
    // something does, it now gets an actionable answer instead of a ghost
    // operation.
    const { type } = input;
    const dedicated: Record<(typeof VALID_TYPES)[number], string> = {
      pdsScan: 'pub.chive.admin.triggerPDSScan',
      freshnessScan: 'pub.chive.admin.triggerFreshnessScan',
      citationExtraction: 'pub.chive.admin.triggerCitationExtraction',
      fullReindex: 'pub.chive.admin.triggerFullReindex',
      governanceSync: 'pub.chive.admin.triggerGovernanceSync',
      didSync: 'pub.chive.admin.triggerDIDSync',
    };

    const endpoint = dedicated[type as (typeof VALID_TYPES)[number]];

    c.get('logger').info('Generic backfill trigger redirected to its dedicated endpoint', {
      type,
      endpoint,
      startedBy: user.did,
    });

    throw new ValidationError(
      `Use ${endpoint} to run a ${type} backfill. This endpoint records an operation without running one.`,
      'type'
    );
  },
};
