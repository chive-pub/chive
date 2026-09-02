/**
 * Eprint references anywhere in a standard.site document.
 *
 * @remarks
 * `site.standard.document.content` is an open union: the schema does not
 * enumerate block types, and each publisher on the format brings its own. pckt
 * writes its posts as `site.standard.document` records whose content is
 * `blog.pckt.content` holding `blog.pckt.block.*` items, and other publishers
 * write other blocks.
 *
 * Reading only the fields Chive's own documents use meant a post that linked an
 * eprint in its prose produced no backlink, whoever wrote it.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { collectEprintRefs } from '../../../src/plugins/builtin/standard-site-backlinks.js';

const EPRINT = 'at://did:plc:aswhite123abc/pub.chive.eprint.submission/3jt7k9xyzab01';

describe('collectEprintRefs', () => {
  it('finds an AT-URI inside a pckt block', () => {
    // The shape is taken from a real pckt record: a site.standard.document
    // whose content is blog.pckt.content with blog.pckt.block.* items.
    const document = {
      $type: 'site.standard.document',
      title: "Blogging: It's more social than ever !",
      path: '/blogging-its-more-social-than-ever-p9q1fky',
      content: {
        $type: 'blog.pckt.content',
        items: [
          { $type: 'blog.pckt.block.heading', level: 3, plaintext: 'On a paper' },
          {
            $type: 'blog.pckt.block.text',
            plaintext: 'We loved this one',
            facets: [{ index: { byteStart: 0, byteEnd: 3 }, features: [{ uri: EPRINT }] }],
          },
        ],
      },
    };

    expect(collectEprintRefs(document)).toEqual([EPRINT]);
  });

  it('finds an eprint linked as a web page, normalised to its AT-URI', () => {
    // A blogger links the page, not the AT-URI. Keying the backlink on the URL
    // would file the same eprint under two identities.
    const document = {
      content: {
        items: [
          {
            $type: 'blog.pckt.block.website',
            src: `https://chive.pub/eprints/${encodeURIComponent(EPRINT)}`,
          },
        ],
      },
    };

    expect(collectEprintRefs(document)).toEqual([EPRINT]);
  });

  it('deduplicates an eprint referenced more than once', () => {
    const document = {
      content: {
        items: [
          { src: `https://chive.pub/eprints/${encodeURIComponent(EPRINT)}` },
          { facets: [{ features: [{ uri: EPRINT }] }] },
        ],
      },
    };

    expect(collectEprintRefs(document)).toEqual([EPRINT]);
  });

  it('ignores links that are not eprints', () => {
    const document = {
      content: {
        items: [
          { src: 'https://example.org/blog/post' },
          { facets: [{ features: [{ uri: 'at://did:plc:x/app.bsky.feed.post/abc' }] }] },
        ],
      },
    };

    expect(collectEprintRefs(document)).toEqual([]);
  });

  it('survives a malformed percent-encoding rather than throwing', () => {
    // The record comes from another repository; nothing guarantees it is sane.
    const document = { content: { items: [{ src: 'https://chive.pub/eprints/%E0%A4%A' }] } };
    expect(() => collectEprintRefs(document)).not.toThrow();
  });

  it('stops descending rather than following a deep structure forever', () => {
    let nested: Record<string, unknown> = { uri: EPRINT };
    for (let i = 0; i < 40; i++) nested = { child: nested };

    expect(() => collectEprintRefs(nested)).not.toThrow();
    // Beyond the limit the reference is simply not found, which is the safe
    // outcome for a record shaped to exhaust the walk.
    expect(collectEprintRefs(nested)).toEqual([]);
  });

  it('handles a document with no content at all', () => {
    expect(collectEprintRefs({ title: 'No body' })).toEqual([]);
    expect(collectEprintRefs(null)).toEqual([]);
  });
});
