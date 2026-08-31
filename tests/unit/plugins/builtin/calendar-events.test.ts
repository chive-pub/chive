/**
 * Tests for the calendar event backlinks plugin.
 *
 * @remarks
 * A `community.lexicon.calendar.event` names associated URIs, and one of them
 * may be an eprint — a talk about that paper. The schema is vendored at
 * `lexicons/vendor/community/calendar/event.json`; these fixtures follow it.
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';

import {
  CalendarEventsPlugin,
  eventDate,
} from '../../../../src/plugins/builtin/calendar-events.js';

const EPRINT = 'at://did:plc:author/pub.chive.eprint.submission/abc123';

const plugin = new CalendarEventsPlugin();

const internals = plugin as unknown as {
  extractContext(record: unknown): string | undefined;
  shouldProcess(record: unknown): boolean;
};

describe('CalendarEventsPlugin', () => {
  it('tracks the community calendar collection', () => {
    expect(plugin.trackedCollection).toBe('community.lexicon.calendar.event');
  });

  describe('extractEprintRefs', () => {
    it('finds an eprint among the event URIs', () => {
      const event = {
        name: 'ATScience workshop',
        uris: [{ uri: 'https://example.org/schedule' }, { uri: EPRINT, name: 'The paper' }],
      };
      expect(plugin.extractEprintRefs(event)).toEqual([EPRINT]);
    });

    it('reports an eprint once when it is listed twice', () => {
      const event = { name: 'A talk', uris: [{ uri: EPRINT }, { uri: EPRINT }] };
      expect(plugin.extractEprintRefs(event)).toEqual([EPRINT]);
    });

    it('ignores URIs that are not eprints', () => {
      const event = {
        name: 'A talk',
        uris: [{ uri: 'https://example.org' }, { uri: 'at://did:plc:x/app.bsky.feed.post/1' }],
      };
      expect(plugin.extractEprintRefs(event)).toEqual([]);
    });

    it('survives an event with no URIs', () => {
      expect(plugin.extractEprintRefs({ name: 'A talk' })).toEqual([]);
    });

    it('survives a malformed URI entry', () => {
      expect(plugin.extractEprintRefs({ name: 'A talk', uris: [{}, { uri: null }] })).toEqual([]);
    });

    it('survives values that are not records', () => {
      for (const value of [null, undefined, 'a string', 5]) {
        expect(plugin.extractEprintRefs(value)).toEqual([]);
      }
    });
  });

  describe('shouldProcess', () => {
    it('records a scheduled event', () => {
      expect(internals.shouldProcess({ name: 'A talk', status: 'scheduled' })).toBe(true);
    });

    it('records an event with no status', () => {
      expect(internals.shouldProcess({ name: 'A talk' })).toBe(true);
    });

    it('skips a cancelled event', () => {
      // A cancelled talk is not evidence the paper was presented.
      expect(internals.shouldProcess({ name: 'A talk', status: 'cancelled' })).toBe(false);
    });

    it('skips a postponed event', () => {
      expect(internals.shouldProcess({ name: 'A talk', status: 'postponed' })).toBe(false);
    });

    it('handles the ref form of a status value', () => {
      // The lexicon expresses status as `#cancelled`.
      expect(
        internals.shouldProcess({
          name: 'A talk',
          status: 'community.lexicon.calendar.event#cancelled',
        })
      ).toBe(false);
    });
  });

  describe('extractContext', () => {
    it('names the event and its date', () => {
      expect(
        internals.extractContext({ name: 'ATScience workshop', startsAt: '2026-10-12T09:00:00Z' })
      ).toBe('ATScience workshop (12 October 2026)');
    });

    it('names the event alone when it has no date', () => {
      expect(internals.extractContext({ name: 'A reading group' })).toBe('A reading group');
    });

    it('returns nothing for an event with no name', () => {
      expect(internals.extractContext({ startsAt: '2026-10-12T09:00:00Z' })).toBeUndefined();
    });
  });
});

describe('eventDate', () => {
  it('formats a timestamp as a readable date', () => {
    expect(eventDate('2026-10-12T09:00:00Z')).toBe('12 October 2026');
  });

  it('uses UTC, so an evening event does not shift a day', () => {
    expect(eventDate('2026-10-12T23:30:00Z')).toBe('12 October 2026');
  });

  it('returns nothing for a malformed timestamp', () => {
    // The record comes from another repository; "Invalid Date" must not reach
    // a backlink's context string.
    expect(eventDate('not-a-date')).toBeUndefined();
  });

  it('returns nothing when there is no timestamp', () => {
    expect(eventDate(undefined)).toBeUndefined();
  });
});
