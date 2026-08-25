/**
 * Unit tests for proposal identifier resolution.
 *
 * @remarks
 * Regression cover for issue #89. Proposal routes and every list link carry the
 * record key, because an AT-URI cannot occupy a single dynamic route segment,
 * while `getProposalById` cast whatever it was given to an `AtUri` and matched
 * on `uri`. A record key never equals a full AT-URI, so no proposal detail page
 * could load and `getUserVote` — which resolves the proposal first — failed the
 * same way. The reporter's proposal record was created successfully; only the
 * read path was broken.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import { KnowledgeGraphService } from '@/services/knowledge-graph/graph-service.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const RKEY = '3mlbhk6h2ne2k';
const URI = `at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.graph.nodeProposal/${RKEY}`;

const proposal = {
  id: RKEY,
  uri: URI,
  proposalType: 'create' as const,
  kind: 'type' as const,
  subkind: 'field',
  rationale: 'because',
  status: 'pending' as const,
  proposerDid: 'did:plc:izttpdp3l6vss5crelt5kcux',
  createdAt: new Date('2026-05-07T14:48:40.171Z'),
};

const createLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

describe('KnowledgeGraphService.getProposalById', () => {
  let graph: { getProposal: ReturnType<typeof vi.fn>; getProposalByRkey: ReturnType<typeof vi.fn> };
  let service: KnowledgeGraphService;

  beforeEach(() => {
    vi.clearAllMocks();
    graph = {
      getProposal: vi.fn().mockResolvedValue(null),
      getProposalByRkey: vi.fn().mockResolvedValue(null),
    };
    service = new KnowledgeGraphService({
      graph: graph as never,
      logger: createLogger(),
    } as never);
  });

  it('should resolve a record key through the record-key lookup', async () => {
    graph.getProposalByRkey.mockResolvedValue(proposal);

    const result = await service.getProposalById(RKEY);

    expect(result).not.toBeNull();
    expect(graph.getProposalByRkey).toHaveBeenCalledWith(RKEY);
    // Casting a record key to an AtUri and matching on `uri` is what broke.
    expect(graph.getProposal).not.toHaveBeenCalled();
  });

  it('should still resolve a full AT-URI through the URI lookup', async () => {
    graph.getProposal.mockResolvedValue(proposal);

    const result = await service.getProposalById(URI);

    expect(result).not.toBeNull();
    expect(graph.getProposal).toHaveBeenCalledWith(URI);
    expect(graph.getProposalByRkey).not.toHaveBeenCalled();
  });

  it('should return null when neither lookup finds the proposal', async () => {
    expect(await service.getProposalById(RKEY)).toBeNull();
  });

  it('should not treat a user-typed slug as an AT-URI', async () => {
    // The form used to route by the slug the user typed into the ID field.
    await service.getProposalById('quantum-machine-learning');

    expect(graph.getProposalByRkey).toHaveBeenCalledWith('quantum-machine-learning');
    expect(graph.getProposal).not.toHaveBeenCalled();
  });
});
