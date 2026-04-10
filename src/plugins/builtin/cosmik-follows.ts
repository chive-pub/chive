/**
 * Cosmik follows tracking plugin.
 *
 * @remarks
 * Tracks `network.cosmik.follow` records from the firehose. Follow records
 * represent a user following another user (DID) or a collection (AT-URI).
 *
 * This plugin indexes follow relationships for:
 * - Collection follower counts (when subject is a collection AT-URI)
 * - User follow graphs (when subject is a DID)
 *
 * ATProto Compliance:
 * - All data indexed from firehose (rebuildable via replay)
 * - Tracks deletions to honor unfollows
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
 * Cosmik follow record structure.
 *
 * @internal
 */
interface CosmikFollow {
  $type: 'network.cosmik.follow';
  subject: string;
  createdAt: string;
}

/**
 * Cosmik follows tracking plugin.
 *
 * @public
 */
export class CosmikFollowsPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.cosmik-follows';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.cosmik-follows',
    name: 'Cosmik Follows',
    version: '0.5.2',
    description: 'Tracks follow relationships from Semble for collection follower counts',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.network.cosmik.follow'],
      storage: {
        maxSize: 5 * 1024 * 1024,
      },
    },
    entrypoint: 'cosmik-follows.js',
  };

  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);

    this.context.eventBus.on('firehose.network.cosmik.follow', (...args: readonly unknown[]) => {
      const record = args[0] as FirehoseRecord;
      void this.handleFirehoseRecord(record);
    });

    this.logger.info('Cosmik follows tracking initialized');
  }

  private handleFirehoseRecord(record: FirehoseRecord): void {
    try {
      if (record.deleted) {
        this.context.eventBus.emit('cosmik.follow.deleted', {
          uri: record.uri,
          did: record.did,
        });
        this.logger.debug('Follow deleted', { uri: record.uri });
      } else if (record.record) {
        const follow = record.record as unknown as CosmikFollow;
        const subjectType = follow.subject.startsWith('did:') ? 'user' : 'collection';

        this.context.eventBus.emit('cosmik.follow.created', {
          uri: record.uri,
          followerDid: record.did,
          subject: follow.subject,
          subjectType,
          createdAt: follow.createdAt,
        });

        this.logger.debug('Follow indexed', {
          uri: record.uri,
          followerDid: record.did,
          subject: follow.subject,
          subjectType,
        });
      }
    } catch (err) {
      this.logger.warn('Failed to process follow record', {
        error: (err as Error).message,
        uri: record.uri,
      });
    }
  }

  protected onInitialize(): Promise<void> {
    return Promise.resolve();
  }
}

export default CosmikFollowsPlugin;
