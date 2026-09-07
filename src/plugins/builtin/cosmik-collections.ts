/**
 * Semble collection and membership tracking plugin.
 *
 * @remarks
 * Semble draws a card inside a collection, and the collection is where a reader
 * sees it: the card's own page is a route that currently renders "Card page --
 * coming soon!". So the collection a card belongs to is what places that card
 * on the service that published it, and membership is its own record. This
 * plugin indexes both halves:
 *
 * 1. `network.cosmik.collection` -- for the collection's name, so a card can
 *    say which collection it is in rather than only that it is in one.
 * 2. `network.cosmik.collectionLink` -- the edge between a card and a
 *    collection.
 *
 * Chive previously indexed neither, while indexing
 * `network.cosmik.collectionLinkRemoval`: it watched links being taken out of
 * collections it had never seen them put into.
 *
 * **ATProto Compliance:**
 * - All data sourced from firehose (rebuildable via replay)
 * - Tracks deletions to honor record removal
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 */

import type { CollectionService } from '../../services/collection/collection-service.js';
import type { AtUri, CID } from '../../types/atproto.js';
import type { IPluginContext, IPluginManifest } from '../../types/interfaces/plugin.interface.js';
import type { FirehoseRecord } from '../core/backlink-plugin.js';

import { BasePlugin } from './base-plugin.js';

/**
 * A Semble collection.
 *
 * @internal
 */
interface CosmikCollection {
  $type: 'network.cosmik.collection';
  name?: string;
  description?: string;
  accessType?: string;
  createdAt?: string;
}

/**
 * The record placing a card in a collection.
 *
 * @internal
 */
interface CosmikCollectionLink {
  $type: 'network.cosmik.collectionLink';
  card: { uri: string; cid: string };
  collection: { uri: string; cid: string };
  addedBy?: string;
  addedAt?: string;
}

/**
 * Semble collection and membership tracking plugin.
 *
 * @public
 */
export class CosmikCollectionsPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.cosmik-collections';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.cosmik-collections',
    name: 'Cosmik Collections',
    version: '0.23.0',
    description: 'Indexes Semble collections and the cards they hold',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.network.cosmik.collection', 'firehose.network.cosmik.collectionLink'],
      storage: {
        maxSize: 10 * 1024 * 1024,
      },
    },
    entrypoint: 'cosmik-collections.js',
  };

  private collectionService?: CollectionService;

  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);
    this.collectionService = context.config.collectionService as CollectionService | undefined;

    this.context.eventBus.on(
      'firehose.network.cosmik.collection',
      (...args: readonly unknown[]) => {
        void this.handleCollection(args[0] as FirehoseRecord);
      }
    );

    this.context.eventBus.on(
      'firehose.network.cosmik.collectionLink',
      (...args: readonly unknown[]) => {
        void this.handleLink(args[0] as FirehoseRecord);
      }
    );

    this.logger.info('Cosmik collection tracking initialized');
  }

  /**
   * Indexes a collection, or forgets one that was deleted.
   *
   * @param record - Firehose record
   */
  async handleCollection(record: FirehoseRecord): Promise<void> {
    if (!this.collectionService) return;

    try {
      if (record.deleted) {
        await this.collectionService.deleteCosmikCollection(record.uri as AtUri);
        return;
      }
      if (!record.record) return;

      const collection = record.record as unknown as CosmikCollection;
      await this.collectionService.indexCosmikCollection(
        {
          name: collection.name,
          description: collection.description,
          accessType: collection.accessType,
          createdAt: collection.createdAt,
        },
        {
          uri: record.uri as AtUri,
          cid: (record.cid ?? '') as unknown as CID,
          indexedAt: record.timestamp,
          pdsUrl: '',
        }
      );
    } catch (err) {
      this.logger.warn('Failed to process Cosmik collection', {
        error: (err as Error).message,
        uri: record.uri,
      });
    }
  }

  /**
   * Indexes a card's membership of a collection, or forgets one withdrawn.
   *
   * @param record - Firehose record
   *
   * @remarks
   * A deletion here is the link's *author* withdrawing it. Removal by the
   * collection's owner is a separate tombstone record, handled by the link
   * removals plugin, because an owner cannot delete a record in someone else's
   * repository.
   */
  async handleLink(record: FirehoseRecord): Promise<void> {
    if (!this.collectionService) return;

    try {
      if (record.deleted) {
        await this.collectionService.deleteCosmikCollectionLink(record.uri as AtUri);
        return;
      }
      if (!record.record) return;

      const link = record.record as unknown as CosmikCollectionLink;
      // Both references are required by the lexicon, but this is another
      // service's record arriving over a public firehose, so it is checked
      // rather than assumed.
      if (!link.card?.uri || !link.collection?.uri) {
        this.logger.debug('Cosmik collection link names no card or no collection', {
          uri: record.uri,
        });
        return;
      }

      await this.collectionService.indexCosmikCollectionLink(
        {
          cardUri: link.card.uri,
          collectionUri: link.collection.uri,
          addedBy: link.addedBy,
          addedAt: link.addedAt,
        },
        {
          uri: record.uri as AtUri,
          cid: (record.cid ?? '') as unknown as CID,
          indexedAt: record.timestamp,
          pdsUrl: '',
        }
      );
    } catch (err) {
      this.logger.warn('Failed to process Cosmik collection link', {
        error: (err as Error).message,
        uri: record.uri,
      });
    }
  }

  protected onInitialize(): Promise<void> {
    return Promise.resolve();
  }
}

export default CosmikCollectionsPlugin;
