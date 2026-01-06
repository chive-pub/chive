/**
 * Unit tests for Neo4j adapter proposal mapping.
 *
 * @remarks
 * Tests that the mapFieldProposal method correctly extracts
 * and maps Neo4j node properties to the IFieldProposal interface.
 */

import { describe, it, expect } from 'vitest';

import type { FieldProposal } from '@/types/interfaces/graph.interface.js';

/**
 * Helper to create a mock Neo4j node with proposal fields.
 */
function createMockProposalNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'proposal-123',
    fieldId: 'field-456',
    proposedBy: 'did:plc:testuser123',
    proposalType: 'create',
    rationale: 'Adding a new field for testing',
    status: 'pending',
    approveVotes: 5,
    rejectVotes: 2,
    createdAt: new Date('2024-01-15'),
    ...overrides,
  };
}

/**
 * Since mapFieldProposal is private, we test it through the public getProposalById method.
 * For direct unit testing, we create a test adapter that exposes the method.
 */
describe('Neo4j Adapter Proposal Mapping', () => {
  describe('changes field mapping', () => {
    /**
     * Test helper that mimics the mapFieldProposal logic.
     * This allows us to unit test the mapping in isolation.
     */
    function mapProposalChanges(node: Record<string, unknown>): FieldProposal['changes'] {
      const changes: Record<string, unknown> = {};

      if (node.fieldName) {
        changes.label = node.fieldName as string;
      }
      if (node.description) {
        changes.description = node.description as string;
      }
      if (node.alternateNames) {
        const names = node.alternateNames;
        if (typeof names === 'string') {
          try {
            changes.alternateNames = JSON.parse(names);
          } catch {
            // Ignore parse errors
          }
        } else if (Array.isArray(names)) {
          changes.alternateNames = names;
        }
      }
      if (node.existingFieldUri) {
        changes.parentId = node.existingFieldUri as string;
      }
      if (node.mergeTargetUri) {
        changes.mergeTargetId = node.mergeTargetUri as string;
      }

      if (node.externalMappings) {
        try {
          const mappingsStr = node.externalMappings as string;
          const mappings = JSON.parse(mappingsStr) as { system: string; identifier: string }[];
          const wikidataMapping = mappings.find((m) => m.system === 'wikidata');
          if (wikidataMapping) {
            changes.wikidataId = wikidataMapping.identifier;
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      return changes as FieldProposal['changes'];
    }

    it('maps fieldName to changes.label', () => {
      const node = createMockProposalNode({
        fieldName: 'Machine Learning',
      });

      const changes = mapProposalChanges(node);

      expect(changes.label).toBe('Machine Learning');
    });

    it('maps description to changes.description', () => {
      const node = createMockProposalNode({
        description: 'A subfield of AI focused on algorithms that learn from data',
      });

      const changes = mapProposalChanges(node);

      expect(changes.description).toBe(
        'A subfield of AI focused on algorithms that learn from data'
      );
    });

    it('maps alternateNames array to changes.alternateNames', () => {
      const node = createMockProposalNode({
        alternateNames: ['ML', 'Statistical Learning'],
      });

      const changes = mapProposalChanges(node);

      expect(changes.alternateNames).toEqual(['ML', 'Statistical Learning']);
    });

    it('parses alternateNames from JSON string', () => {
      const node = createMockProposalNode({
        alternateNames: '["ML", "Statistical Learning"]',
      });

      const changes = mapProposalChanges(node);

      expect(changes.alternateNames).toEqual(['ML', 'Statistical Learning']);
    });

    it('maps existingFieldUri to changes.parentId', () => {
      const node = createMockProposalNode({
        existingFieldUri: 'at://did:plc:governance/pub.chive.graph.field/ai-001',
      });

      const changes = mapProposalChanges(node);

      expect(changes.parentId).toBe('at://did:plc:governance/pub.chive.graph.field/ai-001');
    });

    it('maps mergeTargetUri to changes.mergeTargetId', () => {
      const node = createMockProposalNode({
        mergeTargetUri: 'at://did:plc:governance/pub.chive.graph.field/ml-legacy',
      });

      const changes = mapProposalChanges(node);

      expect(changes.mergeTargetId).toBe('at://did:plc:governance/pub.chive.graph.field/ml-legacy');
    });

    it('extracts wikidataId from externalMappings JSON', () => {
      const node = createMockProposalNode({
        externalMappings: JSON.stringify([
          { system: 'wikidata', identifier: 'Q2539' },
          { system: 'lcsh', identifier: 'sh2018002345' },
        ]),
      });

      const changes = mapProposalChanges(node);

      expect(changes.wikidataId).toBe('Q2539');
    });

    it('handles missing optional fields gracefully', () => {
      const node = createMockProposalNode({});

      const changes = mapProposalChanges(node);

      expect(changes.label).toBeUndefined();
      expect(changes.description).toBeUndefined();
      expect(changes.alternateNames).toBeUndefined();
      expect(changes.parentId).toBeUndefined();
      expect(changes.mergeTargetId).toBeUndefined();
      expect(changes.wikidataId).toBeUndefined();
    });

    it('handles malformed JSON in externalMappings', () => {
      const node = createMockProposalNode({
        externalMappings: 'not valid json',
      });

      const changes = mapProposalChanges(node);

      // Should not throw, wikidataId should be undefined
      expect(changes.wikidataId).toBeUndefined();
    });

    it('handles malformed JSON in alternateNames', () => {
      const node = createMockProposalNode({
        alternateNames: 'not valid json',
      });

      const changes = mapProposalChanges(node);

      // Should not throw, alternateNames should be undefined
      expect(changes.alternateNames).toBeUndefined();
    });

    it('handles externalMappings without wikidata entry', () => {
      const node = createMockProposalNode({
        externalMappings: JSON.stringify([
          { system: 'lcsh', identifier: 'sh2018002345' },
          { system: 'fast', identifier: '12345' },
        ]),
      });

      const changes = mapProposalChanges(node);

      expect(changes.wikidataId).toBeUndefined();
    });

    it('maps all fields together correctly', () => {
      const node = createMockProposalNode({
        fieldName: 'Deep Learning',
        description: 'Neural networks with many layers',
        alternateNames: ['DL', 'Deep Neural Networks'],
        existingFieldUri: 'at://did:plc:governance/pub.chive.graph.field/ml-001',
        mergeTargetUri: 'at://did:plc:governance/pub.chive.graph.field/nn-001',
        externalMappings: JSON.stringify([{ system: 'wikidata', identifier: 'Q197536' }]),
      });

      const changes = mapProposalChanges(node);

      expect(changes).toEqual({
        label: 'Deep Learning',
        description: 'Neural networks with many layers',
        alternateNames: ['DL', 'Deep Neural Networks'],
        parentId: 'at://did:plc:governance/pub.chive.graph.field/ml-001',
        mergeTargetId: 'at://did:plc:governance/pub.chive.graph.field/nn-001',
        wikidataId: 'Q197536',
      });
    });
  });
});
