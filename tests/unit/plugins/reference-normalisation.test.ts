/**
 * Every backlink plugin must record an eprint by its AT-URI.
 *
 * @remarks
 * A reference arrives written the way the source writes it. A Cosmik card is a
 * link card and a Margin annotation targets a page, so both hold a web address
 * rather than a record identifier. Stored as written, the backlink is filed
 * under a string no eprint can be looked up by: the row is created, no error is
 * raised, and it points at nothing.
 *
 * This is the shape that hid in the Leaflet plugin until each reference form was
 * tested separately, so it is checked here for every plugin that reads a field
 * capable of holding a URL.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { CalendarEventsPlugin } from '@/plugins/builtin/calendar-events.js';
import { CosmikBacklinksPlugin } from '@/plugins/builtin/cosmik-backlinks.js';
import { MarginNotesPlugin } from '@/plugins/builtin/margin-annotations.js';

const EPRINT = 'at://did:plc:34mbm5v3umztwvvgnttvcz6e/pub.chive.eprint.submission/3mufmczuces2j';
const WEB = `https://chive.pub/eprints/${encodeURIComponent(EPRINT)}`;

describe('reference normalisation', () => {
  it('resolves a Cosmik card pointing at an eprint page', () => {
    const plugin = new CosmikBacklinksPlugin();

    expect(plugin.extractEprintRefs({ url: WEB })).toEqual([EPRINT]);
  });

  it('records a Cosmik card once when both url fields name the same eprint', () => {
    const plugin = new CosmikBacklinksPlugin();

    expect(plugin.extractEprintRefs({ url: WEB, content: { url: EPRINT } })).toEqual([EPRINT]);
  });

  it('resolves a Margin annotation targeting an eprint page', () => {
    const plugin = new MarginNotesPlugin();

    expect(plugin.extractEprintRefs({ target: { source: WEB } })).toEqual([EPRINT]);
  });

  it('resolves a calendar event listing an eprint by address', () => {
    const plugin = new CalendarEventsPlugin();

    expect(plugin.extractEprintRefs({ uris: [{ uri: WEB }] })).toEqual([EPRINT]);
  });

  it('ignores a Cosmik card pointing somewhere else', () => {
    const plugin = new CosmikBacklinksPlugin();

    expect(plugin.extractEprintRefs({ url: 'https://example.org/paper' })).toEqual([]);
  });

  it('ignores a Margin annotation on a non-eprint chive page', () => {
    const plugin = new MarginNotesPlugin();

    expect(plugin.extractEprintRefs({ target: { source: 'https://chive.pub/about' } })).toEqual([]);
  });
});
