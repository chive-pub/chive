/**
 * Calendar event backlinks plugin.
 *
 * @remarks
 * A talk, a conference presentation or a reading group is an event, and the
 * community calendar lexicon (`community.lexicon.calendar.event`, used by
 * Smoke Signal among others) records one as an ATProto record with a list of
 * associated URIs.
 *
 * When one of those URIs is a Chive eprint, the event is a fact about that
 * paper: it was presented somewhere, on a date, by someone. Recording it as a
 * backlink is how "presented at…" becomes something Chive can show without an
 * author entering it a second time by hand.
 *
 * The schema is vendored at `lexicons/vendor/community/calendar/event.json`,
 * from the community lexicon repository.
 *
 * @packageDocumentation
 */

import type { BacklinkSourceType } from '../../types/interfaces/plugin.interface.js';
import type { IPluginManifest } from '../../types/interfaces/plugin.interface.js';
import { BacklinkTrackingPlugin } from '../core/backlink-plugin.js';

/**
 * A URI associated with an event.
 *
 * @internal
 */
interface CalendarEventUri {
  uri?: string;
  name?: string;
}

/**
 * `community.lexicon.calendar.event`, in the parts this plugin reads.
 *
 * @internal
 */
interface CalendarEvent {
  $type?: string;
  name?: string;
  description?: string;
  startsAt?: string;
  status?: string;
  uris?: CalendarEventUri[];
}

/**
 * Event statuses that mean the event is not happening.
 *
 * @remarks
 * The lexicon's status values. A cancelled talk is not evidence that a paper
 * was presented, so those events are skipped rather than recorded and then
 * explained away in the UI.
 */
const NOT_HAPPENING = new Set(['cancelled', 'postponed']);

/**
 * Tracks references to Chive eprints from community calendar events.
 *
 * @public
 */
export class CalendarEventsPlugin extends BacklinkTrackingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.calendar-events';

  /**
   * ATProto collection to track.
   */
  readonly trackedCollection = 'community.lexicon.calendar.event';

  /**
   * Backlink source type.
   */
  readonly sourceType: BacklinkSourceType = 'calendar.event';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.calendar-events',
    name: 'Calendar Event Backlinks',
    version: '0.1.0',
    description: 'Tracks talks and presentations that reference a Chive eprint',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: [
        'firehose.community.lexicon.calendar.event',
        // Emitted by BacklinkTrackingPlugin after a write; the bus enforces
        // emit permissions from this list, so an undeclared hook throws.
        'backlink.created',
        'backlink.deleted',
      ],
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    entrypoint: 'calendar-events.js',
  };

  /**
   * Extracts the eprints an event refers to.
   *
   * @param record - A `community.lexicon.calendar.event`
   * @returns Eprint AT-URIs the event links to, deduplicated
   *
   * @remarks
   * `uris` is typed as `format: uri`, which admits `at://` alongside `https://`
   * — so an event may name an eprint by its record URI directly.
   */
  extractEprintRefs(record: unknown): string[] {
    if (record === null || typeof record !== 'object') {
      return [];
    }

    const event = record as CalendarEvent;
    const refs = new Set<string>();

    for (const entry of event.uris ?? []) {
      // An event may list the paper by AT-URI or by its web address.
      const uri = this.toEprintUri(entry?.uri);
      if (uri) {
        refs.add(uri);
      }
    }

    return [...refs];
  }

  /**
   * Extracts context from an event.
   *
   * @param record - A `community.lexicon.calendar.event`
   * @returns The event name, with its date when there is one
   *
   * @remarks
   * The name and date are what make the backlink readable — "presented at the
   * ATScience workshop, 12 October 2026" rather than a bare link.
   */
  protected override extractContext(record: unknown): string | undefined {
    if (record === null || typeof record !== 'object') {
      return undefined;
    }
    const event = record as CalendarEvent;

    if (!event.name) {
      return undefined;
    }

    const date = eventDate(event.startsAt);
    return date ? `${event.name} (${date})` : event.name;
  }

  /**
   * Determines whether an event should be recorded.
   *
   * @param record - A `community.lexicon.calendar.event`
   * @returns True unless the event was cancelled or postponed
   */
  protected override shouldProcess(record: unknown): boolean {
    if (record === null || typeof record !== 'object') {
      return false;
    }
    const status = (record as CalendarEvent).status;
    if (typeof status !== 'string') {
      return true;
    }
    // The lexicon expresses status as a ref such as `#cancelled`; match on the
    // final segment so both forms are handled.
    return !NOT_HAPPENING.has(status.replace(/^.*#/, ''));
  }
}

/**
 * Formats an event's start date for display.
 *
 * @param startsAt - ISO timestamp from the event record
 * @returns A date such as `12 October 2026`, or undefined
 *
 * @remarks
 * A malformed timestamp from another repository yields undefined rather than
 * `Invalid Date` in a backlink's context string.
 *
 * @public
 */
export function eventDate(startsAt: string | undefined): string | undefined {
  if (!startsAt) {
    return undefined;
  }

  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default CalendarEventsPlugin;
