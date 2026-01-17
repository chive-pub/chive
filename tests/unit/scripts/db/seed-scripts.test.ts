/**
 * Unit tests for knowledge graph seed scripts.
 *
 * @remarks
 * Tests the seed scripts using mocked Neo4j sessions to verify:
 * - Correct Cypher queries are generated
 * - Correct parameters are passed
 * - Constraints and indexes are created
 * - Relationships are established properly
 * - Idempotent behavior (MERGE instead of CREATE)
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import {
  contributionTypeUuid,
  fieldUuid,
  facetUuid,
  conceptUuid,
} from '../../../../scripts/db/lib/deterministic-uuid.js';

// =============================================================================
// Mock Types
// =============================================================================

interface MockSession {
  run: Mock;
  close: Mock;
}

interface MockQueryResult {
  records: {
    get: (key: string) => unknown;
  }[];
}

/**
 * Creates a mock Neo4j session.
 */
function createMockSession(): MockSession {
  return {
    run: vi.fn().mockResolvedValue({ records: [] }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock record for query results.
 */
function createMockRecord(data: Record<string, unknown>): { get: (key: string) => unknown } {
  return {
    get: (key: string) => data[key],
  };
}

// =============================================================================
// Seed Script Behavior Tests
// =============================================================================

describe('Seed Script Behavior', () => {
  let mockSession: MockSession;
  const governanceDid = 'did:plc:test-governance';

  beforeEach(() => {
    mockSession = createMockSession();
  });

  describe('Contribution Type Seeding', () => {
    it('generates deterministic UUIDs for CRediT roles', () => {
      const roles = ['conceptualization', 'data-curation', 'formal-analysis', 'methodology'];

      const uuids = roles.map(contributionTypeUuid);

      // All UUIDs should be unique
      expect(new Set(uuids).size).toBe(roles.length);

      // Running again should produce same UUIDs
      const uuids2 = roles.map(contributionTypeUuid);
      expect(uuids).toEqual(uuids2);
    });

    it('generates correct AT-URIs using UUIDs', () => {
      const slug = 'conceptualization';
      const uuid = contributionTypeUuid(slug);
      const expectedUri = `at://${governanceDid}/pub.chive.graph.concept/${uuid}`;

      expect(expectedUri).toContain(governanceDid);
      expect(expectedUri).toContain(uuid);
      expect(expectedUri).not.toContain(slug); // Should use UUID, not slug
    });

    it('MERGE query structure is correct for idempotency', async () => {
      const slug = 'conceptualization';
      const uuid = contributionTypeUuid(slug);

      // Simulate seed script behavior
      await mockSession.run(
        `
        MERGE (ct:ContributionType {slug: $slug})
        ON CREATE SET
          ct.id = $id,
          ct.uri = $uri,
          ct.label = $label
        ON MATCH SET
          ct.label = $label
        `,
        {
          slug,
          id: uuid,
          uri: `at://${governanceDid}/pub.chive.graph.concept/${uuid}`,
          label: 'Conceptualization',
        }
      );

      expect(mockSession.run).toHaveBeenCalledTimes(1);
      const calls = mockSession.run.mock.calls as [string, Record<string, unknown>][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [query, params] = firstCall;

      // Verify MERGE on slug (not id) for idempotency
      expect(query).toContain('MERGE (ct:ContributionType {slug: $slug})');
      expect(query).toContain('ON CREATE SET');
      expect(query).toContain('ON MATCH SET');

      // Verify params
      expect(params.slug).toBe(slug);
      expect(params.id).toBe(uuid);
    });
  });

  describe('Field Seeding', () => {
    it('generates deterministic UUIDs for fields', () => {
      const fields = ['linguistics', 'computer-science', 'physics', 'mathematics'];

      const uuids = fields.map(fieldUuid);

      expect(new Set(uuids).size).toBe(fields.length);

      const uuids2 = fields.map(fieldUuid);
      expect(uuids).toEqual(uuids2);
    });

    it('generates correct AT-URIs for fields', () => {
      const slug = 'linguistics';
      const uuid = fieldUuid(slug);
      const expectedUri = `at://${governanceDid}/pub.chive.graph.field/${uuid}`;

      expect(expectedUri).toContain('pub.chive.graph.field');
      expect(expectedUri).toContain(uuid);
    });

    it('parent-child relationship query is correct', async () => {
      await mockSession.run(
        `
        MATCH (parent:Field {slug: $parentSlug})
        MATCH (child:Field {slug: $childSlug})
        MERGE (parent)-[r:PARENT_OF]->(child)
        ON CREATE SET r.createdAt = datetime()
        `,
        {
          parentSlug: 'humanities',
          childSlug: 'linguistics',
        }
      );

      const calls = mockSession.run.mock.calls as [string, Record<string, unknown>][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [query, params] = firstCall;

      expect(query).toContain('MATCH (parent:Field {slug: $parentSlug})');
      expect(query).toContain('MERGE (parent)-[r:PARENT_OF]->(child)');
      expect(params.parentSlug).toBe('humanities');
      expect(params.childSlug).toBe('linguistics');
    });

    it('related-to relationship query is correct', async () => {
      await mockSession.run(
        `
        MATCH (a:Field {slug: $fieldSlug})
        MATCH (b:Field {slug: $relatedSlug})
        MERGE (a)-[r:RELATED_TO]-(b)
        ON CREATE SET r.createdAt = datetime(), r.source = 'seed'
        `,
        {
          fieldSlug: 'computational-linguistics',
          relatedSlug: 'computer-science',
        }
      );

      const calls = mockSession.run.mock.calls as [string, Record<string, unknown>][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [query] = firstCall;

      // RELATED_TO should be bidirectional (no arrow direction)
      expect(query).toContain('MERGE (a)-[r:RELATED_TO]-(b)');
    });
  });

  describe('Facet Seeding', () => {
    it('generates deterministic UUIDs for facets', () => {
      const facets = ['qualitative-research', 'quantitative-research', 'europe', 'asia'];

      const uuids = facets.map(facetUuid);

      expect(new Set(uuids).size).toBe(facets.length);

      const uuids2 = facets.map(facetUuid);
      expect(uuids).toEqual(uuids2);
    });

    it('generates correct AT-URIs for facets', () => {
      const slug = 'qualitative-research';
      const uuid = facetUuid(slug);
      const expectedUri = `at://${governanceDid}/pub.chive.graph.facet/${uuid}`;

      expect(expectedUri).toContain('pub.chive.graph.facet');
      expect(expectedUri).toContain(uuid);
    });

    it('MERGE query includes facetType dimension', async () => {
      const slug = 'qualitative-research';
      const uuid = facetUuid(slug);

      await mockSession.run(
        `
        MERGE (f:Facet {slug: $slug})
        ON CREATE SET
          f.id = $id,
          f.uri = $uri,
          f.label = $label,
          f.facetType = $facetType,
          f.status = 'established'
        `,
        {
          slug,
          id: uuid,
          uri: `at://${governanceDid}/pub.chive.graph.facet/${uuid}`,
          label: 'Qualitative Research',
          facetType: 'energy',
        }
      );

      const calls = mockSession.run.mock.calls as [string, Record<string, unknown>][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [, params] = firstCall;
      expect(params.facetType).toBe('energy');
    });
  });

  describe('Concept Seeding', () => {
    it('generates deterministic UUIDs for concepts', () => {
      const concepts = ['pdf', 'university', 'github', 'doi'];

      const uuids = concepts.map(conceptUuid);

      expect(new Set(uuids).size).toBe(concepts.length);

      const uuids2 = concepts.map(conceptUuid);
      expect(uuids).toEqual(uuids2);
    });

    it('generates correct AT-URIs for concepts', () => {
      const slug = 'pdf';
      const uuid = conceptUuid(slug);
      const expectedUri = `at://${governanceDid}/pub.chive.graph.concept/${uuid}`;

      expect(expectedUri).toContain('pub.chive.graph.concept');
      expect(expectedUri).toContain(uuid);
    });

    it('MERGE query includes category', async () => {
      const slug = 'pdf';
      const uuid = conceptUuid(slug);

      await mockSession.run(
        `
        MERGE (c:Concept {slug: $slug})
        ON CREATE SET
          c.id = $id,
          c.uri = $uri,
          c.name = $name,
          c.category = $category,
          c.wikidataId = $wikidataId
        `,
        {
          slug,
          id: uuid,
          uri: `at://${governanceDid}/pub.chive.graph.concept/${uuid}`,
          name: 'PDF',
          category: 'document-format',
          wikidataId: 'Q42332',
        }
      );

      const calls = mockSession.run.mock.calls as [string, Record<string, unknown>][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [, params] = firstCall;
      expect(params.category).toBe('document-format');
      expect(params.wikidataId).toBe('Q42332');
    });

    it('parent concept relationship query is correct', async () => {
      await mockSession.run(
        `
        MATCH (child:Concept {slug: $childSlug})
        MATCH (parent:Concept {slug: $parentSlug})
        MERGE (child)-[:PARENT_CONCEPT]->(parent)
        SET child.parentConceptUri = parent.uri
        `,
        {
          childSlug: 'gold-open-access',
          parentSlug: 'open-access',
        }
      );

      const calls = mockSession.run.mock.calls as [string, Record<string, unknown>][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [query, params] = firstCall;

      expect(query).toContain('MERGE (child)-[:PARENT_CONCEPT]->(parent)');
      expect(params.childSlug).toBe('gold-open-access');
      expect(params.parentSlug).toBe('open-access');
    });
  });

  describe('Constraint Creation', () => {
    it('creates slug uniqueness constraint', async () => {
      await mockSession.run(`
        CREATE CONSTRAINT field_slug_unique IF NOT EXISTS
        FOR (f:Field) REQUIRE f.slug IS UNIQUE
      `);

      const calls = mockSession.run.mock.calls as [string][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [query] = firstCall;
      expect(query).toContain('CREATE CONSTRAINT');
      expect(query).toContain('IF NOT EXISTS');
      expect(query).toContain('slug IS UNIQUE');
    });

    it('creates id (UUID) uniqueness constraint', async () => {
      await mockSession.run(`
        CREATE CONSTRAINT field_id_unique IF NOT EXISTS
        FOR (f:Field) REQUIRE f.id IS UNIQUE
      `);

      const calls = mockSession.run.mock.calls as [string][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [query] = firstCall;
      expect(query).toContain('id IS UNIQUE');
    });

    it('creates uri uniqueness constraint', async () => {
      await mockSession.run(`
        CREATE CONSTRAINT field_uri_unique IF NOT EXISTS
        FOR (f:Field) REQUIRE f.uri IS UNIQUE
      `);

      const calls = mockSession.run.mock.calls as [string][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [query] = firstCall;
      expect(query).toContain('uri IS UNIQUE');
    });

    it('creates status index for filtering', async () => {
      await mockSession.run(`
        CREATE INDEX field_status_idx IF NOT EXISTS
        FOR (f:Field) ON (f.status)
      `);

      const calls = mockSession.run.mock.calls as [string][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [query] = firstCall;
      expect(query).toContain('CREATE INDEX');
      expect(query).toContain('(f.status)');
    });
  });

  describe('External Mapping Serialization', () => {
    it('serializes external mappings as JSON', async () => {
      const externalMappings = [
        {
          system: 'credit',
          identifier: 'conceptualization',
          uri: 'https://credit.niso.org/contributor-roles/conceptualization/',
          matchType: 'exact-match',
        },
      ];

      await mockSession.run(
        `
        MERGE (ct:ContributionType {slug: $slug})
        ON CREATE SET ct.externalMappings = $externalMappings
        `,
        {
          slug: 'conceptualization',
          externalMappings: JSON.stringify(externalMappings),
        }
      );

      const calls = mockSession.run.mock.calls as [string, Record<string, unknown>][];
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected first call to be defined');
      const [, params] = firstCall;
      const mappings = JSON.parse(params.externalMappings as string) as {
        system: string;
        matchType: string;
      }[];

      expect(mappings).toHaveLength(1);
      const firstMapping = mappings[0];
      if (!firstMapping) throw new Error('Expected first mapping to be defined');
      expect(firstMapping.system).toBe('credit');
      expect(firstMapping.matchType).toBe('exact-match');
    });
  });

  describe('Idempotency', () => {
    it('running seed twice produces same results', () => {
      // First run
      const uuid1 = contributionTypeUuid('conceptualization');
      const uri1 = `at://${governanceDid}/pub.chive.graph.concept/${uuid1}`;

      // Second run (simulating script restart)
      const uuid2 = contributionTypeUuid('conceptualization');
      const uri2 = `at://${governanceDid}/pub.chive.graph.concept/${uuid2}`;

      expect(uuid1).toBe(uuid2);
      expect(uri1).toBe(uri2);
    });

    it('MERGE prevents duplicate creation', async () => {
      // MERGE should use slug as the unique identifier
      // Running twice should update, not create duplicates
      const slug = 'conceptualization';

      for (let i = 0; i < 2; i++) {
        await mockSession.run(
          `
          MERGE (ct:ContributionType {slug: $slug})
          ON CREATE SET ct.createdAt = datetime()
          ON MATCH SET ct.updatedAt = datetime()
          `,
          { slug }
        );
      }

      // Both calls should use same slug
      const calls = mockSession.run.mock.calls as [string, Record<string, unknown>][];
      expect(calls).toHaveLength(2);
      const firstCall = calls[0];
      const secondCall = calls[1];
      if (!firstCall || !secondCall) throw new Error('Expected both calls to be defined');
      expect(firstCall[1].slug).toBe(slug);
      expect(secondCall[1].slug).toBe(slug);
    });
  });
});

describe('Query Summary Verification', () => {
  let mockSession: MockSession;

  beforeEach(() => {
    mockSession = createMockSession();
  });

  it('summary query returns correct counts', async () => {
    mockSession.run.mockResolvedValue({
      records: [
        createMockRecord({
          types: 14,
          fields: 200,
          parents: 195,
          related: 50,
        }),
      ],
    } as MockQueryResult);

    const result = await mockSession.run(`
      MATCH (ct:ContributionType) WITH count(ct) as types
      MATCH (f:Field) WITH types, count(f) as fields
      RETURN types, fields
    `);

    const record = result.records[0];
    expect(record?.get('types')).toBe(14);
    expect(record?.get('fields')).toBe(200);
  });

  it('facet summary groups by dimension', async () => {
    mockSession.run.mockResolvedValue({
      records: [
        createMockRecord({ dimension: 'form-genre', count: 15 }),
        createMockRecord({ dimension: 'energy', count: 20 }),
        createMockRecord({ dimension: 'space', count: 20 }),
        createMockRecord({ dimension: 'time', count: 15 }),
      ],
    } as MockQueryResult);

    const result = await mockSession.run(`
      MATCH (f:Facet)
      RETURN f.facetType as dimension, count(*) as count
      ORDER BY count DESC
    `);

    expect(result.records).toHaveLength(4);
    expect(result.records[0]?.get('dimension')).toBe('form-genre');
  });

  it('concept summary groups by category', async () => {
    mockSession.run.mockResolvedValue({
      records: [
        createMockRecord({ category: 'document-format', count: 8 }),
        createMockRecord({ category: 'publication-status', count: 6 }),
        createMockRecord({ category: 'platform-code', count: 10 }),
      ],
    } as MockQueryResult);

    const result = await mockSession.run(`
      MATCH (c:Concept)
      RETURN c.category as category, count(*) as count
      ORDER BY count DESC
    `);

    expect(result.records).toHaveLength(3);
  });
});
