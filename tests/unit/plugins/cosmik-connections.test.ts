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
});
