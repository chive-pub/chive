/**
 * Unit tests for proposal row mapping in the Neo4j adapter.
 *
 * @remarks
 * A proposal row whose `proposerDid` does not parse used to abort the enclosing
 * query, so one malformed row emptied the whole governance list. The row is now
 * skipped for list queries and reported as a read failure for single-record
 * lookups, where a null would otherwise be rendered as a 404.
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { Neo4jAdapter } from '@/storage/neo4j/adapter.js';
import type { Neo4jConnection } from '@/storage/neo4j/connection.js';
import type { AtUri } from '@/types/atproto.js';
import { DatabaseError } from '@/types/errors.js';

interface MockRecord {
  get: (key: string) => unknown;
}

const createProposalRecord = (overrides: Record<string, unknown> = {}): MockRecord => {
  const properties = {
    id: 'rkey-good',
    uri: 'at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.graph.nodeProposal/rkey-good',
    proposalType: 'create',
    kind: 'type',
    subkind: 'field',
    rationale: 'because',
    status: 'pending',
    proposerDid: 'did:plc:izttpdp3l6vss5crelt5kcux',
    createdAt: '2026-05-07T14:48:40.171Z',
    ...overrides,
  };

  return { get: (key: string): unknown => (key === 'p' ? { properties } : undefined) };
};

const countRecord = (total: number): MockRecord => ({ get: (): unknown => total });

describe('Neo4jAdapter proposal mapping', () => {
  let executeQuery: Mock;
  let adapter: Neo4jAdapter;

  beforeEach(() => {
    executeQuery = vi.fn();
    adapter = new Neo4jAdapter({ executeQuery } as unknown as Neo4jConnection);
  });

  describe('listProposals', () => {
    it('should skip an unmappable row instead of emptying the page', async () => {
      executeQuery
        .mockResolvedValueOnce({
          records: [
            createProposalRecord({ proposerDid: 'not-a-did' }),
            createProposalRecord({ id: 'rkey-good' }),
          ],
        })
        .mockResolvedValueOnce({ records: [countRecord(2)] });

      const result = await adapter.listProposals({ limit: 50 });

      expect(result.proposals).toHaveLength(1);
      expect(result.proposals[0]?.id).toBe('rkey-good');
      expect(result.total).toBe(2);
    });

    it('should decide pagination on raw rows so a skipped row does not end it early', async () => {
      // The query asks for limit + 1 rows; the extra row is the next-page probe.
      executeQuery
        .mockResolvedValueOnce({
          records: [
            createProposalRecord({ id: 'rkey-a' }),
            createProposalRecord({ id: 'rkey-b', proposerDid: 'not-a-did' }),
            createProposalRecord({ id: 'rkey-c' }),
          ],
        })
        .mockResolvedValueOnce({ records: [countRecord(9)] });

      const result = await adapter.listProposals({ limit: 2 });

      expect(result.hasMore).toBe(true);
      expect(result.proposals.map((p) => p.id)).toEqual(['rkey-a']);
    });
  });

  describe('getProposal', () => {
    it('should report an unmappable row as a read failure, not as absent', async () => {
      executeQuery.mockResolvedValueOnce({
        records: [createProposalRecord({ proposerDid: 'not-a-did' })],
      });

      await expect(adapter.getProposal('at://did:plc:x/c/rkey' as AtUri)).rejects.toBeInstanceOf(
        DatabaseError
      );
    });

    it('should still return null when no row matches', async () => {
      executeQuery.mockResolvedValueOnce({ records: [] });

      expect(await adapter.getProposal('at://did:plc:x/c/rkey' as AtUri)).toBeNull();
    });
  });

  describe('getProposalByRkey', () => {
    it('should report an unmappable row as a read failure, not as absent', async () => {
      executeQuery.mockResolvedValueOnce({
        records: [createProposalRecord({ proposerDid: 'not-a-did' })],
      });

      await expect(adapter.getProposalByRkey('rkey-good')).rejects.toBeInstanceOf(DatabaseError);
    });
  });

  describe('getProposalsForNode', () => {
    it('should drop an unmappable row and keep the rest', async () => {
      executeQuery.mockResolvedValueOnce({
        records: [
          createProposalRecord({ id: 'rkey-a' }),
          createProposalRecord({ id: 'rkey-b', proposerDid: '' }),
        ],
      });

      const proposals = await adapter.getProposalsForNode('at://did:plc:x/c/node' as AtUri);

      expect(proposals.map((p) => p.id)).toEqual(['rkey-a']);
    });
  });
});
