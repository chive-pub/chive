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

  // Kept pointing at the fictional NSID on purpose; see the file header.
  it('still tracks the fictional collection', () => {
    expect(contents).toMatch(/trackedCollection = 'xyz\.leaflet\.list'/);
  });

  it('says plainly that the collection does not exist', () => {
    expect(contents).toMatch(/does not exist/);
    expect(contents).toMatch(/pub\.leaflet\.document/);
  });
});
