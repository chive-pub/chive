/**
 * Tests for Semble collection and membership indexing.
 *
 * @remarks
 * The gap these exist for: Chive indexed `network.cosmik.collectionLinkRemoval`
 * -- the tombstone an owner writes when removing a collaborator's link -- while
 * indexing neither the collections nor the links themselves. It watched cards
 * being taken out of collections it had never seen them put into, and a Semble
 * card on an eprint page had nowhere to link, because Semble renders a card
 * only inside a collection and publishes no address for the card itself.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CosmikCollectionsPlugin } from '@/plugins/builtin/cosmik-collections.js';
import type { FirehoseRecord } from '@/plugins/core/backlink-plugin.js';

const DID = 'did:plc:abc';
const CARD = `at://${DID}/network.cosmik.card/3card`;
const COLLECTION = `at://${DID}/network.cosmik.collection/3coll`;
const LINK = `at://${DID}/network.cosmik.collectionLink/3link`;

function collectionService() {
  return {
    indexCosmikCollection: vi.fn().mockResolvedValue({ ok: true }),
    deleteCosmikCollection: vi.fn().mockResolvedValue({ ok: true }),
    indexCosmikCollectionLink: vi.fn().mockResolvedValue({ ok: true }),
    deleteCosmikCollectionLink: vi.fn().mockResolvedValue({ ok: true }),
    markCosmikCollectionLinkRemoved: vi.fn().mockResolvedValue({ ok: true }),
  };
}

function firehose(overrides: Partial<FirehoseRecord>): FirehoseRecord {
  return {
    uri: LINK,
    collection: 'network.cosmik.collectionLink',
    did: DID,
    rkey: '3link',
    record: null,
    deleted: false,
    cid: 'bafy',
    timestamp: new Date('2026-09-07T00:00:00Z'),
    ...overrides,
  };
}

describe('CosmikCollectionsPlugin', () => {
  let plugin: CosmikCollectionsPlugin;
  let service: ReturnType<typeof collectionService>;

  beforeEach(async () => {
    plugin = new CosmikCollectionsPlugin();
    service = collectionService();
    await plugin.initialize({
      config: { collectionService: service },
      eventBus: { on: vi.fn(), emit: vi.fn() },
      logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    } as never);
  });

  describe('metadata', () => {
    it('declares both firehose hooks it subscribes to', () => {
      // The bus enforces emit and subscribe permissions from this list, so an
      // undeclared hook is a plugin that silently receives nothing.
      const hooks = plugin.manifest.permissions.hooks ?? [];
      expect(hooks).toContain('firehose.network.cosmik.collection');
      expect(hooks).toContain('firehose.network.cosmik.collectionLink');
    });
  });

  describe('collections', () => {
    it('indexes a collection for its name', async () => {
      await plugin.handleCollection(
        firehose({
          uri: COLLECTION,
          collection: 'network.cosmik.collection',
          record: { $type: 'network.cosmik.collection', name: 'On attention' },
        })
      );
      expect(service.indexCosmikCollection).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'On attention' }),
        expect.objectContaining({ uri: COLLECTION })
      );
    });

    it('indexes a collection that references no eprint', async () => {
      // The collection a citing card sits in is usually about something else
      // entirely, and it is still the page that card is opened at.
      await plugin.handleCollection(
        firehose({
          uri: COLLECTION,
          record: { $type: 'network.cosmik.collection', name: 'Patch theory' },
        })
      );
      expect(service.indexCosmikCollection).toHaveBeenCalled();
    });

    it('forgets a deleted collection', async () => {
      await plugin.handleCollection(firehose({ uri: COLLECTION, deleted: true }));
      expect(service.deleteCosmikCollection).toHaveBeenCalledWith(COLLECTION);
    });
  });

  describe('membership', () => {
    const link = {
      $type: 'network.cosmik.collectionLink',
      card: { uri: CARD, cid: 'bafycard' },
      collection: { uri: COLLECTION, cid: 'bafycoll' },
      addedBy: DID,
      addedAt: '2026-09-07T00:00:00Z',
    };

    it('records which collection a card is in', async () => {
      await plugin.handleLink(firehose({ record: link }));
      expect(service.indexCosmikCollectionLink).toHaveBeenCalledWith(
        expect.objectContaining({ cardUri: CARD, collectionUri: COLLECTION }),
        expect.objectContaining({ uri: LINK })
      );
    });

    it('forgets a link its author withdrew', async () => {
      // Distinct from a removal by the collection's owner, who cannot delete a
      // record in someone else's repository and writes a tombstone instead.
      await plugin.handleLink(firehose({ deleted: true }));
      expect(service.deleteCosmikCollectionLink).toHaveBeenCalledWith(LINK);
    });

    it('ignores a link that names no card', async () => {
      // Another service's record arriving over a public firehose, so the
      // lexicon's own required fields are checked rather than assumed.
      await plugin.handleLink(
        firehose({
          record: { $type: 'network.cosmik.collectionLink', collection: { uri: COLLECTION } },
        })
      );
      expect(service.indexCosmikCollectionLink).not.toHaveBeenCalled();
    });

    it('ignores a link that names no collection', async () => {
      await plugin.handleLink(
        firehose({ record: { $type: 'network.cosmik.collectionLink', card: { uri: CARD } } })
      );
      expect(service.indexCosmikCollectionLink).not.toHaveBeenCalled();
    });

    it('does not throw when a record cannot be processed', async () => {
      service.indexCosmikCollectionLink.mockRejectedValue(new Error('database down'));
      await expect(plugin.handleLink(firehose({ record: link }))).resolves.toBeUndefined();
    });
  });
});
