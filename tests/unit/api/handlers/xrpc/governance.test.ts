/**
 * Unit tests for XRPC governance handlers.
 *
 * @remarks
 * Tests listProposals, getProposal, and listVotes handlers.
 * Validates Neo4j adapter integration for knowledge graph governance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getProposal } from '@/api/handlers/xrpc/governance/getProposal.js';
import { listProposals } from '@/api/handlers/xrpc/governance/listProposals.js';
import { listVotes } from '@/api/handlers/xrpc/governance/listVotes.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

interface MockProposal {
  id: string;
  uri: string;
  fieldId?: string;
  label?: string;
  type: 'create' | 'update' | 'merge' | 'delete';
  changes: Record<string, unknown>;
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedBy: DID;
  votes: { approve: number; reject: number; abstain: number };
  createdAt: Date;
}

interface MockVote {
  id: string;
  uri: string;
  proposalUri: string;
  voterDid: DID;
  voterRole: 'community-member' | 'reviewer' | 'domain-expert' | 'administrator';
  vote: 'approve' | 'reject' | 'abstain' | 'request-changes';
  weight: number;
  rationale?: string;
  createdAt: Date;
}

interface MockGraphAdapter {
  listProposals: ReturnType<typeof vi.fn>;
  getProposalById: ReturnType<typeof vi.fn>;
  getVotesForProposal: ReturnType<typeof vi.fn>;
}

const createMockGraphAdapter = (): MockGraphAdapter => ({
  listProposals: vi.fn(),
  getProposalById: vi.fn(),
  getVotesForProposal: vi.fn(),
});

const createMockProposal = (overrides?: Partial<MockProposal>): MockProposal => ({
  id: 'proposal-abc123',
  uri: 'at://did:plc:chive/pub.chive.graph.proposal/abc123',
  fieldId: 'quantum-computing',
  label: 'Quantum Computing',
  type: 'create',
  changes: { label: 'Quantum Computing', description: 'A subfield of computer science' },
  rationale: 'Propose adding quantum computing as a subfield of Computer Science',
  status: 'pending',
  proposedBy: 'did:plc:proposer123' as DID,
  votes: { approve: 5, reject: 1, abstain: 0 },
  createdAt: new Date(),
  ...overrides,
});

describe('XRPC Governance Handlers', () => {
  let mockLogger: ILogger;
  let mockGraphAdapter: MockGraphAdapter;
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockGraphAdapter = createMockGraphAdapter();

    mockContext = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'services':
            return {
              graph: mockGraphAdapter,
            };
          case 'logger':
            return mockLogger;
          default:
            return undefined;
        }
      }),
      set: vi.fn(),
    };
  });

  describe('listProposals.handler', () => {
    it('returns paginated list of proposals', async () => {
      const proposals = [
        createMockProposal(),
        createMockProposal({
          id: 'proposal-def456',
          label: 'Physics taxonomy update',
          status: 'approved',
        }),
      ];

      mockGraphAdapter.listProposals.mockResolvedValue({
        proposals,
        total: 2,
        hasMore: false,
        offset: 0,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals).toHaveLength(2);
      expect(result.body.total).toBe(2);
    });

    it('filters by status', async () => {
      const pendingProposals = [createMockProposal()];

      mockGraphAdapter.listProposals.mockResolvedValue({
        proposals: pendingProposals,
        total: 1,
        hasMore: false,
        offset: 0,
      });

      const result = await listProposals.handler({
        params: { status: 'pending', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals).toHaveLength(1);
      expect(result.body.proposals[0]?.status).toBe('pending');
    });

    it('handles pagination with cursor', async () => {
      mockGraphAdapter.listProposals.mockResolvedValue({
        proposals: [],
        total: 100,
        cursor: '40', // Next page cursor
      });

      const result = await listProposals.handler({
        params: { limit: 20, cursor: '20' },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.cursor).toBe('40');
      expect(result.body.total).toBe(100);
      expect(mockGraphAdapter.listProposals).toHaveBeenCalled();
    });

    it('filters by proposal type', async () => {
      const createProposals = [createMockProposal({ type: 'create' })];

      mockGraphAdapter.listProposals.mockResolvedValue({
        proposals: createProposals,
        total: 1,
        hasMore: false,
        offset: 0,
      });

      const result = await listProposals.handler({
        params: { type: 'create', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.type).toBe('create');
    });
  });

  describe('getProposal.handler', () => {
    it('returns proposal details with vote counts', async () => {
      const proposal = createMockProposal();
      mockGraphAdapter.getProposalById.mockResolvedValue(proposal);

      const result = await getProposal.handler({
        params: { proposalId: 'proposal-abc123' },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof getProposal.handler>[0]['c'],
      });

      expect(result.body.id).toBe('proposal-abc123');
      expect(result.body.votes.approve).toBe(5);
      expect(result.body.votes.reject).toBe(1);
    });

    it('throws NotFoundError when proposal does not exist', async () => {
      mockGraphAdapter.getProposalById.mockResolvedValue(null);

      await expect(
        getProposal.handler({
          params: { proposalId: 'nonexistent-proposal' },
          input: undefined,
          auth: null,
          c: mockContext as unknown as Parameters<typeof getProposal.handler>[0]['c'],
        })
      ).rejects.toThrow();
    });

    it('includes proposer information', async () => {
      const proposal = createMockProposal();
      mockGraphAdapter.getProposalById.mockResolvedValue(proposal);

      const result = await getProposal.handler({
        params: { proposalId: 'proposal-abc123' },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof getProposal.handler>[0]['c'],
      });

      expect(result.body.proposedBy).toBe('did:plc:proposer123');
    });
  });

  describe('listVotes.handler', () => {
    it('returns votes for a proposal', async () => {
      const votes: MockVote[] = [
        {
          id: 'vote-1',
          uri: 'at://did:plc:voter1/pub.chive.graph.vote/1',
          proposalUri: 'at://did:plc:chive/pub.chive.graph.proposal/abc123',
          voterDid: 'did:plc:voter1' as DID,
          vote: 'approve',
          voterRole: 'reviewer',
          weight: 1,
          rationale: 'Well-researched proposal',
          createdAt: new Date(),
        },
        {
          id: 'vote-2',
          uri: 'at://did:plc:voter2/pub.chive.graph.vote/2',
          proposalUri: 'at://did:plc:chive/pub.chive.graph.proposal/abc123',
          voterDid: 'did:plc:voter2' as DID,
          vote: 'reject',
          voterRole: 'community-member',
          weight: 1,
          rationale: 'Needs more discussion',
          createdAt: new Date(),
        },
      ];

      mockGraphAdapter.getVotesForProposal.mockResolvedValue(votes);

      const result = await listVotes.handler({
        params: { proposalId: 'proposal-abc123', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listVotes.handler>[0]['c'],
      });

      expect(result.body.votes).toHaveLength(2);
      expect(result.body.total).toBe(2);
    });

    it('includes voter role information', async () => {
      const votes: MockVote[] = [
        {
          id: 'vote-1',
          uri: 'at://did:plc:editor1/pub.chive.graph.vote/1',
          proposalUri: 'at://did:plc:chive/pub.chive.graph.proposal/abc123',
          voterDid: 'did:plc:editor1' as DID,
          vote: 'approve',
          voterRole: 'domain-expert',
          weight: 2,
          createdAt: new Date(),
        },
      ];

      mockGraphAdapter.getVotesForProposal.mockResolvedValue(votes);

      const result = await listVotes.handler({
        params: { proposalId: 'proposal-abc123', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listVotes.handler>[0]['c'],
      });

      expect(result.body.votes[0]?.voterRole).toBe('domain-expert');
    });

    it('returns empty array when no votes exist', async () => {
      mockGraphAdapter.getVotesForProposal.mockResolvedValue([]);

      const result = await listVotes.handler({
        params: { proposalId: 'proposal-abc123', limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listVotes.handler>[0]['c'],
      });

      expect(result.body.votes).toHaveLength(0);
      expect(result.body.total).toBe(0);
    });
  });
});
