/**
 * Every observed foreign collection must have a plugin subscribed to it.
 *
 * @remarks
 * Reading a foreign collection takes three independent pieces: the collection
 * in the observed set, the event processor forwarding it to the plugin bus, and
 * a plugin loaded that subscribes to it. Miss the third and records arrive, are
 * forwarded, and nothing listens — silently, since the only symptom is an
 * absence of backlinks nobody is waiting for.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OBSERVED_COLLECTIONS } from '../../../src/services/indexing/indexed-collections.js';

const indexer = readFileSync(join(process.cwd(), 'src/indexer.ts'), 'utf8');

/**
 * The plugin file that handles each observed collection.
 *
 * A collection listed here with no entry is a collection Chive watches for no
 * reason.
 */
const HANDLED_BY: Record<string, string> = {
  'network.cosmik.card': 'cosmik-backlinks',
  'network.cosmik.collectionLinkRemoval': 'cosmik-link-removals',
  'network.cosmik.connection': 'cosmik-connections',
  'network.cosmik.follow': 'cosmik-follows',
  'at.margin.note': 'margin-annotations',
  'at.margin.reply': 'margin-annotations',
  'pub.leaflet.document': 'leaflet-backlinks',
  'pub.leaflet.comment': 'leaflet-backlinks',
  'site.standard.document': 'standard-site-backlinks',
  'site.standard.publication': 'standard-site-subscriptions',
  'site.standard.graph.subscription': 'standard-site-subscriptions',
  'site.standard.graph.recommend': 'standard-site-subscriptions',
  'community.lexicon.calendar.event': 'calendar-events',
};

describe('observed collections', () => {
  it.each([...OBSERVED_COLLECTIONS])('%s is named by a plugin', (collection) => {
    expect(HANDLED_BY).toHaveProperty(collection);
  });

  it('loads a plugin for every collection it observes', () => {
    const missing = [...OBSERVED_COLLECTIONS]
      .map((c) => HANDLED_BY[c])
      .filter((module): module is string => typeof module === 'string')
      .filter((module) => !indexer.includes(`builtin/${module}.js`));

    expect([...new Set(missing)]).toEqual([]);
  });

  it('loads each named plugin rather than only importing it', () => {
    // An import satisfies the compiler; `loadBuiltinPlugin` is what subscribes
    // it to the bus.
    for (const module of new Set(Object.values(HANDLED_BY))) {
      if (!indexer.includes(`builtin/${module}.js`)) continue;
      const imported = new RegExp(`import \\{([^}]*)\\} from '\\./plugins/builtin/${module}\\.js'`);
      const match = imported.exec(indexer);
      expect(match, `${module} is imported`).not.toBeNull();

      for (const name of (match?.[1] ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)) {
        expect(indexer, `${name} is loaded`).toContain(`new ${name}()`);
      }
    }
  });
});
