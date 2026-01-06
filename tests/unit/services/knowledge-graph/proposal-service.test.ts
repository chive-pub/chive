/**
 * Unit tests for ProposalService.
 *
 * @remarks
 * Tests Wikipedia-style weighted voting consensus calculations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  ProposalService,
  type Vote,
  type UserRole,
} from '@/services/knowledge-graph/proposal-service.js';
import { toDID } from '@/types/atproto-validators.js';
import type { DID } from '@/types/atproto.js';
import { ValidationError } from '@/types/errors.js';
import type { FieldProposal } from '@/types/interfaces/graph.interface.js';
import type { ILogger } from '@/types/interfaces/logger.interface.js';

const createMockLogger = (): ILogger => {
  const logger: ILogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
};

const makeDID = (did: string): DID => {
  const result = toDID(did);
  if (!result) {
    throw new Error(`Invalid DID: ${did}`);
  }
  return result;
};

const createMockProposal = (overrides?: Partial<FieldProposal>): FieldProposal => ({
  id: 'proposal-1',
  fieldId: 'field-1',
  proposedBy: makeDID('did:plc:proposer'),
  proposalType: 'create',
  changes: {},
  rationale: 'Test rationale',
  status: 'pending',
  votes: { approve: 0, reject: 0 },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const createMockVote = (overrides?: Partial<Vote>): Vote => ({
  voterDid: makeDID('did:plc:voter1'),
  value: 'approve',
  weight: 1.0,
  votedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

describe('ProposalService', () => {
  let logger: ILogger;
  let service: ProposalService;

  beforeEach(() => {
    logger = createMockLogger();
    service = new ProposalService({ logger });
  });

  describe('calculateConsensus', () => {
    it('returns pending status for zero votes', () => {
      const proposal = createMockProposal();
      const roles = new Map<DID, UserRole>();

      const result = service.calculateConsensus(proposal, [], roles);

      expect(result.consensusReached).toBe(false);
      expect(result.approvalPercentage).toBe(0);
      expect(result.weightedApprove).toBe(0);
      expect(result.weightedReject).toBe(0);
      expect(result.voterCount).toBe(0);
      expect(result.recommendedStatus).toBe('pending');
    });

    it('returns pending status when minimum votes not met', () => {
      const proposal = createMockProposal();
      const votes = [
        createMockVote({ voterDid: makeDID('did:plc:v1') }),
        createMockVote({ voterDid: makeDID('did:plc:v2') }),
      ];
      const roles = new Map<DID, UserRole>();

      const result = service.calculateConsensus(proposal, votes, roles);

      expect(result.consensusReached).toBe(false);
      expect(result.recommendedStatus).toBe('pending');
    });

    it('approves when threshold met with minimum votes', () => {
      const proposal = createMockProposal();
      const votes = [
        createMockVote({ voterDid: makeDID('did:plc:v1'), value: 'approve' }),
        createMockVote({ voterDid: makeDID('did:plc:v2'), value: 'approve' }),
        createMockVote({ voterDid: makeDID('did:plc:v3'), value: 'approve' }),
      ];
      const roles = new Map<DID, UserRole>();

      const result = service.calculateConsensus(proposal, votes, roles);

      expect(result.consensusReached).toBe(true);
      expect(result.approvalPercentage).toBe(1.0);
      expect(result.recommendedStatus).toBe('approved');
    });

    it('rejects when rejection threshold met', () => {
      const proposal = createMockProposal();
      const votes = [
        createMockVote({ voterDid: makeDID('did:plc:v1'), value: 'reject' }),
        createMockVote({ voterDid: makeDID('did:plc:v2'), value: 'reject' }),
        createMockVote({ voterDid: makeDID('did:plc:v3'), value: 'reject' }),
      ];
      const roles = new Map<DID, UserRole>();

      const result = service.calculateConsensus(proposal, votes, roles);

      expect(result.consensusReached).toBe(true);
      expect(result.approvalPercentage).toBe(0);
      expect(result.recommendedStatus).toBe('rejected');
    });

    it('applies editor weight multiplier', () => {
      const proposal = createMockProposal();
      const editorDid = makeDID('did:plc:editor');
      const userDid = makeDID('did:plc:user');

      const votes = [
        createMockVote({ voterDid: editorDid, value: 'approve' }),
        createMockVote({ voterDid: userDid, value: 'reject' }),
        createMockVote({ voterDid: makeDID('did:plc:u2'), value: 'reject' }),
      ];

      const roles = new Map<DID, UserRole>([[editorDid, 'editor']]);

      const result = service.calculateConsensus(proposal, votes, roles);

      expect(result.weightedApprove).toBe(3.0);
      expect(result.weightedReject).toBe(2.0);
      expect(result.approvalPercentage).toBeCloseTo(0.6);
    });

    it('applies trusted contributor weight multiplier', () => {
      const proposal = createMockProposal();
      const trustedDid = makeDID('did:plc:trusted');

      const votes = [
        createMockVote({ voterDid: trustedDid, value: 'approve' }),
        createMockVote({ voterDid: makeDID('did:plc:u1'), value: 'reject' }),
        createMockVote({ voterDid: makeDID('did:plc:u2'), value: 'reject' }),
      ];

      const roles = new Map<DID, UserRole>([[trustedDid, 'trusted-contributor']]);

      const result = service.calculateConsensus(proposal, votes, roles);

      expect(result.weightedApprove).toBe(1.5);
      expect(result.weightedReject).toBe(2.0);
    });

    it('throws ValidationError for duplicate votes', () => {
      const proposal = createMockProposal();
      const duplicateDid = makeDID('did:plc:duplicate');

      const votes = [
        createMockVote({ voterDid: duplicateDid, value: 'approve' }),
        createMockVote({ voterDid: duplicateDid, value: 'approve' }),
      ];

      const roles = new Map<DID, UserRole>();

      expect(() => service.calculateConsensus(proposal, votes, roles)).toThrow(ValidationError);
      expect(() => service.calculateConsensus(proposal, votes, roles)).toThrow(
        'Duplicate vote detected'
      );
    });

    it('respects custom consensus threshold', () => {
      const customService = new ProposalService({ logger, consensusThreshold: 0.8 });
      const proposal = createMockProposal();

      const votes = [
        createMockVote({ voterDid: makeDID('did:plc:v1'), value: 'approve' }),
        createMockVote({ voterDid: makeDID('did:plc:v2'), value: 'approve' }),
        createMockVote({ voterDid: makeDID('did:plc:v3'), value: 'reject' }),
      ];

      const roles = new Map<DID, UserRole>();

      const result = customService.calculateConsensus(proposal, votes, roles);

      expect(result.approvalPercentage).toBeCloseTo(0.67);
      expect(result.recommendedStatus).toBe('pending');
    });
  });

  describe('getVoteWeight', () => {
    it('returns 3.0 for editors', () => {
      expect(service.getVoteWeight('editor')).toBe(3.0);
    });

    it('returns 1.5 for trusted contributors', () => {
      expect(service.getVoteWeight('trusted-contributor')).toBe(1.5);
    });

    it('returns 1.0 for users', () => {
      expect(service.getVoteWeight('user')).toBe(1.0);
    });

    it('respects custom weight multipliers', () => {
      const customService = new ProposalService({
        logger,
        editorWeight: 5.0,
        trustedWeight: 2.5,
      });

      expect(customService.getVoteWeight('editor')).toBe(5.0);
      expect(customService.getVoteWeight('trusted-contributor')).toBe(2.5);
    });
  });

  describe('canFastTrack', () => {
    it('returns false for zero votes', () => {
      const proposal = createMockProposal();
      const roles = new Map<DID, UserRole>();

      expect(service.canFastTrack(proposal, [], roles)).toBe(false);
    });

    it('returns true with 2+ editor approvals and no rejections', () => {
      const proposal = createMockProposal();
      const editor1 = makeDID('did:plc:editor1');
      const editor2 = makeDID('did:plc:editor2');

      const votes = [
        createMockVote({ voterDid: editor1, value: 'approve' }),
        createMockVote({ voterDid: editor2, value: 'approve' }),
      ];

      const roles = new Map<DID, UserRole>([
        [editor1, 'editor'],
        [editor2, 'editor'],
      ]);

      expect(service.canFastTrack(proposal, votes, roles)).toBe(true);
    });

    it('returns false with only 1 editor approval', () => {
      const proposal = createMockProposal();
      const editor1 = makeDID('did:plc:editor1');

      const votes = [
        createMockVote({ voterDid: editor1, value: 'approve' }),
        createMockVote({ voterDid: makeDID('did:plc:user'), value: 'approve' }),
      ];

      const roles = new Map<DID, UserRole>([[editor1, 'editor']]);

      expect(service.canFastTrack(proposal, votes, roles)).toBe(false);
    });

    it('returns false if any rejection exists', () => {
      const proposal = createMockProposal();
      const editor1 = makeDID('did:plc:editor1');
      const editor2 = makeDID('did:plc:editor2');

      const votes = [
        createMockVote({ voterDid: editor1, value: 'approve' }),
        createMockVote({ voterDid: editor2, value: 'approve' }),
        createMockVote({ voterDid: makeDID('did:plc:user'), value: 'reject' }),
      ];

      const roles = new Map<DID, UserRole>([
        [editor1, 'editor'],
        [editor2, 'editor'],
      ]);

      expect(service.canFastTrack(proposal, votes, roles)).toBe(false);
    });
  });

  describe('validateVote', () => {
    it('validates valid vote', () => {
      const vote = createMockVote();

      expect(() => service.validateVote(vote, [])).not.toThrow();
    });

    it('throws ValidationError for duplicate voter', () => {
      const voterDid = makeDID('did:plc:duplicate');
      const vote = createMockVote({ voterDid });
      const existing = [createMockVote({ voterDid })];

      expect(() => service.validateVote(vote, existing)).toThrow(ValidationError);
      expect(() => service.validateVote(vote, existing)).toThrow('already voted');
    });

    it('throws ValidationError for invalid vote value', () => {
      const invalidVote = {
        ...createMockVote(),
        value: 'invalid' as 'approve',
      };

      expect(() => service.validateVote(invalidVote, [])).toThrow(ValidationError);
      expect(() => service.validateVote(invalidVote, [])).toThrow('approve or reject');
    });

    it('throws ValidationError for non-positive weight', () => {
      const invalidVote = createMockVote({ weight: 0 });

      expect(() => service.validateVote(invalidVote, [])).toThrow(ValidationError);
      expect(() => service.validateVote(invalidVote, [])).toThrow('weight must be positive');
    });

    it('throws ValidationError for negative weight', () => {
      const invalidVote = createMockVote({ weight: -1.0 });

      expect(() => service.validateVote(invalidVote, [])).toThrow(ValidationError);
    });
  });

  describe('getConsensusThreshold', () => {
    it('returns default threshold', () => {
      expect(service.getConsensusThreshold()).toBe(0.67);
    });

    it('returns custom threshold', () => {
      const customService = new ProposalService({ logger, consensusThreshold: 0.75 });

      expect(customService.getConsensusThreshold()).toBe(0.75);
    });
  });

  describe('getMinimumVotes', () => {
    it('returns default minimum votes', () => {
      expect(service.getMinimumVotes()).toBe(3);
    });

    it('returns custom minimum votes', () => {
      const customService = new ProposalService({ logger, minimumVotes: 5 });

      expect(customService.getMinimumVotes()).toBe(5);
    });
  });
});
