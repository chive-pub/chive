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

/**
 * Resolves a DID to its PDS endpoint via PLC directory.
 *
 * @param did - the DID to resolve
 * @returns the PDS URL, or null if resolution fails
 */
async function resolvePdsEndpoint(did: string): Promise<string | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const response = await fetch(`https://plc.directory/${did}`);
      if (!response.ok) return null;
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pds = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pds?.serviceEndpoint ?? null;
    }

    if (did.startsWith('did:web:')) {
      const domain = did.replace('did:web:', '').replace(/%3A/g, ':');
      const response = await fetch(`https://${domain}/.well-known/did.json`);
      if (!response.ok) return null;
      const doc = (await response.json()) as {
        service?: { id: string; type: string; serviceEndpoint: string }[];
      };
      const pds = doc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      return pds?.serviceEndpoint ?? null;
    }

    return null;
  } catch {
    return null;
  }
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

    const { operation } = await backfillManager.startOperation('didSync', { did: input.did });

    logger.info('DID sync triggered', { operationId: operation.id, did: input.did });

    // Fire-and-forget: resolve DID to PDS and scan all collections for that user
    void (async () => {
      try {
        const pdsUrl = await resolvePdsEndpoint(input.did);
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
