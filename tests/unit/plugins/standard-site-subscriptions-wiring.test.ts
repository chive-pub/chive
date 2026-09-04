/**
 * The standard.site subscriptions plugin reads its service from the right place.
 *
 * @remarks
 * `loadBuiltinPlugin(plugin, services)` passes those services to the context
 * factory as `config`, so a plugin finds them at `context.config.x`, not at
 * `context.x`. Reading the wrong level left the service undefined, and
 * `onInitialize` returned at its guard before subscribing to anything — so the
 * plugin loaded, reported healthy, and silently indexed nothing. Three tables
 * sat empty in production for a release because of it.
 *
 * The mistake typechecked, because the old code asserted the property onto the
 * context with a cast rather than reading where it actually lives. So the test
 * that matters is behavioural: given a context shaped the way the loader really
 * shapes one, does the plugin subscribe?
 *
 * @packageDocumentation
 */

import { describe, expect, it, vi } from 'vitest';

import { StandardSiteSubscriptionsPlugin } from '../../../src/plugins/builtin/standard-site-subscriptions.js';

function buildContext(config: Record<string, unknown>) {
  const handlers = new Map<string, (...args: readonly unknown[]) => void>();
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return {
    handlers,
    context: {
      config,
      logger,
      cache: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      metrics: { increment: vi.fn(), gauge: vi.fn(), histogram: vi.fn() },
      eventBus: {
        on: (event: string, handler: (...args: readonly unknown[]) => void) => {
          handlers.set(event, handler);
        },
        emit: vi.fn(),
      },
    } as never,
  };
}

describe('StandardSiteSubscriptionsPlugin wiring', () => {
  const subscriptionService = {
    recordSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    recordRecommendation: vi.fn(),
    deleteRecommendation: vi.fn(),
    recordPublication: vi.fn(),
    deletePublication: vi.fn(),
  };

  it('subscribes to all three firehose collections when loaded the way the loader loads it', async () => {
    const { context, handlers } = buildContext({ subscriptionService });
    const plugin = new StandardSiteSubscriptionsPlugin();

    await plugin.initialize(context);

    // These three are the whole point of the plugin. Before the fix none of
    // them was ever registered.
    expect(handlers.has('firehose.site.standard.graph.subscription')).toBe(true);
    expect(handlers.has('firehose.site.standard.graph.recommend')).toBe(true);
    expect(handlers.has('firehose.site.standard.publication')).toBe(true);
  });

  it('indexes a publication that arrives on the firehose', async () => {
    const { context, handlers } = buildContext({ subscriptionService });
    const plugin = new StandardSiteSubscriptionsPlugin();
    await plugin.initialize(context);

    const handler = handlers.get('firehose.site.standard.publication');
    expect(handler).toBeDefined();

    handler?.({
      uri: 'at://did:plc:author/site.standard.publication/abc',
      collection: 'site.standard.publication',
      did: 'did:plc:author',
      rkey: 'abc',
      record: { name: 'Papers', url: 'https://chive.pub/authors/did:plc:author' },
      deleted: false,
      cid: 'bafy',
      timestamp: new Date(),
    });

    await vi.waitFor(() => {
      expect(subscriptionService.recordPublication).toHaveBeenCalled();
    });
  });

  it('registers nothing when the service is genuinely absent', async () => {
    const { context, handlers } = buildContext({});
    const plugin = new StandardSiteSubscriptionsPlugin();

    await plugin.initialize(context);

    // The guard is correct behaviour; what was wrong was reaching it always.
    expect(handlers.size).toBe(0);
  });
});
