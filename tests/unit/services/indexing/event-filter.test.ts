/**
 * Unit tests for EventFilter.
 *
 * @remarks
 * Tests NSID filtering, validation, and collection matching.
 */

import { describe, it, expect } from 'vitest';

import { EventFilter } from '@/services/indexing/event-filter.js';
import type { NSID } from '@/types/atproto.js';

describe('EventFilter', () => {
  describe('shouldProcess', () => {
    it('accepts pub.chive.* collections by default', () => {
      const filter = new EventFilter();

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.chive.eprint.submission/abc123',
        })
      ).toBe(true);

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.chive.review.comment/xyz789',
        })
      ).toBe(true);

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.chive.graph.vote/def456',
        })
      ).toBe(true);
    });

    it('rejects non-pub.chive collections', () => {
      const filter = new EventFilter();

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'app.bsky.feed.post/abc123',
        })
      ).toBe(false);

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'com.atproto.repo.strongRef/xyz789',
        })
      ).toBe(false);

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'example.other.collection/def456',
        })
      ).toBe(false);
    });

    it('filters by specific collections when provided', () => {
      const filter = new EventFilter({
        collections: ['pub.chive.eprint.submission' as NSID, 'pub.chive.review.comment' as NSID],
      });

      // Allowed collections
      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.chive.eprint.submission/abc123',
        })
      ).toBe(true);

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.chive.review.comment/xyz789',
        })
      ).toBe(true);

      // Not in allowlist (but is pub.chive.*)
      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.chive.graph.vote/def456',
        })
      ).toBe(false);
    });

    it('handles empty path', () => {
      const filter = new EventFilter();

      expect(
        filter.shouldProcess({
          action: 'create',
          path: '',
        })
      ).toBe(false);
    });

    it('handles malformed path (no slash)', () => {
      const filter = new EventFilter();

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.chive.eprint.submission',
        })
      ).toBe(true); // No slash is fine (just checks collection part)
    });

    it('handles path with multiple slashes', () => {
      const filter = new EventFilter();

      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.chive.eprint.submission/abc123/extra',
        })
      ).toBe(true); // Only checks first part before first slash
    });
  });

  describe('extractCollection', () => {
    it('extracts collection from valid path', () => {
      const filter = new EventFilter();

      expect(filter.extractCollection('pub.chive.eprint.submission/abc123')).toBe(
        'pub.chive.eprint.submission'
      );

      expect(filter.extractCollection('pub.chive.review.comment/xyz789')).toBe(
        'pub.chive.review.comment'
      );
    });

    it('returns collection even without rkey', () => {
      const filter = new EventFilter();

      expect(filter.extractCollection('pub.chive.eprint.submission')).toBe(
        'pub.chive.eprint.submission'
      );
    });

    it('handles empty path', () => {
      const filter = new EventFilter();

      expect(filter.extractCollection('')).toBe('');
    });

    it('extracts only first segment before slash', () => {
      const filter = new EventFilter();

      expect(filter.extractCollection('pub.chive.eprint.submission/abc/def')).toBe(
        'pub.chive.eprint.submission'
      );
    });
  });

  describe('NSID validation', () => {
    describe('with strict validation enabled', () => {
      it('accepts valid NSIDs', () => {
        const filter = new EventFilter({ strictValidation: true });

        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive.eprint.submission/abc',
          })
        ).toBe(true);

        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'com.example.app.record/xyz',
          })
        ).toBe(false); // Rejected as non-pub.chive, not invalid NSID
      });

      it('rejects NSIDs that are too long', () => {
        const filter = new EventFilter({ strictValidation: true });

        // Create NSID > 253 characters
        const longNsid = 'pub.' + 'x'.repeat(250) + '.record';

        expect(
          filter.shouldProcess({
            action: 'create',
            path: `${longNsid}/abc`,
          })
        ).toBe(false);
      });

      it('rejects NSIDs with too few segments', () => {
        const filter = new EventFilter({ strictValidation: true });

        // Only 2 segments (need at least 3)
        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive/abc',
          })
        ).toBe(false);
      });

      it('rejects NSIDs with invalid characters', () => {
        const filter = new EventFilter({ strictValidation: true });

        // Uppercase not allowed
        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.Chive.eprint.submission/abc',
          })
        ).toBe(false);

        // Special characters not allowed
        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive!.eprint.submission/abc',
          })
        ).toBe(false);
      });

      it('rejects NSIDs with consecutive hyphens', () => {
        const filter = new EventFilter({ strictValidation: true });

        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive--.eprint.submission/abc',
          })
        ).toBe(false);
      });

      it('rejects NSIDs starting or ending with hyphens', () => {
        const filter = new EventFilter({ strictValidation: true });

        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.-chive.eprint.submission/abc',
          })
        ).toBe(false);

        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive-.eprint.submission/abc',
          })
        ).toBe(false);
      });

      it('accepts NSIDs with hyphens in segments after pub.chive', () => {
        const filter = new EventFilter({ strictValidation: true });

        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive.eprint-app.submission-type/abc',
          })
        ).toBe(true);
      });

      it('accepts NSIDs with digits in later segments', () => {
        const filter = new EventFilter({ strictValidation: true });

        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive.eprint2.submission3/abc',
          })
        ).toBe(true);
      });
    });

    describe('with strict validation disabled', () => {
      it('accepts pub.chive.* NSIDs even if they do not meet strict NSID requirements', () => {
        const filter = new EventFilter({ strictValidation: false });

        // Valid prefix but invalid NSID format (too few segments)
        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive.foo/abc',
          })
        ).toBe(true);

        // Valid prefix, invalid segment format in strict mode
        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.chive.UPPERCASE.record/abc',
          })
        ).toBe(true);
      });

      it('still rejects NSIDs that do not start with pub.chive.', () => {
        const filter = new EventFilter({ strictValidation: false });

        // Wrong prefix (case sensitive)
        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'pub.Chive.eprint.submission/abc',
          })
        ).toBe(false);

        // Wrong prefix entirely
        expect(
          filter.shouldProcess({
            action: 'create',
            path: 'app.bsky.feed.post/abc',
          })
        ).toBe(false);
      });
    });
  });

  describe('getCollectionFilter', () => {
    it('returns undefined when no collections specified', () => {
      const filter = new EventFilter();

      expect(filter.getCollectionFilter()).toBeUndefined();
    });

    it('returns set of collections when specified', () => {
      const collections = [
        'pub.chive.eprint.submission' as NSID,
        'pub.chive.review.comment' as NSID,
      ];

      const filter = new EventFilter({ collections });

      const filterSet = filter.getCollectionFilter();
      expect(filterSet).toBeDefined();
      expect(filterSet?.size).toBe(2);
      expect(filterSet?.has('pub.chive.eprint.submission' as NSID)).toBe(true);
      expect(filterSet?.has('pub.chive.review.comment' as NSID)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles delete operations', () => {
      const filter = new EventFilter();

      expect(
        filter.shouldProcess({
          action: 'delete',
          path: 'pub.chive.eprint.submission/abc123',
        })
      ).toBe(true);
    });

    it('handles update operations', () => {
      const filter = new EventFilter();

      expect(
        filter.shouldProcess({
          action: 'update',
          path: 'pub.chive.eprint.submission/abc123',
        })
      ).toBe(true);
    });

    it('is case-sensitive for collection prefix', () => {
      const filter = new EventFilter();

      // Uppercase P
      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'Pub.chive.eprint.submission/abc',
        })
      ).toBe(false);

      // Uppercase C
      expect(
        filter.shouldProcess({
          action: 'create',
          path: 'pub.Chive.eprint.submission/abc',
        })
      ).toBe(false);
    });
  });
});
