/**
 * Unit tests for the collections the backlink plugins track.
 *
 * @remarks
 * These plugins subscribe to foreign lexicons, where a wrong NSID fails
 * silently: the plugin loads, subscribes to a collection nothing publishes, and
 * indexes nothing. There is no error to notice, so the collection each plugin
 * names is asserted here against what its service actually publishes.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const source = (name: string): string =>
  readFileSync(join(process.cwd(), 'src/plugins/builtin', `${name}.ts`), 'utf8');

describe('Leaflet backlink plugin', () => {
  const contents = source('leaflet-backlinks');

  // Leaflet's schemas are vendored under `lexicons/pub/leaflet/`, taken from
  // its own lexicon repository; the parser is written against them.
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
