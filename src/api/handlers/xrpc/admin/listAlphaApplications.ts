/**
 * XRPC handler for pub.chive.admin.listAlphaApplications.
 *
 * @remarks
 * Lists alpha applications with optional status filter and cursor-based pagination.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type { DID } from '../../../../types/atproto.js';
import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface ListAlphaParams {
  readonly status?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export const listAlphaApplications: XRPCMethod<ListAlphaParams, void, unknown> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }
    const result = await admin.getAlphaApplications(
      params.status,
      params.limit ?? 50,
      params.cursor
    );

    // Resolve handles for applications that have no handle
    const logger = c.get('logger');
    const redis = c.get('redis');
    const didResolver = new DIDResolver({ redis, logger });

    const enriched = await Promise.all(
      result.items.map(async (app) => {
        if (app.handle) return app;
        try {
          const doc = await didResolver.resolveDID(app.did as DID);
          const handleEntry = doc?.alsoKnownAs?.find((aka: string) => aka.startsWith('at://'));
          const handle = handleEntry ? handleEntry.replace('at://', '') : null;
          return { ...app, handle };
        } catch {
          return app;
        }
      })
    );

    return { encoding: 'application/json', body: { ...result, items: enriched } };
  },
};
