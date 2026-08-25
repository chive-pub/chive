/**
 * Unit tests for the PostgreSQLAdapter.deleteByUri table allowlist.
 *
 * @remarks
 * The allowlist previously named `citations_index` and `related_works_index`,
 * neither of which any migration creates, so every firehose tombstone for those
 * record types raised an undefined_table error. These tests pin the allowlist to
 * table names that exist and are keyed by a `uri` column.
 */

import type { Pool } from 'pg';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PostgreSQLAdapter } from '@/storage/postgresql/adapter.js';
import type { AtUri } from '@/types/atproto.js';

const TEST_URI = 'at://did:plc:abc123/pub.chive.eprint.relatedWork/xyz789' as AtUri;

function createMockPool(): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  } as unknown as Pool;
}

describe('PostgreSQLAdapter.deleteByUri', () => {
  let adapter: PostgreSQLAdapter;
  let mockPool: Pool;

  beforeEach(() => {
    mockPool = createMockPool();
    adapter = new PostgreSQLAdapter(mockPool);
  });

  it.each(['user_tags_index', 'reviews_index', 'endorsements_index', 'user_related_works_index'])(
    'deletes from %s',
    async (table) => {
      await adapter.deleteByUri(table, TEST_URI);

      expect(mockPool.query).toHaveBeenCalledWith(`DELETE FROM ${table} WHERE uri = $1`, [
        TEST_URI,
      ]);
    }
  );

  it.each(['citations_index', 'related_works_index'])(
    'rejects %s, which no migration creates',
    async (table) => {
      await expect(adapter.deleteByUri(table, TEST_URI)).rejects.toThrow(
        `Invalid table name: ${table}`
      );
      expect(mockPool.query).not.toHaveBeenCalled();
    }
  );

  it('rejects extracted_citations, which is keyed by user_record_uri', async () => {
    await expect(adapter.deleteByUri('extracted_citations', TEST_URI)).rejects.toThrow(
      'Invalid table name: extracted_citations'
    );
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('rejects an injection attempt', async () => {
    await expect(adapter.deleteByUri('reviews_index; DROP TABLE users', TEST_URI)).rejects.toThrow(
      'Invalid table name'
    );
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});
