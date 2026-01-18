/**
 * Unit tests for deterministic UUID generation.
 *
 * @remarks
 * Tests the UUID v5 implementation used by seed scripts to ensure:
 * - UUIDs are deterministic (same input → same output)
 * - UUIDs are valid format (8-4-4-4-12)
 * - Different inputs produce different UUIDs
 * - UUID version and variant bits are correctly set
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import {
  CHIVE_NAMESPACE,
  uuidv5,
  contributionTypeUuid,
  fieldUuid,
  facetUuid,
  conceptUuid,
} from '../../../../scripts/db/lib/deterministic-uuid.js';

// UUID format regex: 8-4-4-4-12 hexadecimal characters
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Deterministic UUID Generation', () => {
  describe('CHIVE_NAMESPACE', () => {
    it('is a valid UUID format', () => {
      expect(CHIVE_NAMESPACE).toMatch(UUID_REGEX);
    });

    it('is consistent across imports', () => {
      // Namespace should never change - it would break all existing UUIDs
      expect(CHIVE_NAMESPACE).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    });
  });

  describe('uuidv5', () => {
    it('returns valid UUID format', () => {
      const uuid = uuidv5(CHIVE_NAMESPACE, 'test');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('is deterministic - same input produces same output', () => {
      const uuid1 = uuidv5(CHIVE_NAMESPACE, 'test-name');
      const uuid2 = uuidv5(CHIVE_NAMESPACE, 'test-name');
      const uuid3 = uuidv5(CHIVE_NAMESPACE, 'test-name');

      expect(uuid1).toBe(uuid2);
      expect(uuid2).toBe(uuid3);
    });

    it('produces different UUIDs for different names', () => {
      const uuid1 = uuidv5(CHIVE_NAMESPACE, 'name-one');
      const uuid2 = uuidv5(CHIVE_NAMESPACE, 'name-two');

      expect(uuid1).not.toBe(uuid2);
    });

    it('produces different UUIDs for different namespaces', () => {
      const otherNamespace = '00000000-0000-0000-0000-000000000000';
      const uuid1 = uuidv5(CHIVE_NAMESPACE, 'same-name');
      const uuid2 = uuidv5(otherNamespace, 'same-name');

      expect(uuid1).not.toBe(uuid2);
    });

    it('sets version 5 in UUID', () => {
      const uuid = uuidv5(CHIVE_NAMESPACE, 'version-test');
      // Version is in the 13th character (index 14 accounting for hyphens)
      // Format: xxxxxxxx-xxxx-Vxxx-xxxx-xxxxxxxxxxxx where V is version
      const versionChar = uuid.charAt(14);
      expect(versionChar).toBe('5');
    });

    it('sets RFC 4122 variant bits', () => {
      const uuid = uuidv5(CHIVE_NAMESPACE, 'variant-test');
      // Variant is in the 17th character (index 19 accounting for hyphens)
      // Format: xxxxxxxx-xxxx-xxxx-Yxxx-xxxxxxxxxxxx where Y is 8, 9, a, or b
      const variantChar = uuid.charAt(19);
      expect(['8', '9', 'a', 'b']).toContain(variantChar);
    });

    it('handles empty string name', () => {
      const uuid = uuidv5(CHIVE_NAMESPACE, '');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('handles unicode characters in name', () => {
      const uuid = uuidv5(CHIVE_NAMESPACE, 'café-naïve-日本語');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('handles long names', () => {
      const longName = 'a'.repeat(10000);
      const uuid = uuidv5(CHIVE_NAMESPACE, longName);
      expect(uuid).toMatch(UUID_REGEX);
    });
  });

  describe('contributionTypeUuid', () => {
    it('returns valid UUID format', () => {
      const uuid = contributionTypeUuid('conceptualization');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('is deterministic', () => {
      const uuid1 = contributionTypeUuid('data-curation');
      const uuid2 = contributionTypeUuid('data-curation');
      expect(uuid1).toBe(uuid2);
    });

    it('produces different UUIDs for different slugs', () => {
      const uuid1 = contributionTypeUuid('conceptualization');
      const uuid2 = contributionTypeUuid('methodology');
      expect(uuid1).not.toBe(uuid2);
    });

    it('produces different UUID than fieldUuid for same slug', () => {
      // Different entity types should have different UUIDs even with same slug
      const contribUuid = contributionTypeUuid('software');
      const fieldUuidResult = fieldUuid('software');
      expect(contribUuid).not.toBe(fieldUuidResult);
    });

    it('produces consistent UUIDs for all CRediT roles', () => {
      const creditRoles = [
        'conceptualization',
        'data-curation',
        'formal-analysis',
        'funding-acquisition',
        'investigation',
        'methodology',
        'project-administration',
        'resources',
        'software',
        'supervision',
        'validation',
        'visualization',
        'writing-original-draft',
        'writing-review-editing',
      ];

      // All should produce valid, unique UUIDs
      const uuids = creditRoles.map(contributionTypeUuid);
      const uniqueUuids = new Set(uuids);

      expect(uniqueUuids.size).toBe(creditRoles.length);
      uuids.forEach((uuid) => expect(uuid).toMatch(UUID_REGEX));
    });
  });

  describe('fieldUuid', () => {
    it('returns valid UUID format', () => {
      const uuid = fieldUuid('linguistics');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('is deterministic', () => {
      const uuid1 = fieldUuid('computer-science');
      const uuid2 = fieldUuid('computer-science');
      expect(uuid1).toBe(uuid2);
    });

    it('produces different UUIDs for different slugs', () => {
      const uuid1 = fieldUuid('physics');
      const uuid2 = fieldUuid('mathematics');
      expect(uuid1).not.toBe(uuid2);
    });

    it('handles hierarchical field slugs', () => {
      const uuid1 = fieldUuid('natural-language-processing');
      const uuid2 = fieldUuid('machine-learning');
      expect(uuid1).toMatch(UUID_REGEX);
      expect(uuid2).toMatch(UUID_REGEX);
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('facetUuid', () => {
    it('returns valid UUID format', () => {
      const uuid = facetUuid('qualitative-research');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('is deterministic', () => {
      const uuid1 = facetUuid('europe');
      const uuid2 = facetUuid('europe');
      expect(uuid1).toBe(uuid2);
    });

    it('produces different UUIDs for different slugs', () => {
      const uuid1 = facetUuid('research-article');
      const uuid2 = facetUuid('review-article');
      expect(uuid1).not.toBe(uuid2);
    });

    it('produces different UUID than conceptUuid for same slug', () => {
      // Facet and concept with same slug should have different UUIDs
      const facetUuidResult = facetUuid('dataset');
      const conceptUuidResult = conceptUuid('dataset');
      expect(facetUuidResult).not.toBe(conceptUuidResult);
    });
  });

  describe('conceptUuid', () => {
    it('returns valid UUID format', () => {
      const uuid = conceptUuid('pdf');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('is deterministic', () => {
      const uuid1 = conceptUuid('university');
      const uuid2 = conceptUuid('university');
      expect(uuid1).toBe(uuid2);
    });

    it('produces different UUIDs for different slugs', () => {
      const uuid1 = conceptUuid('github');
      const uuid2 = conceptUuid('gitlab');
      expect(uuid1).not.toBe(uuid2);
    });

    it('handles all concept categories', () => {
      const conceptSlugs = [
        // document-format
        'pdf',
        'latex',
        'jupyter-notebook',
        // publication-status
        'preprint',
        'published',
        // access-type
        'open-access',
        'closed-access',
        // platform
        'github',
        'zenodo',
        // institution-type
        'university',
        'research-institute',
        // identifier-type
        'doi',
        'orcid',
      ];

      const uuids = conceptSlugs.map(conceptUuid);
      const uniqueUuids = new Set(uuids);

      expect(uniqueUuids.size).toBe(conceptSlugs.length);
      uuids.forEach((uuid) => expect(uuid).toMatch(UUID_REGEX));
    });
  });

  describe('Cross-entity type isolation', () => {
    it('same slug produces different UUIDs for different entity types', () => {
      // This is critical - a field called "software" should have a different
      // UUID than a contribution type called "software"
      const slug = 'software';

      const contribUuid = contributionTypeUuid(slug);
      const fieldUuidResult = fieldUuid(slug);
      const facetUuidResult = facetUuid(slug);
      const conceptUuidResult = conceptUuid(slug);

      const allUuids = [contribUuid, fieldUuidResult, facetUuidResult, conceptUuidResult];
      const uniqueUuids = new Set(allUuids);

      expect(uniqueUuids.size).toBe(4);
    });
  });

  describe('Idempotency verification', () => {
    it('calling uuid functions multiple times in sequence produces same results', () => {
      // Simulate what happens when seed script runs multiple times
      const results: string[] = [];

      for (let i = 0; i < 5; i++) {
        results.push(contributionTypeUuid('conceptualization'));
        results.push(fieldUuid('linguistics'));
        results.push(facetUuid('qualitative-research'));
        results.push(conceptUuid('pdf'));
      }

      // Every 4th element should be the same
      expect(results[0]).toBe(results[4]);
      expect(results[1]).toBe(results[5]);
      expect(results[2]).toBe(results[6]);
      expect(results[3]).toBe(results[7]);
    });
  });
});
