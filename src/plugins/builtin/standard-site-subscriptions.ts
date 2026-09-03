/**
 * Indexes standard.site subscriptions and recommendations.
 *
 * @remarks
 * Both records are written by a *reader* into their own repository:
 * `site.standard.graph.subscription` names a publication, and
 * `site.standard.graph.recommend` names a document. Neither is a reference to
 * an eprint, so neither is a backlink -- they are their own thing, and this
 * plugin indexes them directly rather than through the backlink machinery.
 *
 * A publication belongs to the repository holding it, so the DID in the
 * publication's AT-URI is the author being subscribed to. That is the whole of
 * the resolution required: no lookup, no AppView.
 *
 * @packageDocumentation
 */

import type { SubscriptionService } from '../../services/subscription/subscription-service.js';
import type { IPluginContext, IPluginManifest } from '../../types/interfaces/plugin.interface.js';

import { BasePlugin } from './base-plugin.js';

/**
 * The collections this plugin reads.
 */
const SUBSCRIPTION_COLLECTION = 'site.standard.graph.subscription';
const RECOMMEND_COLLECTION = 'site.standard.graph.recommend';

/**
 * A firehose record as the plugin bus delivers it.
 */
interface FirehoseRecord {
  readonly uri: string;
  readonly did: string;
  readonly collection: string;
  readonly record: Record<string, unknown> | null;
  readonly deleted: boolean;
}

/**
 * Extracts the repository DID from an AT-URI.
 *
 * @param uri - An AT-URI
 * @returns The DID, or null when the URI carries none
 */
function repoDidOf(uri: string): string | null {
  const match = /^at:\/\/(did:[^/]+)\//.exec(uri);
  return match?.[1] ?? null;
}

/**
 * Reads a datetime that a record may or may not carry.
 */
function dateOf(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Indexes the standard.site social graph.
 *
 * @public
 */
export class StandardSiteSubscriptionsPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.standard-site-subscriptions';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.standard-site-subscriptions',
    name: 'standard.site Subscriptions',
    version: '0.1.0',
    description: 'Indexes standard.site subscriptions and recommendations from the firehose',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: [
        `firehose.${SUBSCRIPTION_COLLECTION}`,
        `firehose.${RECOMMEND_COLLECTION}`,
        // Emitted below; the bus enforces emit permission from this list.
        'subscription.created',
        'subscription.deleted',
      ],
      storage: { maxSize: 1024 * 1024 },
    },
    entrypoint: 'standard-site-subscriptions.js',
  };

  private subscriptions?: SubscriptionService;

  protected override async onInitialize(): Promise<void> {
    this.subscriptions = (
      this.context as IPluginContext & { subscriptionService?: SubscriptionService }
    ).subscriptionService;

    if (!this.subscriptions) {
      this.logger.warn('Subscription service unavailable; standard.site graph will not be indexed');
      return;
    }

    this.context.eventBus.on(
      `firehose.${SUBSCRIPTION_COLLECTION}`,
      (...args: readonly unknown[]) => {
        void this.handleSubscription(args[0] as FirehoseRecord);
      }
    );
    this.context.eventBus.on(`firehose.${RECOMMEND_COLLECTION}`, (...args: readonly unknown[]) => {
      void this.handleRecommendation(args[0] as FirehoseRecord);
    });

    this.logger.info('Indexing the standard.site social graph', {
      collections: [SUBSCRIPTION_COLLECTION, RECOMMEND_COLLECTION],
    });

    await Promise.resolve();
  }

  /**
   * Handles one `site.standard.graph.subscription`.
   */
  async handleSubscription(event: FirehoseRecord): Promise<void> {
    if (!this.subscriptions) return;

    try {
      if (event.deleted) {
        await this.subscriptions.deleteSubscription(event.uri);
        return;
      }

      const publicationUri = event.record?.publication;
      if (typeof publicationUri !== 'string') return;

      const publicationDid = repoDidOf(publicationUri);
      // A publication belongs to the repository holding it, so a URI naming no
      // repository names no author, and there is nothing to attribute.
      if (!publicationDid) return;

      await this.subscriptions.recordSubscription({
        uri: event.uri,
        subscriberDid: event.did,
        publicationUri,
        publicationDid,
        createdAt: dateOf(event.record?.createdAt),
      });

      this.context.eventBus.emit('subscription.created', {
        subscriberDid: event.did,
        publicationDid,
      });
    } catch (err) {
      this.logger.warn('Failed to index subscription', {
        uri: event.uri,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Handles one `site.standard.graph.recommend`.
   *
   * @remarks
   * The record names a document rather than an eprint. Chive indexes the
   * documents its own eprints publish, so the eprint behind a recommended
   * document is resolved from the backlink already recorded for it -- and left
   * unresolved when the document belongs to someone else's site, which is a
   * recommendation Chive has no eprint for and should not invent one.
   */
  async handleRecommendation(event: FirehoseRecord): Promise<void> {
    if (!this.subscriptions) return;

    try {
      if (event.deleted) {
        await this.subscriptions.deleteRecommendation(event.uri);
        return;
      }

      const documentUri = event.record?.document;
      if (typeof documentUri !== 'string') return;

      await this.subscriptions.recordRecommendation({
        uri: event.uri,
        recommenderDid: event.did,
        documentUri,
        createdAt: dateOf(event.record?.createdAt),
      });
    } catch (err) {
      this.logger.warn('Failed to index recommendation', {
        uri: event.uri,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
