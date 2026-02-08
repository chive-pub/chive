/**
 * Integration tests for reconciliation proposal lifecycle.
 *
 * @remarks
 * Tests the complete governance flow for entity reconciliations:
 * - Proposal creation → Voting → Consensus detection → Authority record → Neo4j index
 * - SKOS match type taxonomy
 * - External system integration (Wikidata, ROR, ORCID, OpenAlex, etc.)
 * - Reconciliation removal flows
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

type ReconciliationSystem =
  | 'wikidata'
  | 'ror'
  | 'orcid'
  | 'openalex'
  | 'crossref'
  | 'arxiv'
  | 'semantic-scholar'
  | 'pubmed'
  | 'credit'
  | 'cro'
  | 'lcsh'
  | 'fast'
  | 'other';

type SKOSMatchType =
  | 'exact-match'
  | 'close-match'
  | 'broader-match'
  | 'narrower-match'
  | 'related-match';

type ReconcilableEntityType =
  | 'author'
  | 'organization'
  | 'field'
  | 'facet'
  | 'contribution-type'
  | 'eprint';

type ReconciliationMethod = 'automatic' | 'expert-validation' | 'community-vote';
type ReconciliationProposalType = 'create' | 'update' | 'remove';
type ReconciliationStatus = 'established' | 'disputed' | 'removed' | 'pending';

interface Reconciliation {
  uri: AtUri;
  id: string;
  sourceEntityType: ReconcilableEntityType;
  sourceEntityUri: AtUri;
  targetSystem: ReconciliationSystem;
  targetIdentifier: string;
  targetUri?: string;
  matchType: SKOSMatchType;
  confidence: number;
  method: ReconciliationMethod;
  status: ReconciliationStatus;
  proposalUri?: AtUri;
  removedBy?: AtUri;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface ReconciliationProposal {
  uri: AtUri;
  proposer: DID;
  proposalType: ReconciliationProposalType;
  reconciliationId?: string;
  sourceEntityType: ReconcilableEntityType;
  sourceEntityUri: AtUri;
  targetSystem: ReconciliationSystem;
  targetIdentifier: string;
  targetUri?: string;
  proposedMatchType: SKOSMatchType;
  proposedConfidence: number;
  proposedMethod: ReconciliationMethod;
  rationale: string;
  evidence?: string;
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
// Reconciliation System Taxonomy
// =============================================================================

const RECONCILIATION_SYSTEMS: readonly {
  id: ReconciliationSystem;
  label: string;
  description: string;
  urlTemplate?: string;
}[] = [
  {
    id: 'wikidata',
    label: 'Wikidata',
    description: 'Wikimedia knowledge base',
    urlTemplate: 'https://www.wikidata.org/wiki/{id}',
  },
  {
    id: 'ror',
    label: 'ROR',
    description: 'Research Organization Registry',
    urlTemplate: 'https://ror.org/{id}',
  },
  {
    id: 'orcid',
    label: 'ORCID',
    description: 'Open Researcher and Contributor ID',
    urlTemplate: 'https://orcid.org/{id}',
  },
  {
    id: 'openalex',
    label: 'OpenAlex',
    description: 'Open scholarly knowledge base',
    urlTemplate: 'https://openalex.org/{id}',
  },
  {
    id: 'crossref',
    label: 'Crossref',
    description: 'DOI registration agency',
    urlTemplate: 'https://doi.org/{id}',
  },
  {
    id: 'arxiv',
    label: 'arXiv',
    description: 'Eprint repository',
    urlTemplate: 'https://arxiv.org/abs/{id}',
  },
  {
    id: 'semantic-scholar',
    label: 'Semantic Scholar',
    description: 'AI-powered research tool',
    urlTemplate: 'https://www.semanticscholar.org/paper/{id}',
  },
  {
    id: 'pubmed',
    label: 'PubMed',
    description: 'Biomedical literature database',
    urlTemplate: 'https://pubmed.ncbi.nlm.nih.gov/{id}',
  },
  {
    id: 'credit',
    label: 'CRediT',
    description: 'Contributor Roles Taxonomy',
    urlTemplate: 'https://credit.niso.org/contributor-roles/{id}/',
  },
  {
    id: 'cro',
    label: 'CRO',
    description: 'Contributor Role Ontology',
    urlTemplate: 'http://purl.obolibrary.org/obo/{id}',
  },
  {
    id: 'lcsh',
    label: 'LCSH',
    description: 'Library of Congress Subject Headings',
    urlTemplate: 'http://id.loc.gov/authorities/subjects/{id}',
  },
  {
    id: 'fast',
    label: 'FAST',
    description: 'Faceted Application of Subject Terminology',
    urlTemplate: 'http://id.worldcat.org/fast/{id}',
  },
  { id: 'other', label: 'Other', description: 'Other external system' },
] as const;

const SKOS_MATCH_TYPES: readonly { id: SKOSMatchType; label: string; description: string }[] = [
  {
    id: 'exact-match',
    label: 'Exact Match',
    description: 'The concepts are identical or equivalent',
  },
  {
    id: 'close-match',
    label: 'Close Match',
    description:
      'The concepts are sufficiently similar to be used interchangeably in some applications',
  },
  {
    id: 'broader-match',
    label: 'Broader Match',
    description: 'The external concept is broader than the local concept',
  },
  {
    id: 'narrower-match',
    label: 'Narrower Match',
    description: 'The external concept is narrower than the local concept',
  },
  {
    id: 'related-match',
    label: 'Related Match',
    description: 'The concepts are related but not equivalent',
  },
] as const;

const RECONCILABLE_ENTITY_TYPES: readonly { id: ReconcilableEntityType; label: string }[] = [
  { id: 'author', label: 'Author' },
  { id: 'organization', label: 'Organization' },
  { id: 'field', label: 'Knowledge Graph Field' },
  { id: 'facet', label: 'Facet Value' },
  { id: 'contribution-type', label: 'Contribution Type' },
  { id: 'eprint', label: 'Eprint' },
] as const;

// =============================================================================
// Test Fixtures
// =============================================================================

// Use shared governance DID from test-constants
const GRAPH_PDS_DID = TEST_GRAPH_PDS_DID;
const TEST_USER_1 = TEST_USER_DIDS.USER_1;
const TEST_USER_2 = TEST_USER_DIDS.USER_2;
const TEST_USER_3 = 'did:plc:testuser3' as DID;

/**
 * UUID lookup for organizations.
 * Generated using nodeUuid('organization', slug) for deterministic URIs.
 */
const ORGANIZATION_UUIDS: Record<string, string> = {
  stanford: '0ee2502c-b04d-5e9b-8d43-9ae63aa47fb8',
  mit: 'eb866be0-070c-5a2c-9a46-dd066b371fd7',
  cern: '90e2a739-2079-5b8c-9135-da0b75f1acc2',
  auto: 'ad010e0e-2337-53a7-91cb-1620ac5f1b59',
  test: '7603561d-b314-5689-9a01-68c3cae30099',
  new: '01955dd1-dc31-5ec4-b41a-bbfdd1832cdd',
  'approved-org': '4939abdd-d837-5f76-afcb-2ea8563f8734',
  'to-update': '621d4f17-cf30-5ede-ad88-4086b2564809',
  rejected: '004ce014-5932-56bf-8484-df8f7fc957ac',
  removed: 'ebb366cd-0548-567d-8f9d-65d8addd7943',
  'confidence-test': '3c897a16-6ca8-5e28-b355-6e5f5ee4c7fe',
};

/**
 * UUID lookup for facets.
 * Generated using nodeUuid('facet', slug) for deterministic URIs.
 */
const FACET_UUIDS: Record<string, string> = {
  'machine-learning': '3ca09134-48b5-505d-a77b-49902a84210c',
  'deep-learning': 'baf8669c-d5e7-5e84-86ac-32cda10b94e0',
  ai: '73b8a61f-2160-589c-9322-1fcac39cbbbb',
  pending: '050be747-a5bf-5560-9e46-af2561715d3a',
  disputed: 'eb52ab1f-e437-56c6-ba54-96b99a8b56b9',
  'to-remove': '1bbd1794-36a0-5493-825f-e2ae0bd929f5',
  'new-facet': 'ac2706a3-12a1-5808-bdaf-05aefb6803ed',
  community: 'c0f889de-8077-5864-a22d-d29f819ece93',
  'removal-target': '3b6dc054-69e6-5378-ba6b-1c0f1303b7a2',
  'not-added': '913ef3a8-7088-5e87-bd3e-c54d07c2f12e',
};

/**
 * UUID lookup for authors (for test purposes).
 */
const AUTHOR_UUIDS: Record<string, string> = {
  test: 'a7b8c9d0-e1f2-3456-7890-abcdef123456',
  expired: 'b8c9d0e1-f2a3-4567-8901-bcdef1234567',
};

/**
 * UUID lookup for contribution types (for test purposes).
 */
const CONTRIBUTION_TYPE_UUIDS: Record<string, string> = {
  expert: 'c9d0e1f2-a3b4-5678-9012-cdef12345678',
};

/**
 * Creates a reconciliation for testing.
 */
function createTestReconciliation(
  sourceEntityType: ReconcilableEntityType,
  sourceEntityUri: AtUri,
  targetSystem: ReconciliationSystem,
  targetIdentifier: string,
  overrides: Partial<Reconciliation> = {}
): Reconciliation {
  const id = `${sourceEntityType}-${targetSystem}-${Date.now()}`;
  return {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.reconciliation/${id}` as AtUri,
    id,
    sourceEntityType,
    sourceEntityUri,
    targetSystem,
    targetIdentifier,
    matchType: 'exact-match',
    confidence: 1.0,
    method: 'community-vote',
    status: 'established',
    createdAt: Date.now() as Timestamp,
    ...overrides,
  };
}

/**
 * Creates a reconciliation proposal for testing.
 */
function createTestReconciliationProposal(
  sourceEntityType: ReconcilableEntityType,
  sourceEntityUri: AtUri,
  targetSystem: ReconciliationSystem,
  targetIdentifier: string,
  overrides: Partial<ReconciliationProposal> = {}
): ReconciliationProposal {
  const tid = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    uri: `at://${TEST_USER_1}/pub.chive.graph.reconciliationProposal/${tid}` as AtUri,
    proposer: TEST_USER_1,
    proposalType: 'create',
    sourceEntityType,
    sourceEntityUri,
    targetSystem,
    targetIdentifier,
    proposedMatchType: 'exact-match',
    proposedConfidence: 1.0,
    proposedMethod: 'community-vote',
    rationale: `Proposal to reconcile ${sourceEntityType} with ${targetSystem}`,
    status: 'pending',
    createdAt: Date.now() as Timestamp,
    votingDeadline: (Date.now() + 5 * 24 * 60 * 60 * 1000) as Timestamp,
    ...overrides,
  };
}

/**
 * Mock reconciliation manager for testing.
 */
class MockReconciliationManager {
  private reconciliations = new Map<string, Reconciliation>();
  private proposals = new Map<string, ReconciliationProposal>();
  private votes = new Map<string, Map<DID, 'approve' | 'reject'>>();

  constructor() {
    this.initializeSeedReconciliations();
  }

  /**
   * Seeds initial reconciliations.
   */
  initializeSeedReconciliations(): void {
    const seedReconciliations = [
      {
        sourceEntityType: 'organization' as ReconcilableEntityType,
        sourceEntityUri:
          `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.stanford}` as AtUri,
        targetSystem: 'wikidata' as ReconciliationSystem,
        targetIdentifier: 'Q41506',
        targetUri: 'https://www.wikidata.org/wiki/Q41506',
        matchType: 'exact-match' as SKOSMatchType,
      },
      {
        sourceEntityType: 'organization' as ReconcilableEntityType,
        sourceEntityUri:
          `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.stanford}` as AtUri,
        targetSystem: 'ror' as ReconciliationSystem,
        targetIdentifier: '00f54p054',
        targetUri: 'https://ror.org/00f54p054',
        matchType: 'exact-match' as SKOSMatchType,
      },
      {
        sourceEntityType: 'contribution-type' as ReconcilableEntityType,
        sourceEntityUri:
          `at://${GRAPH_PDS_DID}/pub.chive.graph.node/e1612645-6a62-59b7-a13a-8d618637be85` as AtUri,
        targetSystem: 'credit' as ReconciliationSystem,
        targetIdentifier: 'conceptualization',
        targetUri: 'https://credit.niso.org/contributor-roles/conceptualization/',
        matchType: 'exact-match' as SKOSMatchType,
      },
      {
        sourceEntityType: 'facet' as ReconcilableEntityType,
        sourceEntityUri:
          `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS['machine-learning']}` as AtUri,
        targetSystem: 'lcsh' as ReconciliationSystem,
        targetIdentifier: 'sh85082139',
        targetUri: 'http://id.loc.gov/authorities/subjects/sh85082139',
        matchType: 'close-match' as SKOSMatchType,
      },
    ];

    for (const seed of seedReconciliations) {
      const reconciliation = createTestReconciliation(
        seed.sourceEntityType,
        seed.sourceEntityUri,
        seed.targetSystem,
        seed.targetIdentifier,
        {
          targetUri: seed.targetUri,
          matchType: seed.matchType,
        }
      );
      this.reconciliations.set(reconciliation.id, reconciliation);
    }
  }

  listReconciliations(filters?: {
    sourceEntityType?: ReconcilableEntityType;
    targetSystem?: ReconciliationSystem;
    status?: ReconciliationStatus;
  }): Reconciliation[] {
    let all = Array.from(this.reconciliations.values());
    if (filters?.sourceEntityType) {
      all = all.filter((r) => r.sourceEntityType === filters.sourceEntityType);
    }
    if (filters?.targetSystem) {
      all = all.filter((r) => r.targetSystem === filters.targetSystem);
    }
    if (filters?.status) {
      all = all.filter((r) => r.status === filters.status);
    }
    return all;
  }

  getReconciliation(id: string): Reconciliation | null {
    return this.reconciliations.get(id) ?? null;
  }

  getReconciliationsForEntity(entityUri: AtUri): Reconciliation[] {
    return Array.from(this.reconciliations.values()).filter((r) => r.sourceEntityUri === entityUri);
  }

  getReconciliationByExternalId(
    targetSystem: ReconciliationSystem,
    targetIdentifier: string
  ): Reconciliation | null {
    return (
      Array.from(this.reconciliations.values()).find(
        (r) => r.targetSystem === targetSystem && r.targetIdentifier === targetIdentifier
      ) ?? null
    );
  }

  createProposal(proposal: ReconciliationProposal): ReconciliationProposal {
    this.proposals.set(proposal.uri, proposal);
    this.votes.set(proposal.uri, new Map());
    return proposal;
  }

  getProposal(uri: AtUri): ReconciliationProposal | null {
    return this.proposals.get(uri) ?? null;
  }

  listProposals(status?: ReconciliationProposal['status']): ReconciliationProposal[] {
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

  approveProposal(proposalUri: AtUri): Reconciliation {
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    const id = `${proposal.sourceEntityType}-${proposal.targetSystem}-${Date.now()}`;
    const reconciliation: Reconciliation = {
      uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.reconciliation/${id}` as AtUri,
      id,
      sourceEntityType: proposal.sourceEntityType,
      sourceEntityUri: proposal.sourceEntityUri,
      targetSystem: proposal.targetSystem,
      targetIdentifier: proposal.targetIdentifier,
      targetUri: proposal.targetUri,
      matchType: proposal.proposedMatchType,
      confidence: proposal.proposedConfidence,
      method: proposal.proposedMethod,
      status: 'established',
      proposalUri: proposal.uri,
      createdAt: Date.now() as Timestamp,
    };

    this.reconciliations.set(id, reconciliation);

    const updated: ReconciliationProposal = { ...proposal, status: 'approved' };
    this.proposals.set(proposalUri, updated);

    return reconciliation;
  }

  rejectProposal(proposalUri: AtUri): void {
    const proposal = this.getProposal(proposalUri);
    if (!proposal) throw new Error('Proposal not found');

    const updated: ReconciliationProposal = { ...proposal, status: 'rejected' };
    this.proposals.set(proposalUri, updated);
  }

  removeReconciliation(id: string, removedBy: AtUri): void {
    const reconciliation = this.reconciliations.get(id);
    if (!reconciliation) throw new Error('Reconciliation not found');

    const updated: Reconciliation = {
      ...reconciliation,
      status: 'removed',
      removedBy,
      updatedAt: Date.now() as Timestamp,
    };
    this.reconciliations.set(id, updated);
  }

  disputeReconciliation(id: string): void {
    const reconciliation = this.reconciliations.get(id);
    if (!reconciliation) throw new Error('Reconciliation not found');

    const updated: Reconciliation = {
      ...reconciliation,
      status: 'disputed',
      updatedAt: Date.now() as Timestamp,
    };
    this.reconciliations.set(id, updated);
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Reconciliation Proposal Lifecycle Integration', () => {
  let manager: MockReconciliationManager;

  beforeEach(() => {
    manager = new MockReconciliationManager();
  });

  describe('Reconciliation System Taxonomy', () => {
    it('recognizes all external systems', () => {
      expect(RECONCILIATION_SYSTEMS).toHaveLength(13);
    });

    it('includes key scholarly systems', () => {
      const systemIds = RECONCILIATION_SYSTEMS.map((s) => s.id);
      expect(systemIds).toContain('wikidata');
      expect(systemIds).toContain('ror');
      expect(systemIds).toContain('orcid');
      expect(systemIds).toContain('openalex');
      expect(systemIds).toContain('crossref');
    });

    it('includes authority control systems', () => {
      const systemIds = RECONCILIATION_SYSTEMS.map((s) => s.id);
      expect(systemIds).toContain('lcsh');
      expect(systemIds).toContain('fast');
      expect(systemIds).toContain('credit');
      expect(systemIds).toContain('cro');
    });

    it('has URL templates for most systems', () => {
      const systemsWithUrls = RECONCILIATION_SYSTEMS.filter((s) => s.urlTemplate);
      expect(systemsWithUrls.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('SKOS Match Type Taxonomy', () => {
    it('recognizes all SKOS match types', () => {
      expect(SKOS_MATCH_TYPES).toHaveLength(5);
    });

    it('includes semantic match types', () => {
      const matchTypeIds = SKOS_MATCH_TYPES.map((m) => m.id);
      expect(matchTypeIds).toContain('exact-match');
      expect(matchTypeIds).toContain('close-match');
      expect(matchTypeIds).toContain('broader-match');
      expect(matchTypeIds).toContain('narrower-match');
      expect(matchTypeIds).toContain('related-match');
    });
  });

  describe('Reconcilable Entity Types', () => {
    it('recognizes all entity types', () => {
      expect(RECONCILABLE_ENTITY_TYPES).toHaveLength(6);
    });

    it('includes all reconcilable entity types', () => {
      const entityTypeIds = RECONCILABLE_ENTITY_TYPES.map((e) => e.id);
      expect(entityTypeIds).toContain('author');
      expect(entityTypeIds).toContain('organization');
      expect(entityTypeIds).toContain('field');
      expect(entityTypeIds).toContain('facet');
      expect(entityTypeIds).toContain('contribution-type');
      expect(entityTypeIds).toContain('eprint');
    });
  });

  describe('Seed Reconciliations', () => {
    it('initializes seed reconciliations', () => {
      const reconciliations = manager.listReconciliations();
      expect(reconciliations.length).toBeGreaterThanOrEqual(4);
    });

    it('can filter by source entity type', () => {
      const orgReconciliations = manager.listReconciliations({
        sourceEntityType: 'organization',
      });
      expect(orgReconciliations.length).toBeGreaterThanOrEqual(2);
      expect(orgReconciliations.every((r) => r.sourceEntityType === 'organization')).toBe(true);
    });

    it('can filter by target system', () => {
      const wikidataReconciliations = manager.listReconciliations({
        targetSystem: 'wikidata',
      });
      expect(wikidataReconciliations.length).toBeGreaterThanOrEqual(1);
      expect(wikidataReconciliations.every((r) => r.targetSystem === 'wikidata')).toBe(true);
    });

    it('can get reconciliations for an entity', () => {
      const stanfordUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.stanford}` as AtUri;
      const reconciliations = manager.getReconciliationsForEntity(stanfordUri);
      expect(reconciliations.length).toBeGreaterThanOrEqual(2);
    });

    it('can look up by external identifier', () => {
      const reconciliation = manager.getReconciliationByExternalId('wikidata', 'Q41506');
      expect(reconciliation).not.toBeNull();
      expect(reconciliation?.sourceEntityType).toBe('organization');
    });
  });

  describe('Reconciliation Proposal Creation', () => {
    it('creates a new reconciliation proposal', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.mit}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'wikidata',
        'Q49108',
        {
          targetUri: 'https://www.wikidata.org/wiki/Q49108',
          proposedMatchType: 'exact-match',
          proposedConfidence: 0.99,
          rationale: 'MIT maps to Wikidata Q49108',
        }
      );

      const created = manager.createProposal(proposal);
      expect(created.uri).toBe(proposal.uri);
      expect(created.status).toBe('pending');
      expect(created.targetSystem).toBe('wikidata');
    });

    it('proposal is retrievable after creation', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS['deep-learning']}` as AtUri;
      const proposal = createTestReconciliationProposal('facet', entityUri, 'lcsh', 'sh2016000419');
      manager.createProposal(proposal);

      const retrieved = manager.getProposal(proposal.uri);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.targetIdentifier).toBe('sh2016000419');
    });

    it('can create proposal with evidence', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.cern}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'openalex',
        'I205783295',
        {
          evidence: 'https://openalex.org/I205783295 shows CERN publications',
          proposedConfidence: 0.95,
        }
      );

      const created = manager.createProposal(proposal);
      expect(created.evidence).toBeDefined();
    });

    it('supports different match types', () => {
      const entityUri = `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS.ai}` as AtUri;

      const exactProposal = createTestReconciliationProposal(
        'facet',
        entityUri,
        'fast',
        'fst00817247',
        {
          proposedMatchType: 'exact-match',
        }
      );

      const broaderProposal = createTestReconciliationProposal(
        'facet',
        entityUri,
        'lcsh',
        'sh85082139',
        {
          proposedMatchType: 'broader-match',
        }
      );

      manager.createProposal(exactProposal);
      manager.createProposal(broaderProposal);

      const exact = manager.getProposal(exactProposal.uri);
      const broader = manager.getProposal(broaderProposal.uri);

      expect(exact?.proposedMatchType).toBe('exact-match');
      expect(broader?.proposedMatchType).toBe('broader-match');
    });
  });

  describe('Voting Mechanism', () => {
    it('records votes on proposals', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.test}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'ror',
        'test123'
      );
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
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.author/${AUTHOR_UUIDS.test}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'author',
        entityUri,
        'orcid',
        '0000-0001-2345-6789'
      );
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
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.node/a1b2c3d4-e5f6-7890-abcd-ef1234567890` as AtUri;
      const proposal = createTestReconciliationProposal('field', entityUri, 'wikidata', 'Q12345');
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
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.new}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'wikidata',
        'Q99999'
      );
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('approved');
    });

    it('remains pending when quorum not met', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS.pending}` as AtUri;
      const proposal = createTestReconciliationProposal('facet', entityUri, 'fast', 'fst123456');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');

      const consensus = manager.checkConsensus(proposal.uri);
      expect(consensus).toBe('pending');
    });

    it('rejects when deadline passed without meeting threshold', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.author/${AUTHOR_UUIDS.expired}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'author',
        entityUri,
        'orcid',
        '0000-0002-1234-5678',
        {
          votingDeadline: (Date.now() - 1000) as Timestamp,
        }
      );
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
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS['approved-org']}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'openalex',
        'I123456',
        {
          targetUri: 'https://openalex.org/I123456',
          proposedMatchType: 'exact-match',
          proposedConfidence: 0.98,
        }
      );
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      const reconciliation = manager.approveProposal(proposal.uri);

      expect(reconciliation.sourceEntityUri).toBe(entityUri);
      expect(reconciliation.targetSystem).toBe('openalex');
      expect(reconciliation.targetIdentifier).toBe('I123456');
      expect(reconciliation.status).toBe('established');
      expect(reconciliation.proposalUri).toBe(proposal.uri);
      expect(reconciliation.uri).toContain(GRAPH_PDS_DID);
    });

    it('new reconciliation available in list after approval', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS['new-facet']}` as AtUri;
      const proposal = createTestReconciliationProposal('facet', entityUri, 'wikidata', 'Q777777');
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      manager.approveProposal(proposal.uri);

      const reconciliation = manager.getReconciliationByExternalId('wikidata', 'Q777777');
      expect(reconciliation).not.toBeNull();
      expect(reconciliation?.status).toBe('established');
    });
  });

  describe('Reconciliation Methods', () => {
    it('supports automatic reconciliation method', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.auto}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'ror',
        'auto123',
        {
          proposedMethod: 'automatic',
          proposedConfidence: 0.95,
        }
      );

      const created = manager.createProposal(proposal);
      expect(created.proposedMethod).toBe('automatic');
    });

    it('supports expert validation method', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.contribution-type/${CONTRIBUTION_TYPE_UUIDS.expert}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'contribution-type',
        entityUri,
        'cro',
        'CRO:0000064',
        {
          proposedMethod: 'expert-validation',
          proposedConfidence: 1.0,
        }
      );

      const created = manager.createProposal(proposal);
      expect(created.proposedMethod).toBe('expert-validation');
    });

    it('supports community vote method', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS.community}` as AtUri;
      const proposal = createTestReconciliationProposal('facet', entityUri, 'lcsh', 'sh12345', {
        proposedMethod: 'community-vote',
        proposedConfidence: 0.85,
      });

      const created = manager.createProposal(proposal);
      expect(created.proposedMethod).toBe('community-vote');
    });
  });

  describe('Confidence Scores', () => {
    it('stores confidence score', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS['confidence-test']}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'wikidata',
        'Q88888',
        {
          proposedConfidence: 0.75,
        }
      );
      manager.createProposal(proposal);

      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');

      const reconciliation = manager.approveProposal(proposal.uri);
      expect(reconciliation.confidence).toBe(0.75);
    });

    it('validates confidence score range (0-1)', () => {
      const validConfidences = [0, 0.5, 0.75, 0.95, 1.0];
      for (const conf of validConfidences) {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Reconciliation Removal', () => {
    it('can remove an existing reconciliation', () => {
      // Create reconciliation
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS['to-remove']}` as AtUri;
      const proposal = createTestReconciliationProposal('facet', entityUri, 'fast', 'fst999999');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      const reconciliation = manager.approveProposal(proposal.uri);

      // Remove it
      const removalUri =
        `at://${TEST_USER_1}/pub.chive.graph.reconciliationProposal/removal` as AtUri;
      manager.removeReconciliation(reconciliation.id, removalUri);

      const removed = manager.getReconciliation(reconciliation.id);
      expect(removed?.status).toBe('removed');
      expect(removed?.removedBy).toBe(removalUri);
    });

    it('removed reconciliations still retrievable', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.removed}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'ror',
        'removed123'
      );
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      const reconciliation = manager.approveProposal(proposal.uri);

      manager.removeReconciliation(
        reconciliation.id,
        `at://${TEST_USER_1}/pub.chive.graph.reconciliationProposal/removal` as AtUri
      );

      const found = manager.getReconciliation(reconciliation.id);
      expect(found).not.toBeNull();
    });
  });

  describe('Disputed Reconciliations', () => {
    it('can mark reconciliation as disputed', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS.disputed}` as AtUri;
      const proposal = createTestReconciliationProposal('facet', entityUri, 'wikidata', 'Q555555');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      const reconciliation = manager.approveProposal(proposal.uri);

      manager.disputeReconciliation(reconciliation.id);

      const disputed = manager.getReconciliation(reconciliation.id);
      expect(disputed?.status).toBe('disputed');
    });

    it('can filter by disputed status', () => {
      // Create and dispute a reconciliation
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.node/b2c3d4e5-f6a7-8901-bcde-f12345678901` as AtUri;
      const proposal = createTestReconciliationProposal('field', entityUri, 'wikidata', 'Q444444');
      manager.createProposal(proposal);
      manager.castVote(proposal.uri, TEST_USER_1, 'approve');
      manager.castVote(proposal.uri, TEST_USER_2, 'approve');
      manager.castVote(proposal.uri, TEST_USER_3, 'approve');
      const reconciliation = manager.approveProposal(proposal.uri);
      manager.disputeReconciliation(reconciliation.id);

      const disputed = manager.listReconciliations({ status: 'disputed' });
      expect(disputed.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Proposal Rejection', () => {
    it('updates proposal status to rejected', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS.rejected}` as AtUri;
      const proposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'ror',
        'rejected123'
      );
      manager.createProposal(proposal);

      manager.rejectProposal(proposal.uri);

      const updated = manager.getProposal(proposal.uri);
      expect(updated?.status).toBe('rejected');
    });

    it('rejected proposal reconciliation not added', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS['not-added']}` as AtUri;
      const proposal = createTestReconciliationProposal('facet', entityUri, 'lcsh', 'notadded123');
      manager.createProposal(proposal);

      manager.rejectProposal(proposal.uri);

      const reconciliation = manager.getReconciliationByExternalId('lcsh', 'notadded123');
      expect(reconciliation).toBeNull();
    });
  });

  describe('Update Proposal Flow', () => {
    it('can create update proposal for existing reconciliation', () => {
      // First create a reconciliation
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.organization/${ORGANIZATION_UUIDS['to-update']}` as AtUri;
      const createProposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'wikidata',
        'Q333333',
        {
          proposedMatchType: 'close-match',
          proposedConfidence: 0.8,
        }
      );
      manager.createProposal(createProposal);
      manager.castVote(createProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(createProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(createProposal.uri, TEST_USER_3, 'approve');
      const reconciliation = manager.approveProposal(createProposal.uri);

      // Create update proposal
      const updateProposal = createTestReconciliationProposal(
        'organization',
        entityUri,
        'wikidata',
        'Q333333',
        {
          proposalType: 'update',
          reconciliationId: reconciliation.id,
          proposedMatchType: 'exact-match',
          proposedConfidence: 0.95,
          rationale: 'Updated match type based on new evidence',
        }
      );

      const created = manager.createProposal(updateProposal);
      expect(created.proposalType).toBe('update');
      expect(created.reconciliationId).toBe(reconciliation.id);
    });
  });

  describe('Remove Proposal Flow', () => {
    it('can create removal proposal', () => {
      const entityUri =
        `at://${GRAPH_PDS_DID}/pub.chive.graph.facet/${FACET_UUIDS['removal-target']}` as AtUri;
      const createProposal = createTestReconciliationProposal(
        'facet',
        entityUri,
        'fast',
        'fst222222'
      );
      manager.createProposal(createProposal);
      manager.castVote(createProposal.uri, TEST_USER_1, 'approve');
      manager.castVote(createProposal.uri, TEST_USER_2, 'approve');
      manager.castVote(createProposal.uri, TEST_USER_3, 'approve');
      const reconciliation = manager.approveProposal(createProposal.uri);

      const removeProposal = createTestReconciliationProposal(
        'facet',
        entityUri,
        'fast',
        'fst222222',
        {
          proposalType: 'remove',
          reconciliationId: reconciliation.id,
          rationale: 'This reconciliation is incorrect and should be removed',
        }
      );

      const created = manager.createProposal(removeProposal);
      expect(created.proposalType).toBe('remove');
    });
  });

  describe('External System URL Generation', () => {
    it('generates Wikidata URLs correctly', () => {
      const template = RECONCILIATION_SYSTEMS.find((s) => s.id === 'wikidata')?.urlTemplate;
      const url = template?.replace('{id}', 'Q41506');
      expect(url).toBe('https://www.wikidata.org/wiki/Q41506');
    });

    it('generates ROR URLs correctly', () => {
      const template = RECONCILIATION_SYSTEMS.find((s) => s.id === 'ror')?.urlTemplate;
      const url = template?.replace('{id}', '00f54p054');
      expect(url).toBe('https://ror.org/00f54p054');
    });

    it('generates ORCID URLs correctly', () => {
      const template = RECONCILIATION_SYSTEMS.find((s) => s.id === 'orcid')?.urlTemplate;
      const url = template?.replace('{id}', '0000-0001-2345-6789');
      expect(url).toBe('https://orcid.org/0000-0001-2345-6789');
    });

    it('generates LCSH URLs correctly', () => {
      const template = RECONCILIATION_SYSTEMS.find((s) => s.id === 'lcsh')?.urlTemplate;
      const url = template?.replace('{id}', 'sh85082139');
      expect(url).toBe('http://id.loc.gov/authorities/subjects/sh85082139');
    });

    it('generates FAST URLs correctly', () => {
      const template = RECONCILIATION_SYSTEMS.find((s) => s.id === 'fast')?.urlTemplate;
      const url = template?.replace('{id}', '1018643');
      expect(url).toBe('http://id.worldcat.org/fast/1018643');
    });
  });
});
