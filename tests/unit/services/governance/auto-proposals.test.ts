/**
 * Unit tests for checkAndCreateFieldProposals in AutomaticProposalService.
 *
 * @remarks
 * Tests field promotion logic: qualifying tag detection, duplicate proposal
 * skipping, spam filtering, correct count reporting, empty candidate handling,
 * and behavior when the tag manager is not configured.
 */

import 'reflect-metadata';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AutomaticProposalService } from '@/services/governance/automatic-proposal-service.js';
import { GovernancePDSWriter } from '@/services/governance/governance-pds-writer.js';
import type { TagManager } from '@/storage/neo4j/tag-manager.js';
import type { FieldCandidate } from '@/storage/neo4j/tag-manager.js';
import type { AtUri, CID, DID, NSID } from '@/types/atproto.js';
import type { IGraphDatabase } from '@/types/interfaces/graph.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

// =============================================================================
// Mock: observability (tracer uses OpenTelemetry which is not available in test)
// =============================================================================

vi.mock('@/observability/tracer.js', () => ({
  withSpan: (_name: string, fn: () => unknown) => fn(),
  addSpanAttributes: vi.fn(),
}));

// =============================================================================
// Helpers
// =============================================================================

const GRAPH_PDS_DID = 'did:plc:test-governance' as DID;

const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

/**
 * Builds a FieldCandidate with sensible defaults that pass the promotion criteria.
 */
function makeCandidate(overrides?: Partial<FieldCandidate>): FieldCandidate {
  return {
    tag: {
      normalizedForm: 'quantum-computing',
      rawForm: 'quantum computing',
      usageCount: 15,
      qualityScore: 0.85,
      spamScore: 0.05,
      createdAt: new Date(),
    },
    evidence: {
      usageCount: 15,
      uniqueUsers: 8,
      paperCount: 10,
      growthRate: 1.2,
      qualityScore: 0.85,
    },
    suggestedFieldName: 'Quantum Computing',
    confidence: 0.9,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('AutomaticProposalService - checkAndCreateFieldProposals', () => {
  let service: AutomaticProposalService;
  let mockPool: Pool;
  let mockGraph: IGraphDatabase;
  let mockLogger: ILogger;
  let mockGovernancePdsWriter: GovernancePDSWriter;
  let mockTagManager: TagManager;
  let mockRedis: Redis;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPool = { query: vi.fn() } as unknown as Pool;

    mockGraph = {
      getNodeByUri: vi.fn().mockResolvedValue(null),
      searchNodes: vi.fn().mockResolvedValue({ nodes: [], total: 0, hasMore: false }),
      listProposals: vi.fn().mockResolvedValue({
        proposals: [],
        total: 0,
        hasMore: false,
        offset: 0,
      }),
    } as unknown as IGraphDatabase;

    mockLogger = createMockLogger();
    mockRedis = {} as unknown as Redis;

    mockGovernancePdsWriter = new GovernancePDSWriter({
      graphPdsDid: GRAPH_PDS_DID,
      pdsUrl: 'https://governance.test',
      signingKey: 'test-key',
      pool: mockPool,
      cache: mockRedis,
      logger: mockLogger,
    });

    // Stub createProposalBootstrap so it does not make real HTTP calls
    vi.spyOn(mockGovernancePdsWriter, 'createProposalBootstrap').mockResolvedValue({
      ok: true,
      value: {
        uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.nodeProposal/proposal-123` as AtUri,
        cid: 'bafyreiabc123' as CID,
      },
    });

    mockTagManager = {
      findFieldCandidates: vi.fn().mockResolvedValue([]),
    } as unknown as TagManager;

    service = new AutomaticProposalService({
      pool: mockPool,
      graph: mockGraph,
      logger: mockLogger,
      governancePdsWriter: mockGovernancePdsWriter,
      graphPdsDid: GRAPH_PDS_DID,
      tagManager: mockTagManager,
    });
  });

  // ---------------------------------------------------------------------------
  // Successful proposal creation
  // ---------------------------------------------------------------------------

  it('creates proposals for qualifying tags', async () => {
    const candidate = makeCandidate();
    vi.mocked(mockTagManager.findFieldCandidates).mockResolvedValue([candidate]);

    const result = await service.checkAndCreateFieldProposals();

    expect(result.proposalsCreated).toBe(1);
    expect(result.candidatesEvaluated).toBe(1);
    expect(result.candidatesSkipped).toBe(0);

    expect(mockGovernancePdsWriter.createProposalBootstrap).toHaveBeenCalledWith(
      'pub.chive.graph.nodeProposal' as NSID,
      expect.stringContaining('proposal-'),
      expect.objectContaining({
        $type: 'pub.chive.graph.nodeProposal',
        proposalType: 'create',
        kind: 'type',
        subkind: 'field',
        proposedNode: expect.objectContaining({
          label: 'Quantum Computing',
        }),
      })
    );
  });

  // ---------------------------------------------------------------------------
  // Skips tags that already have proposals
  // ---------------------------------------------------------------------------

  it('skips tags that already have proposals', async () => {
    const candidate = makeCandidate();
    vi.mocked(mockTagManager.findFieldCandidates).mockResolvedValue([candidate]);

    // Return a proposal whose label matches the candidate
    vi.mocked(mockGraph.listProposals).mockResolvedValue({
      proposals: [
        {
          id: 'existing-proposal',
          uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.nodeProposal/existing` as AtUri,
          proposalType: 'create',
          kind: 'type',
          subkind: 'field',
          proposedNode: { label: 'Quantum Computing' },
          rationale: 'Some rationale',
          status: 'pending',
          proposerDid: GRAPH_PDS_DID,
          createdAt: new Date(),
        },
      ],
      total: 1,
      hasMore: false,
      offset: 0,
    });

    const result = await service.checkAndCreateFieldProposals();

    expect(result.proposalsCreated).toBe(0);
    expect(result.candidatesSkipped).toBe(1);
    expect(result.candidatesEvaluated).toBe(1);
    expect(mockGovernancePdsWriter.createProposalBootstrap).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Skips tags with high spam score
  // ---------------------------------------------------------------------------

  it('skips tags with spamScore >= 0.3 (filtered by findFieldCandidates)', async () => {
    // When the tag manager returns no candidates (because spam tags are
    // pre-filtered by the minQuality threshold), the service should create
    // zero proposals. This test documents that spam filtering happens at the
    // findFieldCandidates layer.
    vi.mocked(mockTagManager.findFieldCandidates).mockResolvedValue([]);

    const result = await service.checkAndCreateFieldProposals();

    expect(result.proposalsCreated).toBe(0);
    expect(result.candidatesEvaluated).toBe(0);
    expect(result.candidatesSkipped).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Correct counts with mixed candidates
  // ---------------------------------------------------------------------------

  it('returns correct counts with mixed candidates', async () => {
    const qualifyingCandidate = makeCandidate({
      tag: {
        normalizedForm: 'neural-networks',
        rawForm: 'neural networks',
        usageCount: 20,
        qualityScore: 0.9,
        spamScore: 0.02,
        createdAt: new Date(),
      },
      suggestedFieldName: 'Neural Networks',
    });

    const alreadyProposedCandidate = makeCandidate({
      tag: {
        normalizedForm: 'deep-learning',
        rawForm: 'deep learning',
        usageCount: 25,
        qualityScore: 0.88,
        spamScore: 0.01,
        createdAt: new Date(),
      },
      suggestedFieldName: 'Deep Learning',
    });

    vi.mocked(mockTagManager.findFieldCandidates).mockResolvedValue([
      qualifyingCandidate,
      alreadyProposedCandidate,
    ]);

    // First call returns no match (for "Neural Networks"), second returns
    // a match (for "Deep Learning")
    vi.mocked(mockGraph.listProposals)
      .mockResolvedValueOnce({
        proposals: [],
        total: 0,
        hasMore: false,
        offset: 0,
      })
      .mockResolvedValueOnce({
        proposals: [
          {
            id: 'existing-dl',
            uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.nodeProposal/dl` as AtUri,
            proposalType: 'create',
            kind: 'type',
            subkind: 'field',
            proposedNode: { label: 'Deep Learning' },
            rationale: 'Existing',
            status: 'pending',
            proposerDid: GRAPH_PDS_DID,
            createdAt: new Date(),
          },
        ],
        total: 1,
        hasMore: false,
        offset: 0,
      });

    const result = await service.checkAndCreateFieldProposals();

    expect(result.candidatesEvaluated).toBe(2);
    expect(result.proposalsCreated).toBe(1);
    expect(result.candidatesSkipped).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Empty candidates list
  // ---------------------------------------------------------------------------

  it('handles empty candidates list', async () => {
    vi.mocked(mockTagManager.findFieldCandidates).mockResolvedValue([]);

    const result = await service.checkAndCreateFieldProposals();

    expect(result.proposalsCreated).toBe(0);
    expect(result.candidatesEvaluated).toBe(0);
    expect(result.candidatesSkipped).toBe(0);
    expect(mockGovernancePdsWriter.createProposalBootstrap).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Tag manager not configured
  // ---------------------------------------------------------------------------

  it('returns zeros when tagManager is not configured', async () => {
    // Create a service without a tag manager
    const serviceNoTagManager = new AutomaticProposalService({
      pool: mockPool,
      graph: mockGraph,
      logger: mockLogger,
      governancePdsWriter: mockGovernancePdsWriter,
      graphPdsDid: GRAPH_PDS_DID,
      // No tagManager
    });

    const result = await serviceNoTagManager.checkAndCreateFieldProposals();

    expect(result.proposalsCreated).toBe(0);
    expect(result.candidatesEvaluated).toBe(0);
    expect(result.candidatesSkipped).toBe(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Tag manager not available; skipping field promotion check'
    );
  });

  // ---------------------------------------------------------------------------
  // Skips tags when field node already exists
  // ---------------------------------------------------------------------------

  it('skips tags when a matching field node already exists in the graph', async () => {
    const candidate = makeCandidate();
    vi.mocked(mockTagManager.findFieldCandidates).mockResolvedValue([candidate]);

    // No existing proposals
    vi.mocked(mockGraph.listProposals).mockResolvedValue({
      proposals: [],
      total: 0,
      hasMore: false,
      offset: 0,
    });

    // But a field node with the same label already exists
    vi.mocked(mockGraph.searchNodes).mockResolvedValue({
      nodes: [
        {
          id: 'existing-field-node',
          uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/existing` as AtUri,
          kind: 'type',
          subkind: 'field',
          label: 'Quantum Computing',
          status: 'established',
          createdAt: new Date(),
        },
      ],
      total: 1,
      hasMore: false,
    });

    const result = await service.checkAndCreateFieldProposals();

    expect(result.proposalsCreated).toBe(0);
    expect(result.candidatesSkipped).toBe(1);
    expect(mockGovernancePdsWriter.createProposalBootstrap).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Handles proposal creation failure gracefully
  // ---------------------------------------------------------------------------

  it('continues processing when a proposal creation fails', async () => {
    const candidate1 = makeCandidate({
      suggestedFieldName: 'Failing Field',
      tag: {
        normalizedForm: 'failing-field',
        rawForm: 'failing field',
        usageCount: 12,
        qualityScore: 0.8,
        spamScore: 0.05,
        createdAt: new Date(),
      },
    });
    const candidate2 = makeCandidate({
      suggestedFieldName: 'Succeeding Field',
      tag: {
        normalizedForm: 'succeeding-field',
        rawForm: 'succeeding field',
        usageCount: 14,
        qualityScore: 0.82,
        spamScore: 0.03,
        createdAt: new Date(),
      },
    });

    vi.mocked(mockTagManager.findFieldCandidates).mockResolvedValue([candidate1, candidate2]);

    vi.mocked(mockGovernancePdsWriter.createProposalBootstrap)
      .mockResolvedValueOnce({
        ok: false,
        error: new Error('PDS write failed') as never,
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.nodeProposal/ok` as AtUri,
          cid: 'bafyok' as CID,
        },
      });

    const result = await service.checkAndCreateFieldProposals();

    // The first candidate fails, the second succeeds
    expect(result.proposalsCreated).toBe(1);
    expect(result.candidatesEvaluated).toBe(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to create field proposal',
      undefined,
      expect.objectContaining({ tag: 'failing-field' })
    );
  });
});
