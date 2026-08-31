/**
 * Unit tests for the collections the backlink plugins track.
 *
 * @remarks
 * These plugins subscribe to foreign lexicons, and a wrong NSID fails silently:
 * the plugin loads, subscribes to a collection nothing publishes, and indexes
 * nothing. There is no error to notice.
 *
 * The WhiteWind plugin tracked `com.whitewind.blog.entry`. WhiteWind's actual
 * lexicon is `com.whtwnd.blog.entry` — the abbreviated spelling — so the plugin
 * could never have matched a real blog post.
 *
 * The Leaflet plugin tracks `xyz.leaflet.list`, which does not exist at all;
 * Leaflet publishes `pub.leaflet.document` and `pub.leaflet.comment`. That one
 * is deliberately left as it is: the plugin's record interface was invented to
 * match the fictional NSID, so repointing it at a real collection without
 * rewriting the parser would read real records against a schema they do not
 * have — wrong backlinks rather than none. This test records the state rather
 * than blessing it, so the next reader does not have to re-derive it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const source = (name: string): string =>
  readFileSync(join(process.cwd(), 'src/plugins/builtin', `${name}.ts`), 'utf8');

describe('WhiteWind backlink plugin', () => {
  const contents = source('whitewind-backlinks');

  it("tracks WhiteWind's real blog entry collection", () => {
    expect(contents).toMatch(/trackedCollection = 'com\.whtwnd\.blog\.entry'/);
  });

  it('no longer references the misspelled authority', () => {
    expect(contents).not.toMatch(/com\.whitewind/);
  });
});

describe('Leaflet backlink plugin', () => {
  const contents = source('leaflet-backlinks');

  // This used to assert the plugin still pointed at `xyz.leaflet.list`, an
  // NSID Leaflet does not publish, because pointing it at a real collection
  // while its parser expected an invented shape would have produced wrong
  // backlinks rather than none. The schemas are now vendored under
  // `lexicons/pub/leaflet/`, taken from Leaflet's own lexicon repository, and
  // the parser is written against them — so the reason for staying wrong is
  // gone, and these assert the collections Leaflet actually publishes.
  it('tracks pub.leaflet.document', () => {
    expect(contents).toMatch(/trackedCollection = 'pub\.leaflet\.document'/);
  });

  it('also subscribes to pub.leaflet.comment', () => {
    // A comment names its subject directly, which is the most reliable
    // reference of the four routes.
    expect(contents).toMatch(/firehose\.pub\.leaflet\.comment/);
  });

  it('no longer mentions the fictional collection except as history', () => {
    // One reference survives, in the header explaining what was wrong.
    const occurrences = contents.match(/xyz\.leaflet\.list/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});
