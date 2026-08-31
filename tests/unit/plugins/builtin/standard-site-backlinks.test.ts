/**
 * Tests for the standard.site backlinks plugin.
 *
 * @remarks
 * A `site.standard.document` names the work it describes by `site` + `path`.
 * Recovering the eprint from a path is the mapping several other references
 * resolve through — a `site.standard.graph.recommend` names a document, and a
 * Leaflet `standardSitePost` block embeds one — so it has to handle both the
 * current shape and the pre-revision one that documents already published
 * still carry.
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

import {
  StandardSiteBacklinksPlugin,
  eprintUriFromPath,
} from '../../../../src/plugins/builtin/standard-site-backlinks.js';

const EPRINT = 'at://did:plc:author/pub.chive.eprint.submission/abc123';
const PATH = `/eprints/${encodeURIComponent(EPRINT)}`;

describe('eprintUriFromPath', () => {
  it('recovers the eprint URI a Chive document encodes in its path', () => {
    expect(eprintUriFromPath(PATH)).toBe(EPRINT);
  });

  it('ignores a path that is not an eprint page', () => {
    expect(eprintUriFromPath('/blog/a-post')).toBeUndefined();
  });

  it('ignores the eprint prefix with nothing after it', () => {
    expect(eprintUriFromPath('/eprints/')).toBeUndefined();
  });

  it('ignores an absent path', () => {
    expect(eprintUriFromPath(undefined)).toBeUndefined();
  });

  it('treats a malformed encoding as "not about an eprint" rather than throwing', () => {
    // The path comes from another repository. A decode failure must not abort
    // processing the record.
    expect(eprintUriFromPath('/eprints/%E0%A4%A')).toBeUndefined();
  });
});

describe('StandardSiteBacklinksPlugin', () => {
  const plugin = new StandardSiteBacklinksPlugin();

  it('tracks the standard.site document collection', () => {
    expect(plugin.trackedCollection).toBe('site.standard.document');
  });

  describe('extractEprintRefs', () => {
    it('finds the eprint from a document path', () => {
      expect(plugin.extractEprintRefs({ title: 'A paper', path: PATH })).toEqual([EPRINT]);
    });

    it('finds the eprint from a legacy content.uri', () => {
      // Documents written before the schema was corrected carry the eprint
      // here and have no path. Dropping this branch would make every
      // already-published Chive document invisible.
      expect(plugin.extractEprintRefs({ title: 'A paper', content: { uri: EPRINT } })).toEqual([
        EPRINT,
      ]);
    });

    it('prefers the path when a document carries both', () => {
      const other = 'at://did:plc:other/pub.chive.eprint.submission/xyz';
      expect(plugin.extractEprintRefs({ path: PATH, content: { uri: other } })).toEqual([EPRINT]);
    });

    it('returns nothing for a document about something else', () => {
      expect(plugin.extractEprintRefs({ title: 'A blog post', path: '/posts/hello' })).toEqual([]);
    });

    it('returns nothing when a path names a non-eprint record', () => {
      const notAnEprint = 'at://did:plc:a/pub.chive.review.comment/xyz';
      expect(
        plugin.extractEprintRefs({ path: `/eprints/${encodeURIComponent(notAnEprint)}` })
      ).toEqual([]);
    });

    it('survives values that are not records', () => {
      for (const value of [null, undefined, 'a string', 3]) {
        expect(plugin.extractEprintRefs(value)).toEqual([]);
      }
    });
  });

  describe('extractContext', () => {
    const context = (record: unknown): string | undefined =>
      (plugin as unknown as { extractContext(r: unknown): string | undefined }).extractContext(
        record
      );

    it('uses the title', () => {
      expect(context({ title: 'A paper' })).toBe('A paper');
    });

    it('appends a description when there is one', () => {
      expect(context({ title: 'A paper', description: 'On scope' })).toBe('A paper: On scope');
    });

    it('truncates a long description', () => {
      const result = context({ title: 'A paper', description: 'x'.repeat(500) });
      expect(result?.length).toBeLessThanOrEqual('A paper: '.length + 200);
    });

    it('returns nothing for a document with no title', () => {
      expect(context({ path: PATH })).toBeUndefined();
    });
  });
});
