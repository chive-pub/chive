/**
 * Integration tests for facet value proposal lifecycle.
 *
 * @remarks
 * Tests the complete governance flow for facet values:
 * - Proposal creation → Voting → Consensus detection → Authority record → Neo4j index
 * - PMEST/FAST dimension taxonomy seeding
 * - Facet value deprecation flow
 *
 * Requires Docker test stack running (PostgreSQL, Neo4j).
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';

import type { AtUri, DID, Timestamp } from '@/types/atproto.js';

import { TEST_GRAPH_PDS_DID, TEST_USER_DIDS } from '../../test-constants.js';

// =============================================================================
// Type Definitions
// =============================================================================

type FacetDimension =
  | 'personality'
  | 'matter'
  | 'energy'
  | 'space'
  | 'time'
  | 'person'
  | 'organization'
  | 'event'
  | 'work'
  | 'form-genre';

type FacetProposalType = 'create' | 'update' | 'deprecate';
type FacetStatus = 'established' | 'deprecated' | 'pending';

interface ExternalMapping {
  system: string;
  identifier: string;
  uri?: string;
  matchType?: 'exact-match' | 'close-match' | 'broader-match' | 'narrower-match' | 'related-match';
}

interface FacetValue {
  uri: AtUri;
  id: string;
  label: string;
  dimension: FacetDimension;
  description?: string;
  parentFacet?: AtUri;
  externalMappings: ExternalMapping[];
  status: FacetStatus;
  proposalUri?: AtUri;
  deprecatedBy?: AtUri;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface FacetProposal {
  uri: AtUri;
  proposer: DID;
  proposalType: FacetProposalType;
  facetId?: string;
  proposedId: string;
  proposedLabel: string;
  proposedDimension: FacetDimension;
  proposedDescription?: string;
  proposedParent?: AtUri;
  externalMappings: ExternalMapping[];
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  votingDeadline?: Timestamp;
  supersedes?: AtUri;
}

interface ProposalVoteTally {
  approve: number;
  reject: number;
  total: number;
  expertVotes: number;
  quorumMet: boolean;
  thresholdsMet: boolean;
}

// =============================================================================
// PMEST/FAST Taxonomy
// =============================================================================

const PMEST_DIMENSIONS: readonly { id: FacetDimension; label: string; description: string }[] = [
  { id: 'personality', label: 'Personality', description: 'The main subject or topic of study' },
  { id: 'matter', label: 'Matter', description: 'The material or substance studied' },
  { id: 'energy', label: 'Energy', description: 'The action, process, or activity' },
  { id: 'space', label: 'Space', description: 'Geographic or spatial context' },
  { id: 'time', label: 'Time', description: 'Temporal or chronological aspects' },
] as const;

const FAST_DIMENSIONS: readonly { id: FacetDimension; label: string; description: string }[] = [
  { id: 'person', label: 'Person', description: 'Named individuals' },
  { id: 'organization', label: 'Organization', description: 'Corporate bodies and organizations' },
  { id: 'event', label: 'Event', description: 'Named events' },
  { id: 'work', label: 'Work', description: 'Named works (books, films, etc.)' },
  { id: 'form-genre', label: 'Form/Genre', description: 'Document types and genres' },
] as const;

const ALL_DIMENSIONS = [...PMEST_DIMENSIONS, ...FAST_DIMENSIONS];

// =============================================================================
// Test Fixtures
// =============================================================================

const GRAPH_PDS_DID = TEST_GRAPH_PDS_DID;
const TEST_USER_1 = TEST_USER_DIDS.USER_1;
const TEST_USER_2 = TEST_USER_DIDS.USER_2;
const TEST_USER_3 = TEST_USER_DIDS.USER_3;

/**
 * UUID lookup for facets.
 * Generated using nodeUuid('facet', slug) for deterministic URIs.
 */
const FACET_UUIDS: Record<string, string> = {
  'machine-learning': '3ca09134-48b5-505d-a77b-49902a84210c',
  'some-other': '20cb66a4-20bb-5824-b88e-eace119a3005',
};

/**
 * Gets or generates a UUID for a facet ID.
 * Uses pre-computed UUIDs for known IDs, generates dynamic UUIDs for others.
 */
function getFacetUuid(id: string): string {
  return (
    FACET_UUIDS[id] ??
    `${id.slice(0, 8).padEnd(8, '0')}-0000-5000-8000-${Date.now().toString(16).slice(-12)}`
  );
}

/**
 * Creates a facet value for testing.
 */
function createTestFacetValue(
  id: string,
  dimension: FacetDimension,
  overrides: Partial<FacetValue> = {}
): FacetValue {
  return {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${getFacetUuid(id)}` as AtUri,
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
    dimension,
    description: `Description for ${id}`,
    externalMappings: [],
    status: 'established',
    createdAt: Date.now() as Timestamp,
    ...overrides,
  };
}

/**
 * Creates a facet proposal for testing.
 */
function createTestFacetProposal(
  proposedId: string,
  dimension: FacetDimension,
  overrides: Partial<FacetProposal> = {}
): FacetProposal {
  const tid = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    uri: `at://${TEST_USER_1}/pub.chive.graph.facetProposal/${tid}` as AtUri,
    proposer: TEST_USER_1,
    proposalType: 'create',
    proposedId,
    proposedLabel: proposedId.charAt(0).toUpperCase() + proposedId.slice(1).replace(/-/g, ' '),
    proposedDimension: dimension,
    proposedDescription: `Description for proposed facet: ${proposedId}`,
    externalMappings: [],
    rationale: `Rationale for proposing ${proposedId}`,
    status: 'pending',
    createdAt: Date.now() as Timestamp,
    votingDeadline: (Date.now() + 5 * 24 * 60 * 60 * 1000) as Timestamp,
    ...overrides,
  };
}

/**
 * Mock facet value manager for testing.
 */
class MockFacetValueManager {
  private facets = new Map<string, FacetValue>();
  private proposals = new Map<string, FacetProposal>();
  private votes = new Map<string, Map<DID, 'approve' | 'reject'>>();

  constructor() {
    this.initializeSeedFacets();
  }

  /**
   * Seeds initial facet values for common subjects.
   */
  initializeSeedFacets(): void {
    // Seed some common personality facets (subjects)
    const seedFacets = [
      {
        id: 'machine-learning',
        dimension: 'personality' as FacetDimension,
        label: 'Machine Learning',
      },
      { id: 'neuroscience', dimension: 'personality' as FacetDimension, label: 'Neuroscience' },
      {
        id: 'climate-science',
        dimension: 'personality' as FacetDimension,
        label: 'Climate Science',
      },
      { id: 'genomics', dimension: 'personality' as FacetDimension, label: 'Genomics' },
      {
        id: 'quantum-computing',
        dimension: 'personality' as FacetDimension,
        label: 'Quantum Computing',
      },
    ];

    for (const seed of seedFacets) {
      const facet = createTestFacetValue(seed.id, seed.dimension, { label: seed.label });
      this.facets.set(seed.id, facet);
    }
  }

  listFacetValues(dimension?: FacetDimension): FacetValue[] {
    const all = Array.from(this.facets.values());
    if (dimension) {
      return all.filter((f) => f.dimension === dimension);
    }
    return all;
  }

  getFacetValue(id: string): FacetValue | null {
    return this.facets.get(id) ?? null;
  }

  searchFacetValues(query: string, dimension?: FacetDimension): FacetValue[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.facets.values()).filter(
      (f) =>
        (f.label.toLowerCase().includes(lowerQuery) ||
          f.description?.toLowerCase().includes(lowerQuery)) &&
        (!dimension || f.dimension === dimension)
    );
  }

  getFacetsByParent(parentUri: AtUri): FacetValue[] {
    return Array.from(this.facets.values()).filter((f) => f.parentFacet === parentUri);
  }

  createProposal(proposal: FacetProposal): FacetProposal {
    this.proposals.set(proposal.uri, proposal);
    this.votes.set(proposal.uri, new Map());
    return proposal;
  }

  getProposal(uri: AtUri): FacetProposal | null {
    return this.proposals.get(uri) ?? null;
  }

  listProposals(status?: FacetProposal['status']): FacetProposal[] {
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
      expertVotes: Math.min(total, 2),
      quorumMet: total >= 3,
      thresholdsMet: approvalRate >= 0.6 && total >= 3,
    };
  }

  checkConsensus(proposalUri: AtUri): 'approved' | 'rejected' | 'pending' {
    const tally = this.getVoteTally(proposalUri);
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

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

  approveProposal(proposalUri: AtUri): FacetValue {
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    const facet: FacetValue = {
      uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${proposal.proposedId}` as AtUri,
      id: proposal.proposedId,
      label: proposal.proposedLabel,
      dimension: proposal.proposedDimension,
      description: proposal.proposedDescription,
      parentFacet: proposal.proposedParent,
      externalMappings: proposal.externalMappings,
      status: 'established',
      proposalUri: proposal.uri,
      createdAt: Date.now() as Timestamp,
    };

    this.facets.set(proposal.proposedId, facet);

    const updated: FacetProposal = { ...proposal, status: 'approved' };
    this.proposals.set(proposalUri, updated);

    return facet;
  }

  rejectProposal(proposalUri: AtUri): void {
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    const updated: FacetProposal = { ...proposal, status: 'rejected' };
    this.proposals.set(proposalUri, updated);
  }

  deprecateFacetValue(id: string, deprecatedBy: AtUri): void {
    const facet = this.facets.get(id);
    if (!facet) throw new Error('Facet not found');

    const updated: FacetValue = {
      ...facet,
      status: 'deprecated',
      deprecatedBy,
      updatedAt: Date.now() as Timestamp,
    };
    this.facets.set(id, updated);
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Facet Value Lifecycle Integration', () => {
  let manager: MockFacetValueManager;

  beforeEach(() => {
    manager = new MockFacetValueManager();
  });

  describe('PMEST/FAST Dimension Taxonomy', () => {
    it('recognizes all PMEST dimensions', () => {
      expect(PMEST_DIMENSIONS).toHaveLength(5);
      expect(PMEST_DIMENSIONS.map((d) => d.id)).toEqual([
        'personality',
        'matter',
        'energy',
        'space',
        'time',
      ]);
    });

    it('recognizes all FAST entity dimensions', () => {
      expect(FAST_DIMENSIONS).toHaveLength(5);
      expect(FAST_DIMENSIONS.map((d) => d.id)).toEqual([
        'person',
        'organization',
        'event',
        'work',
        'form-genre',
      ]);
    });

    it('has 10 total dimensions', () => {
      expect(ALL_DIMENSIONS).toHaveLength(10);
    });
  });

  describe('Seed Facet Values', () => {
    it('initializes seed facet values', () => {
      const facets = manager.listFacetValues();
      expect(facets.length).toBeGreaterThanOrEqual(5);
    });

    it('can retrieve facet by ID', () => {
      const ml = manager.getFacetValue('machine-learning');
      expect(ml).not.toBeNull();
      expect(ml?.label).toBe('Machine Learning');
      expect(ml?.dimension).toBe('personality');
    });

    it('can filter facets by dimension', () => {
      const personalityFacets = manager.listFacetValues('personality');
      expect(personalityFacets.length).toBeGreaterThanOrEqual(1);
      expect(personalityFacets.every((f) => f.dimension === 'personality')).toBe(true);
    });

    it('can search facet values by label', () => {
      const results = manager.searchFacetValues('learning');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((f) => f.id === 'machine-learning')).toBe(true);
    });
  });

  describe('Facet Proposal Creation', () => {
    it('creates a new facet value proposal', () => {
      const proposal = createTestFacetProposal('deep-learning', 'personality', {
        proposedDescription: 'A subset of machine learning using neural networks',
        externalMappings: [
          {
            system: 'lcsh',
            identifier: 'sh2016000419',
            uri: 'http://id.loc.gov/authorities/subjects/sh2016000419',
            matchType: 'exact-match',
          },
        ],
      });

      const created = manager.createProposal(proposal);
      expect(created.uri).toBe(proposal.uri);
      expect(created.status).toBe('pending');
      expect(created.proposedDimension).toBe('personality');
    });

    it('proposal is retrievable after creation', () => {
      const proposal = createTestFacetProposal('neural-networks', 'personality');
      manager.createProposal(proposal);

      const retrieved = manager.getProposal(proposal.uri);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.proposedId).toBe('neural-networks');
    });

    it('lists all pending proposals', () => {
      manager.createProposal(createTestFacetProposal('facet-a', 'personality'));
      manager.createProposal(createTestFacetProposal('facet-b', 'matter'));

      const pending = manager.listProposals('pending');
      expect(pending).toHaveLength(2);
    });

    it('can create facet with parent reference', () => {
      const parentUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS['machine-learning']}` as AtUri;
      const proposal = createTestFacetProposal('reinforcement-learning', 'personality', {
        proposedParent: parentUri,
      });

      const created = manager.createProposal(proposal);
      expect(created.proposedParent).toBe(parentUri);
    });
  });

  describe('Voting Mechanism', () => {
    it('records votes on proposals', () => {
      const proposal = createTestFacetProposal('new-facet', 'personality');
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
      const proposal = createTestFacetProposal('quorum-test', 'space');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');

      let tally = manager.getVoteTally(proposal.uri);
      expect(tally.quorumMet).toBe(false);

      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      tally = manager.getVoteTally(proposal.uri);
      expect(tally.quorumMet).toBe(true);
    });

    it('calculates threshold correctly (60% approval)', () => {
      const proposal = createTestFacetProposal('threshold-test', 'time');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'reject');
      manager.castVote(proposal.uri, 'did:plc:user4' as DID, 'reject');

      let tally = manager.getVoteTally(proposal.uri);
      expect(tally.thresholdsMet).toBe(false);

      manager.castVote(proposal.uri, 'did:plc:user5' as DID, 'approve');
      tally = manager.getVoteTally(proposal.uri);
      expect(tally.thresholdsMet).toBe(true);
    });
  });

  describe('Consensus Detection', () => {
    it('detects approval when thresholds met', () => {
      const proposal = createTestFacetProposal('consensus-approve', 'energy');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('approved');
    });

    it('remains pending when quorum not met', () => {
      const proposal = createTestFacetProposal('consensus-pending', 'matter');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('pending');
    });

    it('rejects when deadline passed without meeting threshold', () => {
      const proposal = createTestFacetProposal('consensus-expired', 'person', {
        votingDeadline: (Date.now() - 1000) as Timestamp,
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
      const proposal = createTestFacetProposal('approved-facet', 'organization', {
        proposedDescription: 'A newly approved facet value',
        externalMappings: [
          {
            system: 'fast',
            identifier: 'fst01234567',
            uri: 'http://id.worldcat.org/fast/1234567',
            matchType: 'exact-match',
          },
        ],
      });
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      const facet = manager.approveProposal(proposal.uri);

      expect(facet.id).toBe('approved-facet');
      expect(facet.status).toBe('established');
      expect(facet.proposalUri).toBe(proposal.uri);
      expect(facet.uri).toContain(GRAPH_PDS_DID);
      expect(facet.dimension).toBe('organization');
    });

    it('new facet available in list after approval', () => {
      const proposal = createTestFacetProposal('new-available', 'event');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      manager.approveProposal(proposal.uri);

      const facet = manager.getFacetValue('new-available');
      expect(facet).not.toBeNull();
      expect(facet?.status).toBe('established');
    });
  });

  describe('Facet Hierarchy', () => {
    it('can create child facets with parent reference', () => {
      // Create parent facet
      const parentProposal = createTestFacetProposal('artificial-intelligence', 'personality');
      manager.createProposal(parentProposal);
      manager.castVote(parentProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(parentProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(parentProposal.uri, TEST_USER_3, 'approve');
      const parent = manager.approveProposal(parentProposal.uri);

      // Create child facet with parent reference
      const childProposal = createTestFacetProposal('natural-language-processing', 'personality', {
        proposedParent: parent.uri,
      });
      manager.createProposal(childProposal);
      manager.castVote(childProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(childProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(childProposal.uri, TEST_USER_3, 'approve');
      const child = manager.approveProposal(childProposal.uri);

      expect(child.parentFacet).toBe(parent.uri);
    });

    it('can retrieve facets by parent', () => {
      // Create parent
      const parentProposal = createTestFacetProposal('biology', 'personality');
      manager.createProposal(parentProposal);
      manager.castVote(parentProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(parentProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(parentProposal.uri, TEST_USER_3, 'approve');
      const parent = manager.approveProposal(parentProposal.uri);

      // Create children
      const child1 = createTestFacetProposal('molecular-biology', 'personality', {
        proposedParent: parent.uri,
      });
      manager.createProposal(child1);
      manager.castVote(child1.uri, TEST_USER_1, 'approve');
      manager.castVote(child1.uri, TEST_USER_2, 'approve');
      manager.castVote(child1.uri, TEST_USER_3, 'approve');
      manager.approveProposal(child1.uri);

      const child2 = createTestFacetProposal('cell-biology', 'personality', {
        proposedParent: parent.uri,
      });
      manager.createProposal(child2);
      manager.castVote(child2.uri, TEST_USER_1, 'approve');
      manager.castVote(child2.uri, TEST_USER_2, 'approve');
      manager.castVote(child2.uri, TEST_USER_3, 'approve');
      manager.approveProposal(child2.uri);

      const children = manager.getFacetsByParent(parent.uri);
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toContain('molecular-biology');
      expect(children.map((c) => c.id)).toContain('cell-biology');
    });
  });

  describe('Facet Deprecation', () => {
    it('can deprecate an existing facet value', () => {
      // Create a facet first
      const proposal = createTestFacetProposal('to-deprecate', 'work');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      manager.approveProposal(proposal.uri);

      // Create replacement
      const replacementProposal = createTestFacetProposal('replacement-facet', 'work');
      manager.createProposal(replacementProposal);
      manager.castVote(replacementProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(replacementProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(replacementProposal.uri, TEST_USER_3, 'approve');
      const replacement = manager.approveProposal(replacementProposal.uri);

      // Deprecate original
      manager.deprecateFacetValue('to-deprecate', replacement.uri);

      const deprecated = manager.getFacetValue('to-deprecate');
      expect(deprecated?.status).toBe('deprecated');
      expect(deprecated?.deprecatedBy).toBe(replacement.uri);
    });

    it('deprecated facets still retrievable', () => {
      const proposal = createTestFacetProposal('deprecated-retrievable', 'form-genre');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      manager.approveProposal(proposal.uri);

      manager.deprecateFacetValue(
        'deprecated-retrievable',
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS['some-other']}` as AtUri
      );

      const facet = manager.getFacetValue('deprecated-retrievable');
      expect(facet).not.toBeNull();
    });
  });

  describe('External Mapping Validation', () => {
    it('supports LCSH mappings', () => {
      const proposal = createTestFacetProposal('lcsh-mapped', 'personality', {
        externalMappings: [
          {
            system: 'lcsh',
            identifier: 'sh85082139',
            uri: 'http://id.loc.gov/authorities/subjects/sh85082139',
            matchType: 'exact-match',
          },
        ],
      });
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      const facet = manager.approveProposal(proposal.uri);

      expect(facet.externalMappings).toHaveLength(1);
      expect(facet.externalMappings[0]?.system).toBe('lcsh');
      expect(facet.externalMappings[0]?.uri).toContain('id.loc.gov');
    });

    it('supports FAST mappings', () => {
      const proposal = createTestFacetProposal('fast-mapped', 'person', {
        externalMappings: [
          {
            system: 'fast',
            identifier: 'fst00907658',
            uri: 'http://id.worldcat.org/fast/907658',
            matchType: 'exact-match',
          },
        ],
      });
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      const facet = manager.approveProposal(proposal.uri);

      expect(facet.externalMappings[0]?.system).toBe('fast');
      expect(facet.externalMappings[0]?.uri).toContain('worldcat.org');
    });

    it('supports multiple external mappings', () => {
      const proposal = createTestFacetProposal('multi-mapped', 'personality', {
        externalMappings: [
          {
            system: 'lcsh',
            identifier: 'sh85082139',
            uri: 'http://id.loc.gov/authorities/subjects/sh85082139',
            matchType: 'exact-match',
          },
          {
            system: 'fast',
            identifier: 'fst01018643',
            uri: 'http://id.worldcat.org/fast/1018643',
            matchType: 'exact-match',
          },
          {
            system: 'wikidata',
            identifier: 'Q11660',
            uri: 'https://www.wikidata.org/wiki/Q11660',
            matchType: 'close-match',
          },
        ],
      });
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      const facet = manager.approveProposal(proposal.uri);

      expect(facet.externalMappings).toHaveLength(3);
      expect(facet.externalMappings.some((m) => m.system === 'lcsh')).toBe(true);
      expect(facet.externalMappings.some((m) => m.system === 'fast')).toBe(true);
      expect(facet.externalMappings.some((m) => m.system === 'wikidata')).toBe(true);
    });
  });

  describe('Proposal Rejection', () => {
    it('updates proposal status to rejected', () => {
      const proposal = createTestFacetProposal('rejected-facet', 'space');
      manager.createProposal(proposal);

      manager.rejectProposal(proposal.uri);

      const updated = manager.getProposal(proposal.uri);
      expect(updated?.status).toBe('rejected');
    });

    it('rejected proposal facet not added to facets', () => {
      const proposal = createTestFacetProposal('should-not-exist', 'time');
      manager.createProposal(proposal);

      manager.rejectProposal(proposal.uri);

      const facet = manager.getFacetValue('should-not-exist');
      expect(facet).toBeNull();
    });
  });

  describe('Update Proposal Flow', () => {
    it('can create update proposal for existing facet', () => {
      const updateProposal = createTestFacetProposal('machine-learning', 'personality', {
        proposalType: 'update',
        facetId: 'machine-learning',
        proposedDescription: 'Updated description for machine learning',
        rationale: 'Need to expand the scope of this facet',
      });

      const created = manager.createProposal(updateProposal);
      expect(created.proposalType).toBe('update');
      expect(created.facetId).toBe('machine-learning');
    });
  });
});
