/**
 * XRPC handler for pub.chive.admin.getTrendingVelocity.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface TrendingParams {
  readonly limit?: number;
  readonly window?: string;
}

interface EnrichedVelocityEntry {
  readonly uri: string;
  readonly title: string;
  readonly velocity: number;
  readonly views: number;
  readonly downloads: number;
  readonly trend: 'rising' | 'stable' | 'falling';
}

export const getTrendingVelocity: XRPCMethod<TrendingParams, void, unknown> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const metricsService = c.get('services').metrics;
    const eprintService = c.get('services').eprint;
    const window = (params.window ?? '24h') as '24h' | '7d' | '30d';
    const limit = params.limit ?? 20;

    const trending = await metricsService.getTrending(window, limit).catch(() => []);

    // Enrich with titles and metrics from the eprints index
    const items: EnrichedVelocityEntry[] = [];

    for (const entry of trending) {
      let title: string = entry.uri;
      let views = entry.score;
      let downloads = 0;

      try {
        const eprint = await eprintService.getEprint(entry.uri);
        if (eprint) {
          title = eprint.title ?? entry.uri;
        }
      } catch {
        // Fall back to URI as title
      }

      try {
        const metrics = await metricsService.getMetrics(entry.uri);
        views = metrics.totalViews;
        downloads = metrics.totalDownloads;
      } catch {
        // Fall back to score as views
      }

      const velocity = entry.velocity ?? 0;
      const trend: 'rising' | 'stable' | 'falling' =
        velocity > 0.1 ? 'rising' : velocity < -0.1 ? 'falling' : 'stable';

      items.push({
        uri: entry.uri,
        title,
        velocity: Math.round(velocity * 1000) / 1000,
        views,
        downloads,
        trend,
      });
    }

    return { encoding: 'application/json', body: { items } };
  },
};
