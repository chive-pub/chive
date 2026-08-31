/**
 * Tests for writing sifa.id records.
 *
 * @remarks
 * Shapes are taken from the lexicons sifa.id publishes at
 * `did:plc:2f2ahswozqy4v5lvu676375y`. `publication` requires `title` and
 * `createdAt`; `presentationDelivery` requires only `createdAt`; `#author`
 * requires `name`; `#externalRecordRef` requires `uri` and treats `cid` as an
 * optional integrity hint.
 *
 * @packageDocumentation
 */

import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@atproto/api';

import {
  createSifaPublication,
  createSifaTalk,
  SIFA_PUBLICATION_COLLECTION,
  SIFA_PRESENTATION_DELIVERY_COLLECTION,
} from '@/lib/atproto/sifa-records';

const EPRINT_URI = 'at://did:plc:aswhite123abc/pub.chive.eprint.submission/3jt7k9xyzab01';

/**
 * An agent that records what it was asked to write.
 */
function agentWithSession(did: string | undefined) {
  const createRecord = vi.fn().mockResolvedValue({
    data: { uri: 'at://did:plc:aswhite123abc/id.sifa.profile.publication/abc', cid: 'bafy' },
  });
  return {
    agent: { did, com: { atproto: { repo: { createRecord } } } } as unknown as Agent,
    createRecord,
  };
}

describe('createSifaPublication', () => {
  it('writes to the researcher’s own repository', async () => {
    const { agent, createRecord } = agentWithSession('did:plc:aswhite123abc');

    await createSifaPublication(agent, { title: 'A paper', eprintUri: EPRINT_URI });

    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'did:plc:aswhite123abc',
        collection: SIFA_PUBLICATION_COLLECTION,
      })
    );
  });

  it('points sameAs at the eprint, without pinning a CID', async () => {
    const { agent, createRecord } = agentWithSession('did:plc:aswhite123abc');

    await createSifaPublication(agent, { title: 'A paper', eprintUri: EPRINT_URI });

    const record = createRecord.mock.calls[0]?.[0].record as Record<string, unknown>;
    // The lexicon calls `cid` an integrity hint that pins one version; a
    // reference to an eprint should follow its edits.
    expect(record.sameAs).toEqual({ uri: EPRINT_URI });
  });

  it('sets the fields the lexicon requires', async () => {
    const { agent, createRecord } = agentWithSession('did:plc:aswhite123abc');

    await createSifaPublication(agent, { title: 'A paper', eprintUri: EPRINT_URI });

    const record = createRecord.mock.calls[0]?.[0].record as Record<string, unknown>;
    expect(record.title).toBe('A paper');
    expect(typeof record.createdAt).toBe('string');
    expect(record.$type).toBe(SIFA_PUBLICATION_COLLECTION);
  });

  it('omits empty and undefined fields rather than sending them', async () => {
    const { agent, createRecord } = agentWithSession('did:plc:aswhite123abc');

    await createSifaPublication(agent, {
      title: 'A paper',
      eprintUri: EPRINT_URI,
      publisher: '',
      description: undefined,
    });

    const record = createRecord.mock.calls[0]?.[0].record as Record<string, unknown>;
    // A lexicon-validating PDS rejects a property present but undefined.
    expect(record).not.toHaveProperty('publisher');
    expect(record).not.toHaveProperty('description');
    expect(record).not.toHaveProperty('authors');
  });

  it('carries co-authors, keeping DIDs where they exist', async () => {
    const { agent, createRecord } = agentWithSession('did:plc:aswhite123abc');

    await createSifaPublication(agent, {
      title: 'A paper',
      eprintUri: EPRINT_URI,
      authors: [
        { name: 'Aaron Steven White', did: 'did:plc:aswhite123abc' },
        { name: 'A Coauthor' },
      ],
    });

    const record = createRecord.mock.calls[0]?.[0].record as Record<string, unknown>;
    expect(record.authors).toEqual([
      { name: 'Aaron Steven White', did: 'did:plc:aswhite123abc' },
      { name: 'A Coauthor' },
    ]);
  });

  it('refuses to write without a session', async () => {
    const { agent } = agentWithSession(undefined);

    await expect(
      createSifaPublication(agent, { title: 'A paper', eprintUri: EPRINT_URI })
    ).rejects.toThrow(/authenticated session/);
  });
});

describe('createSifaTalk', () => {
  it('writes a presentation delivery, which is one occasion a talk was given', async () => {
    const { agent, createRecord } = agentWithSession('did:plc:aswhite123abc');

    await createSifaTalk(agent, {
      title: 'A talk',
      eventName: 'ATScience 2026',
      date: '2026-10-13',
      eprintUri: EPRINT_URI,
    });

    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ collection: SIFA_PRESENTATION_DELIVERY_COLLECTION })
    );
    const record = createRecord.mock.calls[0]?.[0].record as Record<string, unknown>;
    expect(record.eventName).toBe('ATScience 2026');
    expect(record.sameAs).toEqual({ uri: EPRINT_URI });
  });

  it('is valid with nothing but an event name, as the lexicon allows', async () => {
    const { agent, createRecord } = agentWithSession('did:plc:aswhite123abc');

    await createSifaTalk(agent, { eventName: 'A workshop' });

    const record = createRecord.mock.calls[0]?.[0].record as Record<string, unknown>;
    expect(typeof record.createdAt).toBe('string');
    expect(record).not.toHaveProperty('sameAs');
    expect(record).not.toHaveProperty('title');
  });
});
