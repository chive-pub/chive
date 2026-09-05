/**
 * Tests for AT-URI and URL link resolution.
 *
 * @remarks
 * The two things worth holding this to are the two things that were wrong
 * before it existed: a link must never be built from Chive's `sourceType`
 * when the record's own collection disagrees with it, and a link must never be
 * offered on an application's domain unless that route was checked.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import {
  describeAtUri,
  describeUrl,
  parseAtUri,
  recordBrowserUrl,
  summarizeUrl,
} from './at-uri-links';

const DID = 'did:plc:34mbm5v3umztwvvgnttvcz6e';

describe('parseAtUri', () => {
  it('splits a record URI into its three parts', () => {
    expect(parseAtUri(`at://${DID}/pub.leaflet.document/3abc`)).toEqual({
      did: DID,
      collection: 'pub.leaflet.document',
      rkey: '3abc',
    });
  });

  it('accepts a handle in place of a DID', () => {
    expect(parseAtUri('at://alice.example/app.bsky.feed.post/3abc')?.did).toBe('alice.example');
  });

  it('rejects a URI that names no record', () => {
    expect(parseAtUri(`at://${DID}`)).toBeNull();
    expect(parseAtUri(`at://${DID}/pub.leaflet.document`)).toBeNull();
    expect(parseAtUri('https://example.org/thing')).toBeNull();
    expect(parseAtUri('')).toBeNull();
  });
});

describe('describeAtUri', () => {
  it('names the application from the collection, not from a source type', () => {
    // The Leaflet plugin files comments under sourceType `leaflet.document`.
    // The collection is the only thing that tells them apart.
    expect(describeAtUri(`at://${DID}/pub.leaflet.comment/3abc`)).toMatchObject({
      appName: 'Leaflet',
      kind: 'Comment',
    });
    expect(describeAtUri(`at://${DID}/pub.leaflet.document/3abc`)).toMatchObject({
      appName: 'Leaflet',
      kind: 'Document',
    });
  });

  it('offers a Smoke Signal address for a calendar event', () => {
    // Checked against a live record: this address renders the event.
    expect(describeAtUri(`at://${DID}/community.lexicon.calendar.event/3xyz`)?.webUrl).toBe(
      `https://smokesignal.events/${DID}/3xyz`
    );
  });

  it('offers a Bluesky address for a post', () => {
    expect(describeAtUri(`at://${DID}/app.bsky.feed.post/3xyz`)?.webUrl).toBe(
      `https://bsky.app/profile/${DID}/post/3xyz`
    );
  });

  it('offers no application address where the route is unverified', () => {
    // A `network.cosmik.card` was previously linked as though it were a Cosmik
    // collection, which 404s. No link is better than a wrong one.
    expect(describeAtUri(`at://${DID}/network.cosmik.card/3abc`)?.webUrl).toBeUndefined();
    expect(describeAtUri(`at://${DID}/network.cosmik.connection/3abc`)?.webUrl).toBeUndefined();
    expect(describeAtUri(`at://${DID}/at.margin.note/3abc`)?.webUrl).toBeUndefined();
    expect(describeAtUri(`at://${DID}/site.standard.document/3abc`)?.webUrl).toBeUndefined();
  });

  it('always offers a record address, whatever the collection', () => {
    for (const collection of [
      'network.cosmik.card',
      'at.margin.note',
      'site.standard.document',
      'com.example.entirely.unknown',
    ]) {
      const uri = `at://${DID}/${collection}/3abc`;
      expect(describeAtUri(uri)?.recordUrl).toBe(`https://pdsls.dev/${uri}`);
    }
  });

  it('falls back to the collection name for an application it has never heard of', () => {
    const described = describeAtUri(`at://${DID}/com.example.newthing/3abc`);
    expect(described).toMatchObject({ appName: 'com.example.newthing', kind: 'Record' });
    expect(described?.webUrl).toBeUndefined();
  });

  it('returns nothing for a string that is not an AT-URI', () => {
    expect(describeAtUri('https://github.com/x/y')).toBeNull();
  });
});

describe('recordBrowserUrl', () => {
  it('addresses the record itself', () => {
    expect(recordBrowserUrl(`at://${DID}/at.margin.note/3abc`)).toBe(
      `https://pdsls.dev/at://${DID}/at.margin.note/3abc`
    );
  });
});

describe('describeUrl', () => {
  it('keeps the part of the address a reader would read', () => {
    expect(describeUrl('https://github.com/aaronstevenwhite/chive')).toEqual({
      host: 'github.com',
      path: '/aaronstevenwhite/chive',
    });
  });

  it('drops the noise', () => {
    expect(describeUrl('https://www.osf.io/abc123/')).toEqual({ host: 'osf.io', path: '/abc123' });
    expect(describeUrl('https://github.com/a/b.git')).toEqual({ host: 'github.com', path: '/a/b' });
    expect(describeUrl('https://example.org/')).toEqual({ host: 'example.org', path: '' });
  });

  it('refuses anything that is not a web address', () => {
    expect(describeUrl(`at://${DID}/x/y`)).toBeNull();
    expect(describeUrl('javascript:alert(1)')).toBeNull();
    expect(describeUrl('not a url')).toBeNull();
  });
});

describe('summarizeUrl', () => {
  it('reads as host and path', () => {
    expect(summarizeUrl('https://github.com/aaronstevenwhite/chive')).toBe(
      'github.com/aaronstevenwhite/chive'
    );
  });

  it('returns the input unchanged when it will not parse', () => {
    expect(summarizeUrl('not a url')).toBe('not a url');
  });
});
