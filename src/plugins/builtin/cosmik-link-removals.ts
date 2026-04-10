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

  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);

    this.context.eventBus.on(
      'firehose.network.cosmik.collectionLinkRemoval',
      (...args: readonly unknown[]) => {
        const record = args[0] as FirehoseRecord;
        void this.handleFirehoseRecord(record);
      }
    );

    this.logger.info('Cosmik link removals tracking initialized');
  }

  private handleFirehoseRecord(record: FirehoseRecord): void {
    try {
      if (record.deleted) {
        // A deleted removal record means the link was re-added
        this.context.eventBus.emit('cosmik.linkRemoval.reverted', {
          uri: record.uri,
          did: record.did,
        });
        this.logger.debug('Link removal tombstone deleted (re-added)', { uri: record.uri });
      } else if (record.record) {
        const removal = record.record as unknown as CosmikCollectionLinkRemoval;

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
