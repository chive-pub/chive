/**
 * Tests for the CosmikConnectionsPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, beforeEach } from 'vitest';

import { CosmikConnectionsPlugin } from '@/plugins/builtin/cosmik-connections.js';

describe('CosmikConnectionsPlugin', () => {
  let plugin: CosmikConnectionsPlugin;

  beforeEach(() => {
    plugin = new CosmikConnectionsPlugin();
  });

  describe('metadata', () => {
    it('has correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.cosmik-connections');
    });

    it('tracks network.cosmik.connection collection', () => {
      expect(plugin.trackedCollection).toBe('network.cosmik.connection');
    });

    it('uses cosmik.connection source type', () => {
      expect(plugin.sourceType).toBe('cosmik.connection');
    });

    it('declares correct firehose hook permission', () => {
      const hooks = plugin.manifest.permissions.hooks ?? [];
      expect(hooks).toContain('firehose.network.cosmik.connection');
    });
  });

  describe('extractEprintRefs', () => {
    it('extracts eprint AT-URI from source field', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        target: 'https://example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toContain('at://did:plc:abc/pub.chive.eprint.submission/123');
    });

    it('extracts eprint AT-URI from target field', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source: 'https://example.com',
        target: 'at://did:plc:abc/pub.chive.eprint.submission/456',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toContain('at://did:plc:abc/pub.chive.eprint.submission/456');
    });

    it('extracts Chive web URL from source field', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source:
          'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fpub.chive.eprint.submission%2F123',
        target: 'https://example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
    });

    it('extracts refs from both source and target', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        target:
          'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Adef%2Fpub.chive.eprint.submission%2F456',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(2);
    });

    it('returns empty for non-Chive URLs', () => {
      const record = {
        $type: 'network.cosmik.connection',
        source: 'https://example.com/paper',
        target: 'https://arxiv.org/abs/1234',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(0);
    });
  });

  describe('extractRelatedUri', () => {
    // A connection is an edge between two entities. Chive stored the note and
    // the relation and dropped both endpoints, so an eprint page showed what
    // the author thought about a relationship without ever naming the other
    // half of it.
    const relatedUri = (record: unknown, targetUri: string): string | undefined =>
      (
        plugin as unknown as {
          extractRelatedUri(record: unknown, targetUri: string): string | undefined;
        }
      ).extractRelatedUri(record, targetUri);

    const A = 'at://did:plc:abc/pub.chive.eprint.submission/123';
    const B = 'at://did:plc:def/pub.chive.eprint.submission/456';
    const B_URL =
      'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Adef%2Fpub.chive.eprint.submission%2F456';

    it('returns the end that is not the paper being shown', () => {
      const record = { $type: 'network.cosmik.connection', source: A, target: B_URL };
      expect(relatedUri(record, A)).toBe(B);
    });

    it('gives each paper the other one when both ends are eprints', () => {
      // The record produces a row on both papers, and neither should be told
      // that it is connected to itself.
      const record = { $type: 'network.cosmik.connection', source: A, target: B_URL };
      expect(relatedUri(record, B)).toBe(A);
    });

    it('normalises a Chive web address to the AT-URI the index is keyed on', () => {
      // Left as written, the read path could not join the eprint index for a
      // title, and the card would show a percent-encoded URL.
      const record = { $type: 'network.cosmik.connection', source: B_URL, target: A };
      expect(relatedUri(record, A)).toBe(B);
    });

    it('leaves an end Chive knows nothing about as the address it was written as', () => {
      const doi = 'https://doi.org/10.1007/3-540-61780-9_66';
      const record = { $type: 'network.cosmik.connection', source: A, target: doi };
      expect(relatedUri(record, A)).toBe(doi);
    });

    it('returns nothing when the record names only this paper', () => {
      const record = { $type: 'network.cosmik.connection', source: A, target: A };
      expect(relatedUri(record, A)).toBeUndefined();
    });
  });
});
