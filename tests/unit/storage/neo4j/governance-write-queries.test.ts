/**
 * Unit tests for the governance write queries in the Neo4j adapter.
 *
 * @remarks
 * Two defects are covered here. First, `createVote` stamped ballots with
 * `datetime()` and dropped the timestamp it was handed, so ballot order was a
 * function of ingest time and changed on every rebuild from the firehose.
 * Second, `createProposal`'s `ON MATCH SET` copied only `proposedNode` and
 * `rationale`, so a proposal edited in its PDS kept a stale `proposalType`,
 * `kind`, `subkind` and `targetUri` after re-index.
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { Neo4jAdapter } from '@/storage/neo4j/adapter.js';
import type { Neo4jConnection } from '@/storage/neo4j/connection.js';
import type { Vote } from '@/storage/neo4j/types.js';
import type { AtUri, DID } from '@/types/atproto.js';

const PROPOSER = 'did:plc:izttpdp3l6vss5crelt5kcux' as DID;
const PROPOSAL_URI = `at://${PROPOSER}/pub.chive.graph.nodeProposal/3mlbhk6h2ne2k` as AtUri;
const VOTE_URI = `at://${PROPOSER}/pub.chive.graph.vote/3mlbhk6h2ne2v` as AtUri;
const CREATED_AT = new Date('2026-05-07T14:48:40.171Z');

describe('Neo4jAdapter governance write queries', () => {
  let executeQuery: Mock;
  let adapter: Neo4jAdapter;

  beforeEach(() => {
    executeQuery = vi.fn().mockResolvedValue({ records: [] });
    adapter = new Neo4jAdapter({ executeQuery } as unknown as Neo4jConnection);
  });

  describe('createVote', () => {
    const vote: Vote = {
      id: '3mlbhk6h2ne2v',
      uri: VOTE_URI,
      proposalUri: PROPOSAL_URI,
      voterDid: PROPOSER,
      voterRole: 'community-member',
      vote: 'approve',
      createdAt: CREATED_AT,
    };

    it('should stamp the ballot with the record timestamp it was handed', async () => {
      await adapter.createVote(vote);

      const [query, params] = executeQuery.mock.calls[0] as [string, Record<string, unknown>];

      expect(query).toContain('v.createdAt = datetime($createdAt)');
      expect(params.createdAt).toBe(CREATED_AT.toISOString());
    });

    it('should not fall back to wall-clock time for createdAt', async () => {
      await adapter.createVote(vote);

      const [query] = executeQuery.mock.calls[0] as [string];

      expect(query).not.toContain('v.createdAt = datetime()');
    });
  });

  describe('createProposal', () => {
    const proposal = {
      uri: PROPOSAL_URI,
      proposalType: 'update' as const,
      kind: 'object' as const,
      subkind: 'field',
      targetUri: `at://${PROPOSER}/pub.chive.graph.node/target` as AtUri,
      proposedNode: { label: 'Semantics' },
      rationale: 'because',
      proposerDid: PROPOSER,
      createdAt: CREATED_AT,
    };

    const onMatchBlock = (query: string): string => query.slice(query.indexOf('ON MATCH SET'));

    it('should mirror every record-carried field when the proposal already exists', async () => {
      await adapter.createProposal(proposal);

      const [query] = executeQuery.mock.calls[0] as [string];
      const onMatch = onMatchBlock(query);

      for (const assignment of [
        'p.proposalType = $proposalType',
        'p.kind = $kind',
        'p.subkind = $subkind',
        'p.targetUri = $targetUri',
        'p.proposedNode = $proposedNode',
        'p.rationale = $rationale',
        'p.createdAt = datetime($createdAt)',
      ]) {
        expect(onMatch).toContain(assignment);
      }
    });

    it('should leave status, id and proposer untouched on re-index', async () => {
      await adapter.createProposal(proposal);

      const [query] = executeQuery.mock.calls[0] as [string];
      const onMatch = onMatchBlock(query);

      expect(onMatch).not.toContain('p.status');
      expect(onMatch).not.toContain('p.id =');
      expect(onMatch).not.toContain('p.proposerDid');
    });

    it("should pass the record's own createdAt as an ISO parameter", async () => {
      await adapter.createProposal(proposal);

      const [, params] = executeQuery.mock.calls[0] as [string, Record<string, unknown>];

      expect(params.createdAt).toBe(CREATED_AT.toISOString());
    });
  });
});
