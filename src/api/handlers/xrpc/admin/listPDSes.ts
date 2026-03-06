/**
 * XRPC handler for pub.chive.admin.listPDSes.
 *
 * @remarks
 * Returns registered PDS entries with status, record counts, and user counts
 * for the admin dashboard table.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const listPDSes: XRPCMethod<void, void, unknown> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }

    const entries = await admin.listPDSEntries();

    const total = entries.length;
    const healthy = entries.filter((e: { status?: string }) => e.status === 'active').length;
    const unhealthy = entries.filter((e: { status?: string }) => e.status === 'unreachable').length;
    const withRecords = entries.filter(
      (e: { recordCount?: number }) => (e.recordCount ?? 0) > 0
    ).length;

    return {
      encoding: 'application/json',
      body: { stats: { total, healthy, unhealthy, withRecords, items: entries } },
    };
  },
};
