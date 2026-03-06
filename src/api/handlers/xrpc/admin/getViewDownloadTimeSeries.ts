/**
 * XRPC handler for pub.chive.admin.getViewDownloadTimeSeries.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface TimeSeriesParams {
  readonly uri?: string;
  readonly granularity?: string;
}

export const getViewDownloadTimeSeries: XRPCMethod<TimeSeriesParams, void, unknown> = {
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

    const result = await admin.getViewDownloadTimeSeries(params.uri, params.granularity);

    return {
      encoding: 'application/json',
      body: result,
    };
  },
};
