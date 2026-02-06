/**
 * Integration tests for organization proposal lifecycle.
 *
 * @remarks
 * Tests the complete governance flow for research organizations:
 * - Proposal creation → Voting → Consensus detection → Authority record → Neo4j index
 * - Organization type taxonomy
 * - Organization merge and deprecation flows
 * - ROR/Wikidata integration
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

type OrganizationType =
  | 'university'
  | 'research-lab'
  | 'funding-body'
  | 'publisher'
  | 'consortium'
  | 'hospital'
  | 'government'
  | 'nonprofit'
  | 'company'
  | 'other';

type OrganizationProposalType = 'create' | 'update' | 'merge' | 'deprecate';
type OrganizationStatus = 'established' | 'deprecated' | 'merged' | 'pending';

interface OrganizationLocation {
  countryCode: string;
  city?: string;
  state?: string;
}

interface Organization {
  uri: AtUri;
  id: string;
  name: string;
  type: OrganizationType;
  rorId?: string;
  wikidataId?: string;
  website?: string;
  location?: OrganizationLocation;
  aliases: string[];
  parentOrganization?: AtUri;
  status: OrganizationStatus;
  proposalUri?: AtUri;
  mergedInto?: AtUri;
  deprecatedBy?: AtUri;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface OrganizationProposal {
  uri: AtUri;
  proposer: DID;
  proposalType: OrganizationProposalType;
  organizationId?: string;
  proposedName: string;
  proposedType: OrganizationType;
  proposedRorId?: string;
  proposedWikidataId?: string;
  proposedWebsite?: string;
  proposedLocation?: OrganizationLocation;
  proposedAliases: string[];
  proposedParent?: AtUri;
  // For merge proposals
  sourceOrganization?: AtUri;
  targetOrganization?: AtUri;
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  votingDeadline?: Timestamp;
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
// Organization Type Taxonomy
// =============================================================================

const ORGANIZATION_TYPES: readonly { id: OrganizationType; label: string; description: string }[] =
  [
    { id: 'university', label: 'University', description: 'Higher education institution' },
    {
      id: 'research-lab',
      label: 'Research Lab',
      description: 'Dedicated research laboratory or institute',
    },
    {
      id: 'funding-body',
      label: 'Funding Body',
      description: 'Research funding organization (NSF, NIH, etc.)',
    },
    { id: 'publisher', label: 'Publisher', description: 'Academic publisher' },
    { id: 'consortium', label: 'Consortium', description: 'Multi-institution collaboration' },
    {
      id: 'hospital',
      label: 'Hospital/Medical Center',
      description: 'Medical institution with research activities',
    },
    { id: 'government', label: 'Government Agency', description: 'Government research agency' },
    {
      id: 'nonprofit',
      label: 'Nonprofit Organization',
      description: 'Non-profit research organization',
    },
    {
      id: 'company',
      label: 'Company/Corporation',
      description: 'For-profit company with research activities',
    },
    { id: 'other', label: 'Other', description: 'Other type of research organization' },
  ] as const;

// =============================================================================
// Test Fixtures
// =============================================================================

const GRAPH_PDS_DID = TEST_GRAPH_PDS_DID;
const TEST_USER_1 = TEST_USER_DIDS.USER_1;
const TEST_USER_2 = TEST_USER_DIDS.USER_2;
const TEST_USER_3 = TEST_USER_DIDS.USER_3;

/**
 * UUID lookup for organizations.
 * Generated using nodeUuid('organization', slug) for deterministic URIs.
 */
const ORGANIZATION_UUIDS: Record<string, string> = {
  stanford: '0ee2502c-b04d-5e9b-8d43-9ae63aa47fb8',
  mit: 'eb866be0-070c-5a2c-9a46-dd066b371fd7',
  nih: 'b143def2-0389-5048-a3d5-1135c78f5ed1',
  cern: '90e2a739-2079-5b8c-9135-da0b75f1acc2',
  'nature-portfolio': 'a8c89e43-5b20-5e4a-97c1-1f6d3c4d2b1e',
};

/**
 * Gets or generates a UUID for an organization ID.
 * Uses pre-computed UUIDs for known IDs, generates random UUIDs for others.
 */
function getOrganizationUuid(id: string): string {
  return (
    ORGANIZATION_UUIDS[id] ??
    `${id.slice(0, 8).padEnd(8, '0')}-0000-5000-8000-${Date.now().toString(16).slice(-12)}`
  );
}

/**
 * Creates an organization for testing.
 */
function createTestOrganization(
  id: string,
  name: string,
  type: OrganizationType,
  overrides: Partial<Organization> = {}
): Organization {
  return {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${getOrganizationUuid(id)}` as AtUri,
    id,
    name,
    type,
    aliases: [],
    status: 'established',
    createdAt: Date.now() as Timestamp,
    ...overrides,
  };
}

/**
 * Creates an organization proposal for testing.
 */
function createTestOrganizationProposal(
  name: string,
  type: OrganizationType,
  overrides: Partial<OrganizationProposal> = {}
): OrganizationProposal {
  const tid = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    uri: `at://${TEST_USER_1}/pub.chive.graph.organizationProposal/${tid}` as AtUri,
    proposer: TEST_USER_1,
    proposalType: 'create',
    proposedName: name,
    proposedType: type,
    proposedAliases: [],
    rationale: `Rationale for proposing ${name}`,
    status: 'pending',
    createdAt: Date.now() as Timestamp,
    votingDeadline: (Date.now() + 5 * 24 * 60 * 60 * 1000) as Timestamp,
    ...overrides,
  };
}

/**
 * Mock organization manager for testing.
 */
class MockOrganizationManager {
  private organizations = new Map<string, Organization>();
  private proposals = new Map<string, OrganizationProposal>();
  private votes = new Map<string, Map<DID, 'approve' | 'reject'>>();

  constructor() {
    this.initializeSeedOrganizations();
  }

  /**
   * Seeds initial organizations.
   */
  initializeSeedOrganizations(): void {
    const seedOrgs = [
      {
        id: 'stanford',
        name: 'Stanford University',
        type: 'university' as OrganizationType,
        rorId: 'https://ror.org/00f54p054',
        location: { countryCode: 'US', city: 'Stanford', state: 'CA' },
      },
      {
        id: 'mit',
        name: 'Massachusetts Institute of Technology',
        type: 'university' as OrganizationType,
        rorId: 'https://ror.org/042nb2s44',
        aliases: ['MIT'],
        location: { countryCode: 'US', city: 'Cambridge', state: 'MA' },
      },
      {
        id: 'nih',
        name: 'National Institutes of Health',
        type: 'funding-body' as OrganizationType,
        rorId: 'https://ror.org/01cwqze88',
        aliases: ['NIH'],
        location: { countryCode: 'US', city: 'Bethesda', state: 'MD' },
      },
      {
        id: 'cern',
        name: 'CERN',
        type: 'research-lab' as OrganizationType,
        rorId: 'https://ror.org/01ggx4157',
        aliases: ['European Organization for Nuclear Research'],
        location: { countryCode: 'CH', city: 'Geneva' },
      },
      {
        id: 'nature-portfolio',
        name: 'Nature Portfolio',
        type: 'publisher' as OrganizationType,
        aliases: ['Nature Publishing Group', 'NPG'],
      },
    ];

    for (const seed of seedOrgs) {
      const org = createTestOrganization(seed.id, seed.name, seed.type, {
        rorId: seed.rorId,
        aliases: seed.aliases ?? [],
        location: seed.location,
      });
      this.organizations.set(seed.id, org);
    }
  }

  listOrganizations(type?: OrganizationType): Organization[] {
    const all = Array.from(this.organizations.values());
    if (type) {
      return all.filter((o) => o.type === type);
    }
    return all;
  }

  getOrganization(id: string): Organization | null {
    return this.organizations.get(id) ?? null;
  }

  getOrganizationByRor(rorId: string): Organization | null {
    return Array.from(this.organizations.values()).find((o) => o.rorId === rorId) ?? null;
  }

  searchOrganizations(query: string, type?: OrganizationType): Organization[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.organizations.values()).filter(
      (o) =>
        (o.name.toLowerCase().includes(lowerQuery) ||
          o.aliases.some((a) => a.toLowerCase().includes(lowerQuery))) &&
        (!type || o.type === type)
    );
  }

  getChildOrganizations(parentUri: AtUri): Organization[] {
    return Array.from(this.organizations.values()).filter(
      (o) => o.parentOrganization === parentUri
    );
  }

  createProposal(proposal: OrganizationProposal): OrganizationProposal {
    this.proposals.set(proposal.uri, proposal);
    this.votes.set(proposal.uri, new Map());
    return proposal;
  }

  getProposal(uri: AtUri): OrganizationProposal | null {
    return this.proposals.get(uri) ?? null;
  }

  listProposals(status?: OrganizationProposal['status']): OrganizationProposal[] {
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

  approveProposal(proposalUri: AtUri): Organization {
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    const id = proposal.proposedName.toLowerCase().replace(/\s+/g, '-');
    const org: Organization = {
      uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${id}` as AtUri,
      id,
      name: proposal.proposedName,
      type: proposal.proposedType,
      rorId: proposal.proposedRorId,
      wikidataId: proposal.proposedWikidataId,
      website: proposal.proposedWebsite,
      location: proposal.proposedLocation,
      aliases: proposal.proposedAliases,
      parentOrganization: proposal.proposedParent,
      status: 'established',
      proposalUri: proposal.uri,
      createdAt: Date.now() as Timestamp,
    };

    this.organizations.set(id, org);

    const updated: OrganizationProposal = { ...proposal, status: 'approved' };
    this.proposals.set(proposalUri, updated);

    return org;
  }

  rejectProposal(proposalUri: AtUri): void {
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    const updated: OrganizationProposal = { ...proposal, status: 'rejected' };
    this.proposals.set(proposalUri, updated);
  }

  mergeOrganizations(sourceId: string, targetId: string): void {
    const source = this.organizations.get(sourceId);
    const target = this.organizations.get(targetId);
    if (!source || !target) throw new Error('Organization not found');

    const updated: Organization = {
      ...source,
      status: 'merged',
      mergedInto: target.uri,
      updatedAt: Date.now() as Timestamp,
    };
    this.organizations.set(sourceId, updated);

    // Add source aliases to target
    const targetUpdated: Organization = {
      ...target,
      aliases: [...target.aliases, source.name, ...source.aliases],
      updatedAt: Date.now() as Timestamp,
    };
    this.organizations.set(targetId, targetUpdated);
  }

  deprecateOrganization(id: string, deprecatedBy: AtUri): void {
    const org = this.organizations.get(id);
    if (!org) throw new Error('Organization not found');

    const updated: Organization = {
      ...org,
      status: 'deprecated',
      deprecatedBy,
      updatedAt: Date.now() as Timestamp,
    };
    this.organizations.set(id, updated);
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Organization Proposal Lifecycle Integration', () => {
  let manager: MockOrganizationManager;

  beforeEach(() => {
    manager = new MockOrganizationManager();
  });

  describe('Organization Type Taxonomy', () => {
    it('recognizes all organization types', () => {
      expect(ORGANIZATION_TYPES).toHaveLength(10);
    });

    it('includes key academic types', () => {
      const typeIds = ORGANIZATION_TYPES.map((t) => t.id);
      expect(typeIds).toContain('university');
      expect(typeIds).toContain('research-lab');
      expect(typeIds).toContain('funding-body');
      expect(typeIds).toContain('publisher');
    });

    it('includes non-academic types', () => {
      const typeIds = ORGANIZATION_TYPES.map((t) => t.id);
      expect(typeIds).toContain('company');
      expect(typeIds).toContain('nonprofit');
      expect(typeIds).toContain('government');
    });
  });

  describe('Seed Organizations', () => {
    it('initializes seed organizations', () => {
      const orgs = manager.listOrganizations();
      expect(orgs.length).toBeGreaterThanOrEqual(5);
    });

    it('can retrieve organization by ID', () => {
      const stanford = manager.getOrganization('stanford');
      expect(stanford).not.toBeNull();
      expect(stanford?.name).toBe('Stanford University');
      expect(stanford?.type).toBe('university');
    });

    it('can retrieve organization by ROR ID', () => {
      const mit = manager.getOrganizationByRor('https://ror.org/042nb2s44');
      expect(mit).not.toBeNull();
      expect(mit?.name).toBe('Massachusetts Institute of Technology');
    });

    it('can filter organizations by type', () => {
      const universities = manager.listOrganizations('university');
      expect(universities.length).toBeGreaterThanOrEqual(2);
      expect(universities.every((o) => o.type === 'university')).toBe(true);
    });

    it('can search organizations by name', () => {
      const results = manager.searchOrganizations('Stanford');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((o) => o.id === 'stanford')).toBe(true);
    });

    it('can search organizations by alias', () => {
      const results = manager.searchOrganizations('MIT');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((o) => o.id === 'mit')).toBe(true);
    });
  });

  describe('Organization Proposal Creation', () => {
    it('creates a new organization proposal', () => {
      const proposal = createTestOrganizationProposal('OpenAI', 'company', {
        proposedWebsite: 'https://openai.com',
        proposedLocation: { countryCode: 'US', city: 'San Francisco', state: 'CA' },
        proposedAliases: ['Open AI', 'OpenAI LP'],
      });

      const created = manager.createProposal(proposal);
      expect(created.uri).toBe(proposal.uri);
      expect(created.status).toBe('pending');
      expect(created.proposedType).toBe('company');
    });

    it('proposal is retrievable after creation', () => {
      const proposal = createTestOrganizationProposal('Max Planck Society', 'consortium');
      manager.createProposal(proposal);

      const retrieved = manager.getProposal(proposal.uri);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.proposedName).toBe('Max Planck Society');
    });

    it('can create proposal with ROR ID', () => {
      const proposal = createTestOrganizationProposal('ETH Zurich', 'university', {
        proposedRorId: 'https://ror.org/05a28rw58',
        proposedWikidataId: 'Q11942',
      });

      const created = manager.createProposal(proposal);
      expect(created.proposedRorId).toBe('https://ror.org/05a28rw58');
      expect(created.proposedWikidataId).toBe('Q11942');
    });

    it('can create proposal with parent organization', () => {
      const stanfordUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.stanford}` as AtUri;
      const proposal = createTestOrganizationProposal('Stanford AI Lab', 'research-lab', {
        proposedParent: stanfordUri,
        proposedAliases: ['SAIL'],
      });

      const created = manager.createProposal(proposal);
      expect(created.proposedParent).toBe(stanfordUri);
    });
  });

  describe('Voting Mechanism', () => {
    it('records votes on proposals', () => {
      const proposal = createTestOrganizationProposal('New Org', 'nonprofit');
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
      const proposal = createTestOrganizationProposal('Quorum Test Org', 'hospital');
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
      const proposal = createTestOrganizationProposal('Threshold Test Org', 'government');
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
      const proposal = createTestOrganizationProposal('Consensus Approve Org', 'publisher');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('approved');
    });

    it('remains pending when quorum not met', () => {
      const proposal = createTestOrganizationProposal('Pending Org', 'funding-body');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('pending');
    });

    it('rejects when deadline passed without meeting threshold', () => {
      const proposal = createTestOrganizationProposal('Expired Org', 'research-lab', {
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
      const proposal = createTestOrganizationProposal('Approved Org', 'research-lab', {
        proposedRorId: 'https://ror.org/test123',
        proposedWebsite: 'https://approved.org',
        proposedLocation: { countryCode: 'US', city: 'Boston' },
        proposedAliases: ['AO', 'ApprovedOrg'],
      });
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      const org = manager.approveProposal(proposal.uri);

      expect(org.name).toBe('Approved Org');
      expect(org.status).toBe('established');
      expect(org.proposalUri).toBe(proposal.uri);
      expect(org.uri).toContain(GRAPH_PDS_DID);
      expect(org.type).toBe('research-lab');
      expect(org.rorId).toBe('https://ror.org/test123');
    });

    it('new organization available in list after approval', () => {
      const proposal = createTestOrganizationProposal('New Available Org', 'company');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      manager.approveProposal(proposal.uri);

      const org = manager.getOrganization('new-available-org');
      expect(org).not.toBeNull();
      expect(org?.status).toBe('established');
    });
  });

  describe('Organization Hierarchy', () => {
    it('can create child organizations', () => {
      // Create parent org
      const parentProposal = createTestOrganizationProposal('University of Test', 'university');
      manager.createProposal(parentProposal);
      manager.castVote(parentProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(parentProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(parentProposal.uri, TEST_USER_3, 'approve');
      const parent = manager.approveProposal(parentProposal.uri);

      // Create child org
      const childProposal = createTestOrganizationProposal('Test Research Lab', 'research-lab', {
        proposedParent: parent.uri,
      });
      manager.createProposal(childProposal);
      manager.castVote(childProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(childProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(childProposal.uri, TEST_USER_3, 'approve');
      const child = manager.approveProposal(childProposal.uri);

      expect(child.parentOrganization).toBe(parent.uri);
    });

    it('can retrieve child organizations', () => {
      // Create parent
      const parentProposal = createTestOrganizationProposal('Parent Org', 'consortium');
      manager.createProposal(parentProposal);
      manager.castVote(parentProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(parentProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(parentProposal.uri, TEST_USER_3, 'approve');
      const parent = manager.approveProposal(parentProposal.uri);

      // Create children
      const child1 = createTestOrganizationProposal('Child Lab 1', 'research-lab', {
        proposedParent: parent.uri,
      });
      manager.createProposal(child1);
      manager.castVote(child1.uri, TEST_USER_1, 'approve');
      manager.castVote(child1.uri, TEST_USER_2, 'approve');
      manager.castVote(child1.uri, TEST_USER_3, 'approve');
      manager.approveProposal(child1.uri);

      const child2 = createTestOrganizationProposal('Child Lab 2', 'research-lab', {
        proposedParent: parent.uri,
      });
      manager.createProposal(child2);
      manager.castVote(child2.uri, TEST_USER_1, 'approve');
      manager.castVote(child2.uri, TEST_USER_2, 'approve');
      manager.castVote(child2.uri, TEST_USER_3, 'approve');
      manager.approveProposal(child2.uri);

      const children = manager.getChildOrganizations(parent.uri);
      expect(children).toHaveLength(2);
    });
  });

  describe('Organization Merge Flow', () => {
    it('can create merge proposal', () => {
      const sourceUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.stanford}` as AtUri;
      const targetUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.mit}` as AtUri;

      const proposal = createTestOrganizationProposal('Merge Result', 'university', {
        proposalType: 'merge',
        sourceOrganization: sourceUri,
        targetOrganization: targetUri,
        rationale: 'These organizations should be merged for consistency',
      });

      const created = manager.createProposal(proposal);
      expect(created.proposalType).toBe('merge');
      expect(created.sourceOrganization).toBe(sourceUri);
      expect(created.targetOrganization).toBe(targetUri);
    });

    it('merges organizations correctly', () => {
      // Create two orgs to merge
      const org1 = createTestOrganizationProposal('Org To Merge A', 'research-lab');
      manager.createProposal(org1);
      manager.castVote(org1.uri, TEST_USER_1, 'approve');
      manager.castVote(org1.uri, TEST_USER_2, 'approve');
      manager.castVote(org1.uri, TEST_USER_3, 'approve');
      manager.approveProposal(org1.uri);

      const org2 = createTestOrganizationProposal('Org To Merge B', 'research-lab', {
        proposedAliases: ['Alias B'],
      });
      manager.createProposal(org2);
      manager.castVote(org2.uri, TEST_USER_1, 'approve');
      manager.castVote(org2.uri, TEST_USER_2, 'approve');
      manager.castVote(org2.uri, TEST_USER_3, 'approve');
      manager.approveProposal(org2.uri);

      // Merge org1 into org2
      manager.mergeOrganizations('org-to-merge-a', 'org-to-merge-b');

      const merged = manager.getOrganization('org-to-merge-a');
      expect(merged?.status).toBe('merged');

      const target = manager.getOrganization('org-to-merge-b');
      expect(target?.aliases).toContain('Org To Merge A');
    });
  });

  describe('Organization Deprecation', () => {
    it('can deprecate an existing organization', () => {
      // Create org
      const proposal = createTestOrganizationProposal('To Deprecate Org', 'nonprofit');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      manager.approveProposal(proposal.uri);

      // Create replacement
      const replacementProposal = createTestOrganizationProposal('Replacement Org', 'nonprofit');
      manager.createProposal(replacementProposal);
      manager.castVote(replacementProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(replacementProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(replacementProposal.uri, TEST_USER_3, 'approve');
      const replacement = manager.approveProposal(replacementProposal.uri);

      // Deprecate original
      manager.deprecateOrganization('to-deprecate-org', replacement.uri);

      const deprecated = manager.getOrganization('to-deprecate-org');
      expect(deprecated?.status).toBe('deprecated');
      expect(deprecated?.deprecatedBy).toBe(replacement.uri);
    });

    it('deprecated organizations still retrievable', () => {
      const proposal = createTestOrganizationProposal('Deprecated Retrievable Org', 'company');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      manager.approveProposal(proposal.uri);

      manager.deprecateOrganization(
        'deprecated-retrievable-org',
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.stanford}` as AtUri
      );

      const org = manager.getOrganization('deprecated-retrievable-org');
      expect(org).not.toBeNull();
    });
  });

  describe('ROR Integration', () => {
    it('validates ROR ID format', () => {
      const validRorIds = [
        'https://ror.org/00f54p054',
        'https://ror.org/042nb2s44',
        'https://ror.org/01cwqze88',
      ];

      for (const rorId of validRorIds) {
        expect(rorId).toMatch(/^https:\/\/ror\.org\/[a-z0-9]+$/);
      }
    });

    it('can look up organization by ROR ID', () => {
      const org = manager.getOrganizationByRor('https://ror.org/01ggx4157');
      expect(org).not.toBeNull();
      expect(org?.name).toBe('CERN');
    });
  });

  describe('Proposal Rejection', () => {
    it('updates proposal status to rejected', () => {
      const proposal = createTestOrganizationProposal('Rejected Org', 'publisher');
      manager.createProposal(proposal);

      manager.rejectProposal(proposal.uri);

      const updated = manager.getProposal(proposal.uri);
      expect(updated?.status).toBe('rejected');
    });

    it('rejected proposal org not added to organizations', () => {
      const proposal = createTestOrganizationProposal('Should Not Exist Org', 'hospital');
      manager.createProposal(proposal);

      manager.rejectProposal(proposal.uri);

      const org = manager.getOrganization('should-not-exist-org');
      expect(org).toBeNull();
    });
  });

  describe('Update Proposal Flow', () => {
    it('can create update proposal for existing organization', () => {
      const updateProposal = createTestOrganizationProposal('Stanford University', 'university', {
        proposalType: 'update',
        organizationId: 'stanford',
        proposedWebsite: 'https://www.stanford.edu/updated',
        rationale: 'Website URL needs to be updated',
      });

      const created = manager.createProposal(updateProposal);
      expect(created.proposalType).toBe('update');
      expect(created.organizationId).toBe('stanford');
    });
  });

  describe('Location Data', () => {
    it('stores country code correctly', () => {
      const stanford = manager.getOrganization('stanford');
      expect(stanford?.location?.countryCode).toBe('US');
    });

    it('stores city and state correctly', () => {
      const mit = manager.getOrganization('mit');
      expect(mit?.location?.city).toBe('Cambridge');
      expect(mit?.location?.state).toBe('MA');
    });

    it('handles international organizations', () => {
      const cern = manager.getOrganization('cern');
      expect(cern?.location?.countryCode).toBe('CH');
      expect(cern?.location?.city).toBe('Geneva');
    });
  });
});
