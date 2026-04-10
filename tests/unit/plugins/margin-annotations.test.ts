/**
 * Tests for the Margin annotations tracking plugins.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, beforeEach } from 'vitest';

import {
  MarginAnnotationsPlugin,
  MarginHighlightsPlugin,
  MarginBookmarksPlugin,
} from '@/plugins/builtin/margin-annotations.js';

describe('MarginAnnotationsPlugin', () => {
  let plugin: MarginAnnotationsPlugin;

  beforeEach(() => {
    plugin = new MarginAnnotationsPlugin();
  });

  describe('metadata', () => {
    it('has correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.margin-annotations');
    });

    it('tracks at.margin.annotation collection', () => {
      expect(plugin.trackedCollection).toBe('at.margin.annotation');
    });

    it('uses margin.annotation source type', () => {
      expect(plugin.sourceType).toBe('margin.annotation');
    });

    it('declares correct firehose hook permission', () => {
      const hooks = plugin.manifest.permissions.hooks ?? [];
      expect(hooks).toContain('firehose.at.margin.annotation');
    });
  });

  describe('extractEprintRefs', () => {
    it('extracts Chive eprint URL from target.source', () => {
      const record = {
        $type: 'at.margin.annotation',
        target: {
          source:
            'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fpub.chive.eprint.submission%2F123',
          sourceHash: 'abc123',
        },
        body: { value: 'Great paper!' },
        motivation: 'commenting',
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toContain('chive.pub/eprints/');
    });

    it('extracts eprint AT-URI from target.source', () => {
      const record = {
        $type: 'at.margin.annotation',
        target: {
          source: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        },
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
    });

    it('returns empty for non-Chive URLs', () => {
      const record = {
        $type: 'at.margin.annotation',
        target: {
          source: 'https://arxiv.org/abs/1234.5678',
          sourceHash: 'def456',
        },
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(0);
    });

    it('returns empty when target.source is missing', () => {
      const record = {
        $type: 'at.margin.annotation',
        target: {},
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(0);
    });
  });
});

describe('MarginHighlightsPlugin', () => {
  let plugin: MarginHighlightsPlugin;

  beforeEach(() => {
    plugin = new MarginHighlightsPlugin();
  });

  describe('metadata', () => {
    it('has correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.margin-highlights');
    });

    it('tracks at.margin.highlight collection', () => {
      expect(plugin.trackedCollection).toBe('at.margin.highlight');
    });

    it('uses margin.highlight source type', () => {
      expect(plugin.sourceType).toBe('margin.highlight');
    });
  });

  describe('extractEprintRefs', () => {
    it('extracts Chive URL from highlight target', () => {
      const record = {
        $type: 'at.margin.highlight',
        target: {
          source:
            'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fpub.chive.eprint.submission%2F123',
        },
        color: '#ffeb3b',
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
    });

    it('returns empty for non-Chive highlights', () => {
      const record = {
        $type: 'at.margin.highlight',
        target: { source: 'https://example.com/article' },
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(0);
    });
  });
});

describe('MarginBookmarksPlugin', () => {
  let plugin: MarginBookmarksPlugin;

  beforeEach(() => {
    plugin = new MarginBookmarksPlugin();
  });

  describe('metadata', () => {
    it('has correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.margin-bookmarks');
    });

    it('tracks at.margin.bookmark collection', () => {
      expect(plugin.trackedCollection).toBe('at.margin.bookmark');
    });

    it('uses margin.bookmark source type', () => {
      expect(plugin.sourceType).toBe('margin.bookmark');
    });
  });

  describe('extractEprintRefs', () => {
    it('extracts Chive URL from bookmark source', () => {
      const record = {
        $type: 'at.margin.bookmark',
        source:
          'https://chive.pub/eprints/at%3A%2F%2Fdid%3Aplc%3Aabc%2Fpub.chive.eprint.submission%2F123',
        sourceHash: 'abc123',
        title: 'Interesting Paper',
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
    });

    it('extracts eprint AT-URI from bookmark source', () => {
      const record = {
        $type: 'at.margin.bookmark',
        source: 'at://did:plc:abc/pub.chive.eprint.submission/123',
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(1);
    });

    it('returns empty for non-Chive bookmarks', () => {
      const record = {
        $type: 'at.margin.bookmark',
        source: 'https://arxiv.org/abs/1234.5678',
        createdAt: '2026-01-01T00:00:00Z',
      };
      const refs = plugin.extractEprintRefs(record);
      expect(refs).toHaveLength(0);
    });

    it('returns context from title', () => {
      const record = {
        $type: 'at.margin.bookmark',
        source: 'https://chive.pub/eprints/test',
        title: 'Great Paper on NLP',
        description: 'A comprehensive study',
        createdAt: '2026-01-01T00:00:00Z',
      };
      // Access protected method via plugin instance cast
      const context = (
        plugin as unknown as { extractContext: (r: unknown) => string | undefined }
      ).extractContext(record);
      expect(context).toBe('Great Paper on NLP');
    });
  });
});
