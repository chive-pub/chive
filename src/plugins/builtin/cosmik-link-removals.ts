/**
 * Cosmik collectionLinkRemoval tracking plugin.
 *
 * @remarks
 * Tracks `network.cosmik.collectionLinkRemoval` records from the firehose.
 * These are tombstone records created when a collection owner removes a
 * collaborator's link from their collection (since the owner cannot delete
 * records in another user's PDS).
 *
 * ATProto Compliance:
 * - All data indexed from firehose (rebuildable via replay)
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.5.2
 */

import type { CollectionService } from '../../services/collection/collection-service.js';
import type { AtUri, CID } from '../../types/atproto.js';
import type { IPluginContext, IPluginManifest } from '../../types/interfaces/plugin.interface.js';
import type { FirehoseRecord } from '../core/backlink-plugin.js';

import { BasePlugin } from './base-plugin.js';

/**
 * Cosmik collectionLinkRemoval record structure.
 *
 * @internal
 */
interface CosmikCollectionLinkRemoval {
  $type: 'network.cosmik.collectionLinkRemoval';
  collection: { uri: string; cid: string };
  removedLink: { uri: string; cid: string };
  removedAt: string;
}

/**
 * Cosmik link removals tracking plugin.
 *
 * @public
 */
export class CosmikLinkRemovalsPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.cosmik-link-removals';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.cosmik-link-removals',
    name: 'Cosmik Link Removals',
    version: '0.5.2',
    description: 'Tracks tombstone records for collaborative collection link removals',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.network.cosmik.collectionLinkRemoval'],
      storage: {
        maxSize: 5 * 1024 * 1024,
      },
    },
    entrypoint: 'cosmik-link-removals.js',
  };

  /**
   * Collection service, for marking the link the tombstone names.
   */
  private collectionService?: CollectionService;

  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);
    this.collectionService = context.config.collectionService as CollectionService | undefined;

    this.context.eventBus.on(
      'firehose.network.cosmik.collectionLinkRemoval',
      (...args: readonly unknown[]) => {
        const record = args[0] as FirehoseRecord;
        void this.handleFirehoseRecord(record);
      }
    );

    this.logger.info('Cosmik link removals tracking initialized');
  }

  private async handleFirehoseRecord(record: FirehoseRecord): Promise<void> {
    try {
      if (record.deleted) {
        // A deleted removal record means the link was re-added. The event
        // carries only the tombstone's own URI, so the link it had removed is
        // read back out of the index before the row goes.
        const removed = await this.collectionService?.deleteCosmikLinkRemoval(record.uri as AtUri);
        const linkUri = removed?.ok === true ? removed.value : null;
        if (linkUri) {
          await this.collectionService?.markCosmikCollectionLinkRemoved(linkUri, false);
        }

        this.context.eventBus.emit('cosmik.linkRemoval.reverted', {
          uri: record.uri,
          did: record.did,
        });
        this.logger.debug('Link removal tombstone deleted (re-added)', { uri: record.uri });
      } else if (record.record) {
        const removal = record.record as unknown as CosmikCollectionLinkRemoval;

        // Applied to the membership index and kept, not merely announced. This
        // plugin used to emit an event and stop, with nothing subscribed to it,
        // so a card removed from a collection stayed indexed as a member of it
        // and the tombstone table it was written for stayed empty.
        await this.collectionService?.indexCosmikLinkRemoval(
          {
            collectionUri: removal.collection.uri,
            removedLinkUri: removal.removedLink.uri,
            removedAt: removal.removedAt,
          },
          {
            uri: record.uri as AtUri,
            cid: (record.cid ?? '') as unknown as CID,
            indexedAt: record.timestamp,
            pdsUrl: '',
          }
        );
        await this.collectionService?.markCosmikCollectionLinkRemoved(
          removal.removedLink.uri,
          true
        );

        this.context.eventBus.emit('cosmik.linkRemoval.created', {
          uri: record.uri,
          ownerDid: record.did,
          collectionUri: removal.collection.uri,
          removedLinkUri: removal.removedLink.uri,
          removedAt: removal.removedAt,
        });

        this.logger.debug('Link removal tombstone indexed', {
          uri: record.uri,
          collectionUri: removal.collection.uri,
          removedLinkUri: removal.removedLink.uri,
        });
      }
    } catch (err) {
      this.logger.warn('Failed to process link removal record', {
        error: (err as Error).message,
        uri: record.uri,
      });
    }
  }

  protected onInitialize(): Promise<void> {
    return Promise.resolve();
  }
}

export default CosmikLinkRemovalsPlugin;
