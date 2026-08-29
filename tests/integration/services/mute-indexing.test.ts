/**
 * Mute indexing integration tests.
 *
 * @remarks
 * `pub.chive.actor.mute` records were dropped by the firehose processor: the
 * collection had no branch, so Chive never learned that a mute existed and
 * could not apply one server-side. The client reads mutes from the PDS
 * directly, so the interface worked and nothing looked wrong.
 *
 * These run against a real PostgreSQL because the behaviour under test is an
 * upsert with a uniqueness constraint, which a mocked pool cannot exercise.
 *
 * @packageDocumentation
 */

import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { getDatabaseConfig } from '@/storage/postgresql/config.js';

const MUTER = 'did:plc:mutertestaccount';
const SUBJECT = 'did:plc:subjecttestaccount';
const PDS = 'https://pds.mute.test';

describe('muted_authors_index', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool(getDatabaseConfig());
  });

  afterAll(async () => {
    await pool.query('DELETE FROM muted_authors_index WHERE muter_did = $1', [MUTER]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM muted_authors_index WHERE muter_did = $1', [MUTER]);
  });

  async function insert(uri: string, subject = SUBJECT, createdAt = new Date()): Promise<void> {
    await pool.query(
      `INSERT INTO muted_authors_index (uri, cid, muter_did, subject_did, created_at, pds_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (muter_did, subject_did)
       DO UPDATE SET uri = EXCLUDED.uri, cid = EXCLUDED.cid,
                     created_at = EXCLUDED.created_at, pds_url = EXCLUDED.pds_url,
                     indexed_at = NOW()`,
      [uri, 'bafytest', MUTER, subject, createdAt, PDS]
    );
  }

  it('records a mute', async () => {
    await insert(`at://${MUTER}/pub.chive.actor.mute/one`);

    const { rows } = await pool.query('SELECT * FROM muted_authors_index WHERE muter_did = $1', [
      MUTER,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subject_did).toBe(SUBJECT);
  });

  it('treats muting the same author twice as one mute', async () => {
    // A client that writes a second record for the same subject — or a replay
    // of the same firehose event — must not produce a second row, or a mute
    // could be "unmuted" once and still apply.
    await insert(`at://${MUTER}/pub.chive.actor.mute/one`);
    await insert(`at://${MUTER}/pub.chive.actor.mute/two`);

    const { rows } = await pool.query('SELECT uri FROM muted_authors_index WHERE muter_did = $1', [
      MUTER,
    ]);
    expect(rows).toHaveLength(1);
    // The newer record wins, so a delete arriving for it finds the row.
    expect(rows[0]?.uri).toContain('/two');
  });

  it('keeps mutes of different authors apart', async () => {
    await insert(`at://${MUTER}/pub.chive.actor.mute/a`, 'did:plc:one');
    await insert(`at://${MUTER}/pub.chive.actor.mute/b`, 'did:plc:two');

    const { rows } = await pool.query(
      'SELECT subject_did FROM muted_authors_index WHERE muter_did = $1',
      [MUTER]
    );
    expect(rows).toHaveLength(2);
  });

  it('deletes by record URI, which is what a firehose tombstone carries', async () => {
    const uri = `at://${MUTER}/pub.chive.actor.mute/one`;
    await insert(uri);

    await pool.query('DELETE FROM muted_authors_index WHERE uri = $1', [uri]);

    const { rows } = await pool.query('SELECT 1 FROM muted_authors_index WHERE muter_did = $1', [
      MUTER,
    ]);
    expect(rows).toHaveLength(0);
  });

  it('orders newest first, which is what the endpoint pages through', async () => {
    await insert(`at://${MUTER}/pub.chive.actor.mute/old`, 'did:plc:one', new Date('2026-01-01'));
    await insert(`at://${MUTER}/pub.chive.actor.mute/new`, 'did:plc:two', new Date('2026-06-01'));

    const { rows } = await pool.query<{ uri: string }>(
      `SELECT uri FROM muted_authors_index WHERE muter_did = $1
       ORDER BY created_at DESC, uri DESC`,
      [MUTER]
    );
    expect(rows[0]?.uri).toContain('/new');
  });
});
