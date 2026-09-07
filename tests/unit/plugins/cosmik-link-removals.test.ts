/**
 * Tests for the CosmikLinkRemovalsPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CosmikLinkRemovalsPlugin } from '@/plugins/builtin/cosmik-link-removals.js';
import type { FirehoseRecord } from '@/plugins/core/backlink-plugin.js';

describe('CosmikLinkRemovalsPlugin', () => {
  let plugin: CosmikLinkRemovalsPlugin;

  beforeEach(() => {
    plugin = new CosmikLinkRemovalsPlugin();
  });

  describe('metadata', () => {
    it('has correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.cosmik-link-removals');
    });

    it('declares correct firehose hook permission', () => {
      const hooks = plugin.manifest.permissions.hooks ?? [];
      expect(hooks).toContain('firehose.network.cosmik.collectionLinkRemoval');
    });

    it('has a valid version', () => {
      expect(plugin.manifest.version).toBe('0.5.2');
    });
  });

  describe('applying a removal', () => {
    // This plugin used to emit an event and stop, with nothing subscribed to
    // it: a card an owner removed stayed indexed as a member of the collection,
    // and the tombstone table the migration created for it stayed empty.
    const DID = 'did:plc:owner';
    const TOMBSTONE = `at://${DID}/network.cosmik.collectionLinkRemoval/3tomb`;
    const LINK = 'at://did:plc:other/network.cosmik.collectionLink/3link';
    const COLLECTION = `at://${DID}/network.cosmik.collection/3coll`;

    let service: {
      indexCosmikLinkRemoval: ReturnType<typeof vi.fn>;
      deleteCosmikLinkRemoval: ReturnType<typeof vi.fn>;
      markCosmikCollectionLinkRemoved: ReturnType<typeof vi.fn>;
    };
    let handlers: Map<string, (record: FirehoseRecord) => void>;

    beforeEach(async () => {
      service = {
        indexCosmikLinkRemoval: vi.fn().mockResolvedValue({ ok: true }),
        deleteCosmikLinkRemoval: vi.fn().mockResolvedValue({ ok: true, value: LINK }),
        markCosmikCollectionLinkRemoved: vi.fn().mockResolvedValue({ ok: true }),
      };
      handlers = new Map();
      await plugin.initialize({
        config: { collectionService: service },
        eventBus: {
          on: vi.fn((event: string, handler: (record: FirehoseRecord) => void) => {
            handlers.set(event, handler);
          }),
          emit: vi.fn(),
        },
        logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
      } as never);
    });

    const fire = async (record: Partial<FirehoseRecord>) => {
      handlers.get('firehose.network.cosmik.collectionLinkRemoval')?.({
        uri: TOMBSTONE,
        collection: 'network.cosmik.collectionLinkRemoval',
        did: DID,
        rkey: '3tomb',
        record: null,
        deleted: false,
        cid: 'bafy',
        timestamp: new Date('2026-09-07T00:00:00Z'),
        ...record,
      } as FirehoseRecord);
      // The bus handler is fire-and-forget.
      await vi.waitFor(() => {
        expect(
          service.markCosmikCollectionLinkRemoved.mock.calls.length +
            service.deleteCosmikLinkRemoval.mock.calls.length
        ).toBeGreaterThan(0);
      });
    };

    it('marks the membership removed, rather than only announcing it', async () => {
      await fire({
        record: {
          $type: 'network.cosmik.collectionLinkRemoval',
          collection: { uri: COLLECTION, cid: 'c' },
          removedLink: { uri: LINK, cid: 'l' },
          removedAt: '2026-09-07T00:00:00Z',
        },
      });
      expect(service.markCosmikCollectionLinkRemoved).toHaveBeenCalledWith(LINK, true);
    });

    it('keeps the tombstone, which is the only record of what it removed', async () => {
      // A deletion event carries only the tombstone's own URI, so without the
      // row there is no way to learn which link to restore.
      await fire({
        record: {
          $type: 'network.cosmik.collectionLinkRemoval',
          collection: { uri: COLLECTION, cid: 'c' },
          removedLink: { uri: LINK, cid: 'l' },
          removedAt: '2026-09-07T00:00:00Z',
        },
      });
      expect(service.indexCosmikLinkRemoval).toHaveBeenCalledWith(
        expect.objectContaining({ removedLinkUri: LINK, collectionUri: COLLECTION }),
        expect.objectContaining({ uri: TOMBSTONE })
      );
    });

    it('restores the membership when the owner deletes the tombstone', async () => {
      await fire({ deleted: true });
      expect(service.deleteCosmikLinkRemoval).toHaveBeenCalledWith(TOMBSTONE);
      expect(service.markCosmikCollectionLinkRemoved).toHaveBeenCalledWith(LINK, false);
    });

    it('restores nothing when the tombstone was never indexed', async () => {
      service.deleteCosmikLinkRemoval.mockResolvedValue({ ok: true, value: null });
      await fire({ deleted: true });
      expect(service.markCosmikCollectionLinkRemoved).not.toHaveBeenCalled();
    });
  });
});
