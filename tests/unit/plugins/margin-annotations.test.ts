/**
 * Tests for the Margin notes tracking plugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, beforeEach } from 'vitest';

import { MarginNotesPlugin } from '@/plugins/builtin/margin-annotations.js';

describe('MarginNotesPlugin', () => {
  let plugin: MarginNotesPlugin;

  beforeEach(() => {
    plugin = new MarginNotesPlugin();
  });

  describe('metadata', () => {
    it('has correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.margin-notes');
    });

    it('tracks at.margin.note collection', () => {
      expect(plugin.trackedCollection).toBe('at.margin.note');
    });

    it('uses margin.annotation source type by default', () => {
      expect(plugin.sourceType).toBe('margin.annotation');
    });

    it('declares correct firehose hook permission', () => {
      const hooks = plugin.manifest.permissions.hooks ?? [];
      expect(hooks).toContain('firehose.at.margin.note');
    });
  });

  describe('extractEprintRefs', () => {
    it('extracts a Chive eprint URL from target.source for a comment', () => {
      const record = {
        $type: 'at.margin.note',
        motivation: 'commenting',
        target: {
          source:
            'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fpub.chive.eprint.submission%2F123',
          sourceHash: 'abc123',
        },
        body: { value: 'Great paper!' },
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toContain('chive.pub/eprints/');
    });

    it('extracts a Chive AT-URI from target.source for a highlight', () => {
      const record = {
        $type: 'at.margin.note',
        motivation: 'highlighting',
        target: { source: 'at://did:plc:abc/pub.chive.eprint.submission/123' },
        color: '#ffeb3b',
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
    });

    it('extracts a Chive URL from target.source for a bookmark', () => {
      const record = {
        $type: 'at.margin.note',
        motivation: 'bookmarking',
        target: {
          source: 'https://chive.pub/eprints/test',
          title: 'Interesting Paper',
        },
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
    });

    it('returns empty for non-Chive URLs', () => {
      const record = {
        $type: 'at.margin.note',
        motivation: 'commenting',
        target: { source: 'https://arxiv.org/abs/1234.5678' },
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(plugin.extractEprintRefs(record)).toHaveLength(0);
    });

    it('returns empty when target.source is missing', () => {
      const record = {
        $type: 'at.margin.note',
        motivation: 'commenting',
        target: {},
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(plugin.extractEprintRefs(record)).toHaveLength(0);
    });
  });

  describe('extractContext', () => {
    it('combines motivation and body excerpt for a comment', () => {
      const record = {
        $type: 'at.margin.note',
        motivation: 'commenting',
        target: { source: 'https://chive.pub/eprints/test' },
        body: { value: 'Great paper on NLP and decoder transformers' },
        createdAt: '2026-01-01T00:00:00Z',
      };
      const context = (
        plugin as unknown as { extractContext: (r: unknown) => string | undefined }
      ).extractContext(record);
      expect(context).toContain('commenting');
      expect(context).toContain('Great paper');
    });

    it('includes color tag for a highlight', () => {
      const record = {
        $type: 'at.margin.note',
        motivation: 'highlighting',
        target: { source: 'https://chive.pub/eprints/test' },
        color: '#ffeb3b',
        createdAt: '2026-01-01T00:00:00Z',
      };
      const context = (
        plugin as unknown as { extractContext: (r: unknown) => string | undefined }
      ).extractContext(record);
      expect(context).toContain('highlighting');
      expect(context).toContain('#ffeb3b');
    });

    it('returns just the motivation for an empty bookmark', () => {
      const record = {
        $type: 'at.margin.note',
        motivation: 'bookmarking',
        target: { source: 'https://chive.pub/eprints/test' },
        createdAt: '2026-01-01T00:00:00Z',
      };
      const context = (
        plugin as unknown as { extractContext: (r: unknown) => string | undefined }
      ).extractContext(record);
      expect(context).toBe('bookmarking');
    });
  });
});
