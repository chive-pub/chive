/**
 * Tests for observing foreign collections on the firehose.
 *
 * @remarks
 * Chive's backlink plugins subscribe to `firehose.<collection>` for other
 * applications' lexicons. `EventFilter` rejected every collection outside
 * `pub.chive.*` before the event processor ran, so five registered plugins were
 * subscribed to events that could not fire. These tests pin the admission rule
 * in both directions: the observed collections get through, and nothing else
 * foreign does.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { EventFilter } from '../../../../src/services/indexing/event-filter.js';
import {
  INDEXED_COLLECTIONS,
  OBSERVED_COLLECTIONS,
  OBSERVED_COLLECTIONS_HIGH_VOLUME,
  isObservedCollection,
} from '../../../../src/services/indexing/indexed-collections.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function filterWithObserved(highVolume = false) {
  return new EventFilter({
    observedCollections: [
      ...OBSERVED_COLLECTIONS,
      ...(highVolume ? OBSERVED_COLLECTIONS_HIGH_VOLUME : []),
    ],
    strictValidation: true,
  });
}

describe('observed collections', () => {
  describe('EventFilter admission', () => {
    it.each(OBSERVED_COLLECTIONS)('admits %s', (collection) => {
      expect(
        filterWithObserved().shouldProcess({ action: 'create', path: `${collection}/abc123` })
      ).toBe(true);
    });

    it('still admits Chive collections', () => {
      expect(
        filterWithObserved().shouldProcess({
          action: 'create',
          path: 'pub.chive.eprint.submission/abc123',
        })
      ).toBe(true);
    });

    it('still rejects a foreign collection nothing observes', () => {
      // The rule is an allow-list, not "anything non-Chive".
      expect(
        filterWithObserved().shouldProcess({ action: 'create', path: 'com.example.random/abc123' })
      ).toBe(false);
    });

    it('rejects every foreign collection when none are configured', () => {
      // The state that starved the plugins, kept as a regression.
      const bare = new EventFilter({ strictValidation: true });
      for (const collection of OBSERVED_COLLECTIONS) {
        expect(bare.shouldProcess({ action: 'create', path: `${collection}/abc123` })).toBe(false);
      }
    });

    it('does not admit the Bluesky timeline by default', () => {
      // app.bsky.feed.post is the whole network: millions of records a day
      // against Chive's thousands. Reading it is a capacity decision.
      expect(
        filterWithObserved().shouldProcess({ action: 'create', path: 'app.bsky.feed.post/abc123' })
      ).toBe(false);
    });

    it('admits the Bluesky timeline when the high-volume set is enabled', () => {
      expect(
        filterWithObserved(true).shouldProcess({
          action: 'create',
          path: 'app.bsky.feed.post/abc123',
        })
      ).toBe(true);
    });
  });

  describe('isObservedCollection', () => {
    it('reports the observed set', () => {
      expect(isObservedCollection('at.margin.note')).toBe(true);
    });

    it('excludes high-volume collections unless asked', () => {
      expect(isObservedCollection('app.bsky.feed.post')).toBe(false);
      expect(isObservedCollection('app.bsky.feed.post', true)).toBe(true);
    });

    it('does not report Chive collections as observed', () => {
      // Chive's own records go through the processor's switch with full service
      // access; they are not forwarded to the plugin bus.
      expect(isObservedCollection('pub.chive.eprint.submission')).toBe(false);
    });
  });

  describe('the two lists stay disjoint', () => {
    it('no collection is both indexed and observed', () => {
      // Indexed means Chive stores it; observed means Chive forwards it and
      // stores nothing. A collection in both would be indexed and emitted.
      const indexed = new Set<string>(INDEXED_COLLECTIONS);
      const overlap = OBSERVED_COLLECTIONS.filter((c) => indexed.has(c));
      expect(overlap).toEqual([]);
    });

    it('no observed collection is in the Chive namespace', () => {
      expect(OBSERVED_COLLECTIONS.filter((c) => c.startsWith('pub.chive.'))).toEqual([]);
    });
  });

  describe('NSID validation admits camelCase name segments', () => {
    // The filter's validator required every segment to be lowercase. An NSID is
    // a domain authority plus a name, and only the authority is a domain label;
    // the name segment is where camelCase lives. With strictValidation on —
    // which is what IndexingService sets — this dropped SEVEN of Chive's own
    // twenty indexed collections from the live firehose. User tags, related
    // works, entity links, collaboration acceptances and both proposal types
    // were never indexed from a firehose event.
    const strict = new EventFilter({ strictValidation: true });

    it.each(INDEXED_COLLECTIONS)('accepts %s', (collection) => {
      expect(strict.shouldProcess({ action: 'create', path: `${collection}/abc123` })).toBe(true);
    });

    it('accepts the camelCase NSIDs used across ATProto', () => {
      // Admitted via the observed set, so the only gate left is NSID validity —
      // otherwise these would be rejected for their namespace and the test
      // would prove nothing about camelCase.
      const nsids = ['com.atproto.repo.createRecord', 'app.bsky.feed.getTimeline'];
      const observing = new EventFilter({ observedCollections: nsids, strictValidation: true });
      for (const nsid of nsids) {
        expect(observing.shouldProcess({ action: 'create', path: `${nsid}/abc` })).toBe(true);
      }
    });

    it('still rejects a name segment with characters the spec forbids', () => {
      // `name = alpha *( alpha / number )`: no underscores or hyphens, and no
      // leading digit. Digits after the first letter are fine — `submission3`
      // is a valid NSID, so that case is not listed here.
      // Observed here too, so a rejection can only be the NSID rule.
      const nsids = [
        'pub.chive.eprint.user_tag',
        'pub.chive.eprint.2tag',
        'pub.chive.eprint.user-tag',
      ];
      const observing = new EventFilter({ observedCollections: nsids, strictValidation: true });
      for (const nsid of nsids) {
        expect(observing.shouldProcess({ action: 'create', path: `${nsid}/abc` })).toBe(false);
      }
    });

    it('still rejects uppercase in the domain authority', () => {
      // The authority is a domain name and stays lowercase.
      const observing = new EventFilter({
        observedCollections: ['pub.Chive.eprint.submission'],
        strictValidation: true,
      });
      expect(
        observing.shouldProcess({ action: 'create', path: 'pub.Chive.eprint.submission/abc' })
      ).toBe(false);
    });

    it('still rejects a collection with too few segments', () => {
      expect(strict.shouldProcess({ action: 'create', path: 'pub.chive/abc' })).toBe(false);
    });
  });

  describe('every observed collection has a plugin that consumes it', () => {
    it('matches a trackedCollection or firehose subscription in src/plugins/builtin', () => {
      // A collection admitted with no subscriber is filter work for nothing,
      // and makes the list look like it does more than it does.
      const dir = join(REPO_ROOT, 'src', 'plugins', 'builtin');
      const sources = readdirSync(dir)
        .filter((f) => f.endsWith('.ts'))
        .map((f) => readFileSync(join(dir, f), 'utf8'))
        .join('\n');

      const unconsumed = OBSERVED_COLLECTIONS.filter((c) => !sources.includes(c));
      expect(unconsumed).toEqual([]);
    });
  });
});
