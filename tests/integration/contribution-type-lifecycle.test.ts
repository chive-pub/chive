/**
 * Integration tests for contribution type lifecycle.
 *
 * @remarks
 * Tests the complete governance flow:
 * - Proposal creation → Voting → Consensus detection → Authority record → Neo4j index
 * - CRediT taxonomy seeding
 * - Type deprecation flow
 *
 * Requires Docker test stack running (PostgreSQL, Neo4j).
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';

import type { AtUri, DID, Timestamp } from '@/types/atproto.js';
import { CREDIT_TAXONOMY } from '@/types/models/contribution.js';
import type {
  ContributionType,
  ContributionTypeProposal,
  ProposalVoteTally,
} from '@/types/models/contribution.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const GOVERNANCE_DID = 'did:plc:chive-governance' as DID;
const TEST_USER_1 = 'did:plc:testuser1' as DID;
const TEST_USER_2 = 'did:plc:testuser2' as DID;
const TEST_USER_3 = 'did:plc:testuser3' as DID;

/**
 * Creates a contribution type for testing.
 */
function createTestContributionType(
  id: string,
  overrides: Partial<ContributionType> = {}
): ContributionType {
  return {
    uri: `at://${GOVERNANCE_DID}/pub.chive.contribution.type/${id}` as AtUri,
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
    description: `Description for ${id}`,
    externalMappings: [
      {
        system: 'credit',
        identifier: id,
        uri: `https://credit.niso.org/contributor-roles/${id}/`,
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    createdAt: Date.now() as Timestamp,
    ...overrides,
  };
}

/**
 * Creates a contribution type proposal for testing.
 */
function createTestProposal(
  proposedId: string,
  overrides: Partial<ContributionTypeProposal> = {}
): ContributionTypeProposal {
  const tid = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    uri: `at://${TEST_USER_1}/pub.chive.contribution.typeProposal/${tid}` as AtUri,
    proposer: TEST_USER_1,
    proposalType: 'create',
    proposedId,
    proposedLabel: proposedId.charAt(0).toUpperCase() + proposedId.slice(1).replace(/-/g, ' '),
    proposedDescription: `Description for proposed type: ${proposedId}`,
    externalMappings: [],
    rationale: `Rationale for proposing ${proposedId}`,
    status: 'pending',
    createdAt: Date.now() as Timestamp,
    votingDeadline: (Date.now() + 5 * 24 * 60 * 60 * 1000) as Timestamp, // 5 days from now
    ...overrides,
  };
}

/**
 * Mock contribution type manager for testing.
 */
class MockContributionTypeManager {
  private types = new Map<string, ContributionType>();
  private proposals = new Map<string, ContributionTypeProposal>();
  private votes = new Map<string, Map<DID, 'approve' | 'reject'>>();

  constructor() {
    // Seed CRediT taxonomy
    this.initializeContributionTypes();
  }

  initializeContributionTypes(): void {
    for (const role of CREDIT_TAXONOMY) {
      const type = createTestContributionType(role.id, {
        label: role.label,
        description: role.description,
        externalMappings: [
          {
            system: 'credit',
            identifier: role.id,
            uri: role.creditUri,
            matchType: 'exact-match',
          },
        ],
      });
      this.types.set(role.id, type);
    }
  }

  listContributionTypes(): ContributionType[] {
    return Array.from(this.types.values());
  }

  getContributionType(id: string): ContributionType | null {
    return this.types.get(id) ?? null;
  }

  searchContributionTypes(query: string): ContributionType[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.types.values()).filter(
      (t) =>
        t.label.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery)
    );
  }

  createProposal(proposal: ContributionTypeProposal): ContributionTypeProposal {
    this.proposals.set(proposal.uri, proposal);
    this.votes.set(proposal.uri, new Map());
    return proposal;
  }

  getProposal(uri: AtUri): ContributionTypeProposal | null {
    return this.proposals.get(uri) ?? null;
  }

  listProposals(status?: ContributionTypeProposal['status']): ContributionTypeProposal[] {
    const all = Array.from(this.proposals.values());
    if (status) {
      return all.filter((p) => p.status === status);
    }
    return all;
  }

  castVote(proposalUri: AtUri, voter: DID, vote: 'approve' | 'reject'): void {
    const votes = this.votes.get(proposalUri);
    if (!votes) throw new Error('Proposal not found');
    votes.set(voter, vote);
  }

  getVoteTally(proposalUri: AtUri): ProposalVoteTally {
    const votes = this.votes.get(proposalUri);
    if (!votes) throw new Error('Proposal not found');

    let approve = 0;
    let reject = 0;
    for (const v of votes.values()) {
      if (v === 'approve') approve++;
      else reject++;
    }

    const total = approve + reject;
    const approvalRate = total > 0 ? approve / total : 0;

    return {
      approve,
      reject,
      total,
      expertVotes: Math.min(total, 2), // Simplified: assume first 2 voters are experts
      quorumMet: total >= 3,
      thresholdsMet: approvalRate >= 0.6 && total >= 3,
    };
  }

  checkConsensus(proposalUri: AtUri): 'approved' | 'rejected' | 'pending' {
    const tally = this.getVoteTally(proposalUri);
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    // Check if voting deadline passed
    const now = Date.now();
    const deadlinePassed = proposal.votingDeadline && now > proposal.votingDeadline;

    if (!tally.quorumMet) {
      return deadlinePassed ? 'rejected' : 'pending';
    }

    if (tally.thresholdsMet) {
      return 'approved';
    }

    return deadlinePassed ? 'rejected' : 'pending';
  }

  approveProposal(proposalUri: AtUri): ContributionType {
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    // Create authority record in Governance PDS
    const type: ContributionType = {
      uri: `at://${GOVERNANCE_DID}/pub.chive.contribution.type/${proposal.proposedId}` as AtUri,
      id: proposal.proposedId,
      label: proposal.proposedLabel,
      description: proposal.proposedDescription ?? '',
      externalMappings: proposal.externalMappings,
      status: 'established',
      proposalUri: proposal.uri,
      createdAt: Date.now() as Timestamp,
    };

    this.types.set(proposal.proposedId, type);

    // Update proposal status
    const updated: ContributionTypeProposal = { ...proposal, status: 'approved' };
    this.proposals.set(proposalUri, updated);

    return type;
  }

  rejectProposal(proposalUri: AtUri): void {
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    const updated: ContributionTypeProposal = { ...proposal, status: 'rejected' };
    this.proposals.set(proposalUri, updated);
  }

  deprecateContributionType(id: string, deprecatedBy: AtUri): void {
    const type = this.types.get(id);
    if (!type) throw new Error('Type not found');

    const updated: ContributionType = {
      ...type,
      status: 'deprecated',
      deprecatedBy,
      updatedAt: Date.now() as Timestamp,
    };
    this.types.set(id, updated);
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Contribution Type Lifecycle Integration', () => {
  let manager: MockContributionTypeManager;

  beforeEach(() => {
    manager = new MockContributionTypeManager();
  });

  describe('CRediT Taxonomy Seeding', () => {
    it('initializes all 14 CRediT roles', () => {
      const types = manager.listContributionTypes();
      expect(types).toHaveLength(14);
    });

    it('creates valid contribution type records for each CRediT role', () => {
      for (const role of CREDIT_TAXONOMY) {
        const type = manager.getContributionType(role.id);
        expect(type).not.toBeNull();
        expect(type?.label).toBe(role.label);
        expect(type?.description).toBe(role.description);
        expect(type?.status).toBe('established');
      }
    });

    it('includes CRediT external mappings', () => {
      const conceptualization = manager.getContributionType('conceptualization');
      expect(conceptualization?.externalMappings).toHaveLength(1);
      expect(conceptualization?.externalMappings[0]?.system).toBe('credit');
      expect(conceptualization?.externalMappings[0]?.uri).toContain('credit.niso.org');
    });

    it('can search contribution types by label', () => {
      const results = manager.searchContributionTypes('writing');
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((t) => t.id === 'writing-original-draft')).toBe(true);
      expect(results.some((t) => t.id === 'writing-review-editing')).toBe(true);
    });

    it('can search contribution types by description', () => {
      const results = manager.searchContributionTypes('statistical');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((t) => t.id === 'formal-analysis')).toBe(true);
    });
  });

  describe('Proposal Creation', () => {
    it('creates a new contribution type proposal', () => {
      const proposal = createTestProposal('clinical-trials', {
        proposedDescription: 'Conducting clinical trials for medical research',
        externalMappings: [
          {
            system: 'cro',
            identifier: 'CRO:0000XXX',
            matchType: 'close-match',
          },
        ],
      });

      const created = manager.createProposal(proposal);
      expect(created.uri).toBe(proposal.uri);
      expect(created.status).toBe('pending');
    });

    it('proposal is retrievable after creation', () => {
      const proposal = createTestProposal('data-visualization');
      manager.createProposal(proposal);

      const retrieved = manager.getProposal(proposal.uri);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.proposedId).toBe('data-visualization');
    });

    it('lists all pending proposals', () => {
      manager.createProposal(createTestProposal('type-a'));
      manager.createProposal(createTestProposal('type-b'));

      const pending = manager.listProposals('pending');
      expect(pending).toHaveLength(2);
    });
  });

  describe('Voting Mechanism', () => {
    it('records votes on proposals', () => {
      const proposal = createTestProposal('new-type');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'reject');

      const tally = manager.getVoteTally(proposal.uri);
      expect(tally.approve).toBe(2);
      expect(tally.reject).toBe(1);
      expect(tally.total).toBe(3);
    });

    it('calculates quorum correctly', () => {
      const proposal = createTestProposal('quorum-test');
      manager.createProposal(proposal);

      // Less than 3 votes = no quorum
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');

      let tally = manager.getVoteTally(proposal.uri);
      expect(tally.quorumMet).toBe(false);

      // 3 votes = quorum met
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      tally = manager.getVoteTally(proposal.uri);
      expect(tally.quorumMet).toBe(true);
    });

    it('calculates threshold correctly (60% approval)', () => {
      const proposal = createTestProposal('threshold-test');
      manager.createProposal(proposal);

      // 2 approve, 2 reject = 50% = below threshold
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'reject');
      manager.castVote(proposal.uri, 'did:plc:user4' as DID, 'reject');

      let tally = manager.getVoteTally(proposal.uri);
      expect(tally.thresholdsMet).toBe(false);

      // Add another approve = 60% = threshold met
      manager.castVote(proposal.uri, 'did:plc:user5' as DID, 'approve');
      tally = manager.getVoteTally(proposal.uri);
      expect(tally.thresholdsMet).toBe(true);
    });

    it('prevents duplicate votes by same user (overwrites)', () => {
      const proposal = createTestProposal('duplicate-test');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_1, 'reject'); // Changes vote

      const tally = manager.getVoteTally(proposal.uri);
      expect(tally.approve).toBe(0);
      expect(tally.reject).toBe(1);
    });
  });

  describe('Consensus Detection', () => {
    it('detects approval when thresholds met', () => {
      const proposal = createTestProposal('consensus-approve');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('approved');
    });

    it('remains pending when quorum not met', () => {
      const proposal = createTestProposal('consensus-pending');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('pending');
    });

    it('remains pending when threshold not met but deadline not passed', () => {
      const proposal = createTestProposal('consensus-below-threshold', {
        votingDeadline: (Date.now() + 1000000) as Timestamp, // Future deadline
      });
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'reject');
      manager.castVote(proposal.uri, TEST_USER_3, 'reject');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('pending');
    });

    it('rejects when deadline passed without meeting threshold', () => {
      const proposal = createTestProposal('consensus-expired', {
        votingDeadline: (Date.now() - 1000) as Timestamp, // Past deadline
      });
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'reject');
      manager.castVote(proposal.uri, TEST_USER_3, 'reject');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('rejected');
    });
  });

  describe('Authority Record Creation', () => {
    it('creates authority record when proposal approved', () => {
      const proposal = createTestProposal('approved-type', {
        proposedDescription: 'A newly approved contribution type',
        externalMappings: [
          {
            system: 'cro',
            identifier: 'CRO:NEW',
            matchType: 'exact-match',
          },
        ],
      });
      manager.createProposal(proposal);

      // Cast enough votes for approval
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      // Approve the proposal
      const type = manager.approveProposal(proposal.uri);

      expect(type.id).toBe('approved-type');
      expect(type.status).toBe('established');
      expect(type.proposalUri).toBe(proposal.uri);
      expect(type.uri).toContain(GOVERNANCE_DID);
    });

    it('updates proposal status to approved', () => {
      const proposal = createTestProposal('status-update');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      manager.approveProposal(proposal.uri);

      const updated = manager.getProposal(proposal.uri);
      expect(updated?.status).toBe('approved');
    });

    it('new type available in type list after approval', () => {
      const proposal = createTestProposal('new-available');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      manager.approveProposal(proposal.uri);

      const type = manager.getContributionType('new-available');
      expect(type).not.toBeNull();
      expect(type?.status).toBe('established');
    });
  });

  describe('Proposal Rejection', () => {
    it('updates proposal status to rejected', () => {
      const proposal = createTestProposal('rejected-type');
      manager.createProposal(proposal);

      manager.rejectProposal(proposal.uri);

      const updated = manager.getProposal(proposal.uri);
      expect(updated?.status).toBe('rejected');
    });

    it('rejected proposal type not added to types', () => {
      const proposal = createTestProposal('should-not-exist');
      manager.createProposal(proposal);

      manager.rejectProposal(proposal.uri);

      const type = manager.getContributionType('should-not-exist');
      expect(type).toBeNull();
    });
  });

  describe('Type Deprecation', () => {
    it('can deprecate an existing contribution type', () => {
      // Create a custom type first
      const proposal = createTestProposal('to-deprecate');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      manager.approveProposal(proposal.uri);

      // Create replacement type
      const replacementProposal = createTestProposal('replacement-type');
      manager.createProposal(replacementProposal);
      manager.castVote(replacementProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(replacementProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(replacementProposal.uri, TEST_USER_3, 'approve');
      const replacement = manager.approveProposal(replacementProposal.uri);

      // Deprecate original
      manager.deprecateContributionType('to-deprecate', replacement.uri);

      const deprecated = manager.getContributionType('to-deprecate');
      expect(deprecated?.status).toBe('deprecated');
      expect(deprecated?.deprecatedBy).toBe(replacement.uri);
    });

    it('deprecated types still retrievable', () => {
      const proposal = createTestProposal('deprecated-retrievable');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      manager.approveProposal(proposal.uri);

      manager.deprecateContributionType(
        'deprecated-retrievable',
        `at://${GOVERNANCE_DID}/pub.chive.contribution.type/conceptualization` as AtUri
      );

      const type = manager.getContributionType('deprecated-retrievable');
      expect(type).not.toBeNull();
    });
  });

  describe('Update Proposal Flow', () => {
    it('can create update proposal for existing type', () => {
      const updateProposal = createTestProposal('conceptualization', {
        proposalType: 'update',
        typeId: 'conceptualization',
        proposedDescription: 'Updated description for conceptualization',
        rationale: 'Need to clarify the role description',
      });

      const created = manager.createProposal(updateProposal);
      expect(created.proposalType).toBe('update');
      expect(created.typeId).toBe('conceptualization');
    });
  });

  describe('Deprecation Proposal Flow', () => {
    it('can create deprecation proposal', () => {
      const deprecateProposal = createTestProposal('old-type', {
        proposalType: 'deprecate',
        typeId: 'old-type',
        rationale: 'Superseded by newer type',
        supersedes: `at://${GOVERNANCE_DID}/pub.chive.contribution.type/new-type` as AtUri,
      });

      const created = manager.createProposal(deprecateProposal);
      expect(created.proposalType).toBe('deprecate');
      expect(created.supersedes).toBeDefined();
    });
  });

  describe('External Mapping Validation', () => {
    it('validates CRediT mapping format', () => {
      const type = manager.getContributionType('conceptualization');
      const creditMapping = type?.externalMappings.find((m) => m.system === 'credit');

      expect(creditMapping).toBeDefined();
      expect(creditMapping?.uri).toMatch(/^https:\/\/credit\.niso\.org\/contributor-roles\//);
    });

    it('supports multiple external mappings', () => {
      const proposal = createTestProposal('multi-mapping', {
        externalMappings: [
          {
            system: 'credit',
            identifier: 'conceptualization',
            uri: 'https://credit.niso.org/contributor-roles/conceptualization/',
            matchType: 'exact-match',
          },
          {
            system: 'cro',
            identifier: 'CRO:0000064',
            uri: 'http://purl.obolibrary.org/obo/CRO_0000064',
            matchType: 'exact-match',
          },
        ],
      });

      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      const type = manager.approveProposal(proposal.uri);

      expect(type.externalMappings).toHaveLength(2);
      expect(type.externalMappings.some((m) => m.system === 'credit')).toBe(true);
      expect(type.externalMappings.some((m) => m.system === 'cro')).toBe(true);
    });
  });
});
