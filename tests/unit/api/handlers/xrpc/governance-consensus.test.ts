/**
 * Unit tests for consensus calculation in listProposals handler.
 *
 * @remarks
 * Tests the calculateConsensus function used by the listProposals handler
 * to compute consensus progress from vote counts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { listProposals } from '@/api/handlers/xrpc/governance/listProposals.js';
import type { DID } from '@/types/atproto.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

import { TEST_GRAPH_PDS_DID } from '../../../../test-constants.js';

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const makeDID = (did: string): DID => did as DID;

interface MockProposal {
  id: string;
  uri: string;
  nodeUri?: string;
  type: 'create' | 'update' | 'merge' | 'delete';
  changes: Record<string, unknown>;
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedBy: DID;
  votes: { approve: number; reject: number; abstain: number };
  createdAt: Date;
}

interface MockGraphService {
  listProposals: ReturnType<typeof vi.fn>;
  getNode: ReturnType<typeof vi.fn>;
}

interface MockTrustedEditorService {
  getEditorStatus: ReturnType<typeof vi.fn>;
}

const createMockGraphService = (): MockGraphService => ({
  listProposals: vi.fn(),
  getNode: vi.fn(),
});

const createMockTrustedEditorService = (): MockTrustedEditorService => ({
  getEditorStatus: vi.fn(),
});

const createMockProposal = (overrides?: Partial<MockProposal>): MockProposal => ({
  id: 'proposal-1',
  uri: 'at://chive.governance/pub.chive.graph.nodeProposal/proposal-1',
  nodeUri: undefined,
  type: 'create',
  changes: { label: 'Test Field' },
  rationale: 'Test rationale',
  status: 'pending',
  proposedBy: makeDID('did:plc:proposer'),
  votes: { approve: 0, reject: 0, abstain: 0 },
  createdAt: new Date(),
  ...overrides,
});

/**
 * Creates a mock Hono context for testing handlers.
 *
 * @remarks
 * Uses a Map-based implementation for the get/set methods that handlers need.
 * The mock is intentionally minimal - it only implements what the handlers use.
 */
function createMockContext(
  services: { graph: MockGraphService; trustedEditor: MockTrustedEditorService },
  logger: ILogger
): { get: (key: string) => unknown; set: ReturnType<typeof vi.fn> } {
  const contextVariables = new Map<string, unknown>();
  contextVariables.set('services', services);
  contextVariables.set('logger', logger);

  return {
    get: (key: string) => contextVariables.get(key),
    set: vi.fn(),
  };
}

describe('Consensus Calculation in listProposals', () => {
  let mockLogger: ILogger;
  let mockGraphService: MockGraphService;
  let mockTrustedEditorService: MockTrustedEditorService;
  let mockContext: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockGraphService = createMockGraphService();
    mockTrustedEditorService = createMockTrustedEditorService();

    mockContext = createMockContext(
      {
        graph: mockGraphService,
        trustedEditor: mockTrustedEditorService,
      },
      mockLogger
    );

    // Default: nodes not found (no enrichment)
    mockGraphService.getNode.mockResolvedValue(null);
    mockTrustedEditorService.getEditorStatus.mockResolvedValue({
      ok: false,
      error: { message: 'Not found' },
    });
  });

  describe('consensus progress calculation', () => {
    it('returns 0% approval with no votes', async () => {
      const proposal = createMockProposal({
        votes: { approve: 0, reject: 0, abstain: 0 },
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.consensus).toBeDefined();
      expect(result.body.proposals[0]?.consensus?.approvalPercentage).toBe(0);
      expect(result.body.proposals[0]?.consensus?.voterCount).toBe(0);
      expect(result.body.proposals[0]?.consensus?.consensusReached).toBe(false);
      expect(result.body.proposals[0]?.consensus?.recommendedStatus).toBe('pending');
    });

    it('returns 100% approval when all votes approve', async () => {
      const proposal = createMockProposal({
        votes: { approve: 5, reject: 0, abstain: 0 },
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.consensus?.approvalPercentage).toBe(100);
      expect(result.body.proposals[0]?.consensus?.voterCount).toBe(5);
      expect(result.body.proposals[0]?.consensus?.consensusReached).toBe(true);
      expect(result.body.proposals[0]?.consensus?.recommendedStatus).toBe('approved');
    });

    it('returns 0% approval when all votes reject', async () => {
      const proposal = createMockProposal({
        votes: { approve: 0, reject: 5, abstain: 0 },
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.consensus?.approvalPercentage).toBe(0);
      expect(result.body.proposals[0]?.consensus?.recommendedStatus).toBe('rejected');
    });

    it('does not reach consensus with fewer than 3 votes', async () => {
      const proposal = createMockProposal({
        votes: { approve: 2, reject: 0, abstain: 0 },
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.consensus?.voterCount).toBe(2);
      expect(result.body.proposals[0]?.consensus?.minimumVotes).toBe(3);
      expect(result.body.proposals[0]?.consensus?.consensusReached).toBe(false);
      expect(result.body.proposals[0]?.consensus?.recommendedStatus).toBe('pending');
    });

    it('reaches consensus at 67%+ approval with 3+ votes', async () => {
      const proposal = createMockProposal({
        votes: { approve: 3, reject: 1, abstain: 0 }, // 75% approval (exceeds 67%)
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      // 75% > 67% threshold
      expect(result.body.proposals[0]?.consensus?.approvalPercentage).toBe(75);
      expect(result.body.proposals[0]?.consensus?.threshold).toBe(67);
      expect(result.body.proposals[0]?.consensus?.consensusReached).toBe(true);
      expect(result.body.proposals[0]?.consensus?.recommendedStatus).toBe('approved');
    });

    it('excludes abstains from approval percentage calculation', async () => {
      const proposal = createMockProposal({
        votes: { approve: 3, reject: 1, abstain: 10 }, // 75% of decisive votes
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      // 3/(3+1) = 75%
      expect(result.body.proposals[0]?.consensus?.approvalPercentage).toBe(75);
      expect(result.body.proposals[0]?.consensus?.voterCount).toBe(14); // Total including abstains
    });

    it('recommends rejection below 33% approval threshold', async () => {
      const proposal = createMockProposal({
        votes: { approve: 1, reject: 4, abstain: 0 }, // 20% approval
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.consensus?.approvalPercentage).toBe(20);
      expect(result.body.proposals[0]?.consensus?.recommendedStatus).toBe('rejected');
    });

    it('remains pending between 33% and 67% approval', async () => {
      const proposal = createMockProposal({
        votes: { approve: 2, reject: 2, abstain: 0 }, // 50% approval
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.consensus?.approvalPercentage).toBe(50);
      expect(result.body.proposals[0]?.consensus?.consensusReached).toBe(false);
      expect(result.body.proposals[0]?.consensus?.recommendedStatus).toBe('pending');
    });
  });

  describe('proposal enrichment', () => {
    it('enriches proposal with node label', async () => {
      const nodeUri = `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/b8c9d0e1-f2a3-4567-1234-56789abcdef0`;
      const proposal = createMockProposal({
        nodeUri,
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      mockGraphService.getNode.mockResolvedValue({
        id: 'b8c9d0e1-f2a3-4567-1234-56789abcdef0',
        uri: nodeUri,
        label: 'Quantum Computing',
        kind: 'type',
        subkind: 'field',
        description: 'A field of computer science',
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.label).toBe('Quantum Computing');
    });

    it('uses changes.label when nodeUri is not set', async () => {
      const proposal = createMockProposal({
        nodeUri: undefined,
        changes: { label: 'New Field Name' },
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.label).toBe('New Field Name');
    });

    it('enriches proposal with proposer display name', async () => {
      const proposal = createMockProposal({
        proposedBy: makeDID('did:plc:alice'),
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: true,
        value: {
          did: 'did:plc:alice',
          displayName: 'Alice Researcher',
          role: 'graph-editor',
        },
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.proposerName).toBe('Alice Researcher');
    });

    it('leaves proposerName undefined when user not found', async () => {
      const proposal = createMockProposal({
        proposedBy: makeDID('did:plc:unknown'),
      });

      mockGraphService.listProposals.mockResolvedValue({
        proposals: [proposal],
        total: 1,
        hasMore: false,
      });

      mockTrustedEditorService.getEditorStatus.mockResolvedValue({
        ok: false,
        error: { message: 'User not found' },
      });

      const result = await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      expect(result.body.proposals[0]?.proposerName).toBeUndefined();
    });
  });

  describe('batch lookups', () => {
    it('batches node lookups for multiple proposals', async () => {
      const nodeUriA = `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/c9d0e1f2-a3b4-5678-2345-6789abcdef01`;
      const nodeUriB = `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/d0e1f2a3-b4c5-6789-3456-789abcdef012`;
      const proposals = [
        createMockProposal({ id: '1', nodeUri: nodeUriA }),
        createMockProposal({ id: '2', nodeUri: nodeUriB }),
        createMockProposal({ id: '3', nodeUri: nodeUriA }), // Same as first
      ];

      mockGraphService.listProposals.mockResolvedValue({
        proposals,
        total: 3,
        hasMore: false,
      });

      await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      // Should only look up unique node URIs
      expect(mockGraphService.getNode).toHaveBeenCalledTimes(2);
      expect(mockGraphService.getNode).toHaveBeenCalledWith(nodeUriA);
      expect(mockGraphService.getNode).toHaveBeenCalledWith(nodeUriB);
    });

    it('batches proposer lookups for multiple proposals', async () => {
      const proposals = [
        createMockProposal({ id: '1', proposedBy: makeDID('did:plc:alice') }),
        createMockProposal({ id: '2', proposedBy: makeDID('did:plc:bob') }),
        createMockProposal({ id: '3', proposedBy: makeDID('did:plc:alice') }), // Same as first
      ];

      mockGraphService.listProposals.mockResolvedValue({
        proposals,
        total: 3,
        hasMore: false,
      });

      await listProposals.handler({
        params: { limit: 20 },
        input: undefined,
        auth: null,
        c: mockContext as unknown as Parameters<typeof listProposals.handler>[0]['c'],
      });

      // Should only look up unique proposer DIDs
      expect(mockTrustedEditorService.getEditorStatus).toHaveBeenCalledTimes(2);
    });
  });
});
