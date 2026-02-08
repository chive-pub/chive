/**
 * Tests for governance validation schemas.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import { TEST_GRAPH_PDS_DID } from '@/tests/test-constants';

import {
  fieldProposalSchema,
  voteSchema,
  externalMappingSchema,
  isValidWikidataId,
  isValidFastId,
  wikidataUrl,
  fastUrl,
  extractWikidataId,
} from './governance';

// =============================================================================
// EXTERNAL MAPPING SCHEMA TESTS
// =============================================================================

describe('externalMappingSchema', () => {
  it('accepts valid Wikidata mapping', () => {
    const result = externalMappingSchema.safeParse({
      source: 'wikidata',
      id: 'Q12345',
      url: 'https://www.wikidata.org/wiki/Q12345',
    });

    expect(result.success).toBe(true);
  });

  it('accepts valid FAST mapping', () => {
    const result = externalMappingSchema.safeParse({
      source: 'fast',
      id: 'fst00977641',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid source', () => {
    const result = externalMappingSchema.safeParse({
      source: 'invalid',
      id: 'test123',
    });

    expect(result.success).toBe(false);
  });

  it('requires id field', () => {
    const result = externalMappingSchema.safeParse({
      source: 'wikidata',
    });

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// FIELD PROPOSAL SCHEMA TESTS
// =============================================================================

describe('fieldProposalSchema', () => {
  const validCreateProposal = {
    fieldName: 'Quantum Machine Learning',
    description:
      'This is a valid description that is long enough to pass the minimum character requirement.',
    proposalType: 'create' as const,
  };

  it('accepts valid create proposal', () => {
    const result = fieldProposalSchema.safeParse(validCreateProposal);
    expect(result.success).toBe(true);
  });

  it('requires fieldName', () => {
    const result = fieldProposalSchema.safeParse({
      ...validCreateProposal,
      fieldName: '',
    });

    expect(result.success).toBe(false);
  });

  it('requires description to be at least 20 characters', () => {
    const result = fieldProposalSchema.safeParse({
      ...validCreateProposal,
      description: 'Too short',
    });

    expect(result.success).toBe(false);
  });

  it('accepts modify proposal with existingFieldUri', () => {
    const result = fieldProposalSchema.safeParse({
      ...validCreateProposal,
      proposalType: 'modify',
      existingFieldUri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71`,
    });

    expect(result.success).toBe(true);
  });

  it('rejects modify proposal without existingFieldUri', () => {
    const result = fieldProposalSchema.safeParse({
      ...validCreateProposal,
      proposalType: 'modify',
    });

    expect(result.success).toBe(false);
  });

  it('requires mergeTargetUri for merge proposals', () => {
    const result = fieldProposalSchema.safeParse({
      ...validCreateProposal,
      proposalType: 'merge',
      existingFieldUri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71`,
    });

    expect(result.success).toBe(false);
  });

  it('accepts merge proposal with both URIs', () => {
    const result = fieldProposalSchema.safeParse({
      ...validCreateProposal,
      proposalType: 'merge',
      existingFieldUri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71`,
      mergeTargetUri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/e42c83de-6d16-5876-b276-38712ac4112a`,
    });

    expect(result.success).toBe(true);
  });

  it('accepts proposal with external mappings', () => {
    const result = fieldProposalSchema.safeParse({
      ...validCreateProposal,
      externalMappings: [
        { source: 'wikidata', id: 'Q12345' },
        { source: 'fast', id: 'fst00977641' },
      ],
    });

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// VOTE SCHEMA TESTS
// =============================================================================

describe('voteSchema', () => {
  it('accepts valid approve vote', () => {
    const result = voteSchema.safeParse({
      proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/123',
      vote: 'approve',
    });

    expect(result.success).toBe(true);
  });

  it('accepts vote with rationale', () => {
    const result = voteSchema.safeParse({
      proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/123',
      vote: 'reject',
      rationale: 'This field is too broad and overlaps with existing fields.',
    });

    expect(result.success).toBe(true);
  });

  it('accepts all valid vote values', () => {
    const votes = ['approve', 'reject', 'abstain', 'request-changes'] as const;

    for (const vote of votes) {
      const result = voteSchema.safeParse({
        proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/123',
        vote,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid vote value', () => {
    const result = voteSchema.safeParse({
      proposalUri: 'at://did:plc:user/pub.chive.graph.fieldProposal/123',
      vote: 'invalid',
    });

    expect(result.success).toBe(false);
  });

  it('requires proposalUri', () => {
    const result = voteSchema.safeParse({
      vote: 'approve',
    });

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// VALIDATION HELPER TESTS
// =============================================================================

describe('isValidWikidataId', () => {
  it('returns true for valid Q-IDs', () => {
    expect(isValidWikidataId('Q12345')).toBe(true);
    expect(isValidWikidataId('Q1')).toBe(true);
    expect(isValidWikidataId('Q999999999')).toBe(true);
  });

  it('returns false for invalid Q-IDs', () => {
    expect(isValidWikidataId('12345')).toBe(false);
    expect(isValidWikidataId('q12345')).toBe(false);
    expect(isValidWikidataId('Q')).toBe(false);
    expect(isValidWikidataId('P12345')).toBe(false);
    expect(isValidWikidataId('')).toBe(false);
  });
});

describe('isValidFastId', () => {
  it('returns true for valid FAST IDs', () => {
    expect(isValidFastId('fst00977641')).toBe(true);
    expect(isValidFastId('fst12345678')).toBe(true);
  });

  it('returns false for invalid FAST IDs', () => {
    expect(isValidFastId('977641')).toBe(false);
    expect(isValidFastId('fst123')).toBe(false);
    expect(isValidFastId('FST00977641')).toBe(false);
    expect(isValidFastId('')).toBe(false);
  });
});

describe('wikidataUrl', () => {
  it('generates correct Wikidata URLs', () => {
    expect(wikidataUrl('Q12345')).toBe('https://www.wikidata.org/wiki/Q12345');
    expect(wikidataUrl('Q1')).toBe('https://www.wikidata.org/wiki/Q1');
  });
});

describe('fastUrl', () => {
  it('generates correct FAST URLs', () => {
    expect(fastUrl('fst00977641')).toBe('http://id.worldcat.org/fast/00977641');
  });
});

describe('extractWikidataId', () => {
  it('returns Q-ID when already in correct format', () => {
    expect(extractWikidataId('Q12345')).toBe('Q12345');
    expect(extractWikidataId('  Q12345  ')).toBe('Q12345');
  });

  it('extracts Q-ID from Wikidata URLs', () => {
    expect(extractWikidataId('https://www.wikidata.org/wiki/Q12345')).toBe('Q12345');
    expect(extractWikidataId('https://www.wikidata.org/entity/Q12345')).toBe('Q12345');
  });

  it('returns null for invalid input', () => {
    expect(extractWikidataId('invalid')).toBeNull();
    expect(extractWikidataId('https://example.com')).toBeNull();
    expect(extractWikidataId('')).toBeNull();
  });
});
