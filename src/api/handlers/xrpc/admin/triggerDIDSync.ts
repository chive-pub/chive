/**
 * XRPC handler for pub.chive.admin.triggerDIDSync.
 *
 * @remarks
 * Triggers a sync for a specific DID by resolving the DID to its PDS
 * endpoint and scanning all Chive collections for that user. The actual
 * work runs in the background; the handler returns immediately with the
 * operation ID.
 *
 * @packageDocumentation
 * @public
 */

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type { DID } from '../../../../types/atproto.js';
import {
  AuthorizationError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface TriggerDIDSyncInput {
  readonly did: string;
}

export const triggerDIDSync: XRPCMethod<void, TriggerDIDSyncInput, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input?.did) {
      throw new ValidationError('DID is required', 'did', 'required');
    }

    const logger = c.get('logger');
    const { backfillManager, pdsScanner, pdsRegistry } = c.get('services');
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }
    if (!pdsScanner) {
      throw new ServiceUnavailableError('PDS scanner is not configured');
    }

    // `signal` was dropped here; see triggerGovernanceSync for the same fix.
    // A DID scan walks every collection in a repository, so cancelling it is
    // something an admin genuinely wants to be able to do.
    const { operation, signal } = await backfillManager.startOperation('didSync', {
      did: input.did,
    });

    logger.info('DID sync triggered', { operationId: operation.id, did: input.did });

    // One shared resolver rather than a hand-rolled fetch.
    //
    // This file and sync/indexRecord.ts each carried their own
    // `resolvePdsEndpoint`, fetching plc.directory directly with no cache, no
    // timeout and no did:web handling beyond a string replace, while
    // DIDResolver — built on @atproto/identity, cached in Redis — was already
    // used elsewhere for exactly this.
    const didResolver = new DIDResolver({ redis: c.get('redis'), logger });

    // Fire-and-forget: resolve DID to PDS and scan all collections for that user
    void (async () => {
      try {
        const pdsUrl = await didResolver.getPDSEndpoint(input.did as DID);
        if (!pdsUrl) {
          await backfillManager.failOperation(
            operation.id,
            `Could not resolve PDS endpoint for DID: ${input.did}`
          );
          return;
        }

        // Register PDS for future scanning (fire-and-forget)
        if (pdsRegistry) {
          pdsRegistry.registerPDS(pdsUrl, 'did_mention').catch(() => {
            // Ignore registration failures
          });
        }

        const recordsIndexed = await pdsScanner.scanDID(pdsUrl, input.did as DID);

        if (signal.aborted) {
          logger.info('DID sync was cancelled; not marking it complete', {
            operationId: operation.id,
            did: input.did,
          });
          return;
        }

        await backfillManager.completeOperation(operation.id, recordsIndexed);
      } catch (error) {
        await backfillManager.failOperation(
          operation.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    })();

    return {
      encoding: 'application/json',
      body: { operationId: operation.id, did: input.did, status: 'running' },
    };
  },
};
