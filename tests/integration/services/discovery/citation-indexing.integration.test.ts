/**
 * Citation indexing integration tests.
 *
 * @remarks
 * Tests the CitationGraph against a real Neo4j instance:
 * - Batch upsert of citations
 * - Query for citing papers and references
 * - Co-citation analysis
 * - Chive-to-Chive only constraint
 *
 * Requires Docker test stack running (Neo4j 5+).
 *
 * @packageDocumentation
 */

import 'reflect-metadata';
import { Driver } from 'neo4j-driver';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { CitationGraph } from '@/storage/neo4j/citation-graph.js';
import { Neo4jConnection } from '@/storage/neo4j/connection.js';
import { createNeo4jDriver } from '@/storage/neo4j/setup.js';
import type { AtUri, DID } from '@/types/atproto.js';
import type { CitationRelationship } from '@/types/interfaces/discovery.interface.js';

// Test constants
const TEST_AUTHOR_1 = 'did:plc:citationtestauthor1' as DID;
const TEST_AUTHOR_2 = 'did:plc:citationtestauthor2' as DID;
const TEST_AUTHOR_3 = 'did:plc:citationtestauthor3' as DID;

// Generate unique test URIs
function createTestUri(author: DID, suffix: string): AtUri {
  const timestamp = Date.now();
  return `at://${author}/pub.chive.eprint.submission/citation${timestamp}${suffix}` as AtUri;
}

describe('CitationGraph Integration', () => {
  let driver: Driver;
  let connection: Neo4jConnection;
  let citationGraph: CitationGraph;

  // Test URIs - created once per test run
  let eprintA: AtUri;
  let eprintB: AtUri;
  let eprintC: AtUri;
  let eprintD: AtUri;
  let eprintE: AtUri;

  beforeAll(async () => {
    // Create real Neo4j connection
    driver = createNeo4jDriver();
    connection = new Neo4jConnection();
    await connection.initialize({
      uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
      username: process.env.NEO4J_USER ?? 'neo4j',
      password: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
      database: process.env.NEO4J_DATABASE ?? 'neo4j',
    });
    citationGraph = new CitationGraph(connection);

    // Generate unique test URIs for this test run
    eprintA = createTestUri(TEST_AUTHOR_1, 'a');
    eprintB = createTestUri(TEST_AUTHOR_2, 'b');
    eprintC = createTestUri(TEST_AUTHOR_3, 'c');
    eprintD = createTestUri(TEST_AUTHOR_1, 'd');
    eprintE = createTestUri(TEST_AUTHOR_2, 'e');

    // Create Node:Object:Eprint nodes for testing
    const session = connection.getSession();
    try {
      const nodes = [eprintA, eprintB, eprintC, eprintD, eprintE].map((uri, i) => ({
        uri,
        id: `citation-test-${Date.now()}-${i}`,
      }));
      await session.run(
        `
        UNWIND $nodes AS n
        MERGE (p:Node:Object:Eprint {id: n.id})
        SET p.uri = n.uri,
            p.subkind = 'eprint',
            p.kind = 'object',
            p.label = 'Test Eprint ' + n.uri,
            p.status = 'published',
            p.createdAt = datetime()
        `,
        { nodes }
      );
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    // Clean up all test eprints and their relationships
    const session = connection.getSession();
    try {
      await session.run(
        `
        MATCH (p:Eprint)
        WHERE p.uri STARTS WITH 'at://did:plc:citationtestauthor'
        DETACH DELETE p
        `
      );
    } finally {
      await session.close();
    }

    await connection.close();
    await driver.close();
  });

  beforeEach(async () => {
    // Clean up citation edges between tests, but keep eprint nodes
    const session = connection.getSession();
    try {
      await session.run(
        `
        MATCH (p:Node:Object:Eprint)-[r:CITES]->()
        WHERE p.uri STARTS WITH 'at://did:plc:citationtestauthor'
        DELETE r
        `
      );
    } finally {
      await session.close();
    }
  });

  // ==========================================================================
  // upsertCitationsBatch
  // ==========================================================================

  describe('upsertCitationsBatch', () => {
    it('should create citation edges between existing eprints', async () => {
      const citations: CitationRelationship[] = [
        {
          citingUri: eprintA,
          citedUri: eprintB,
          isInfluential: true,
          source: 'semantic-scholar',
        },
      ];

      await citationGraph.upsertCitationsBatch(citations);

      // Verify edge was created in Neo4j
      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH (citing:Node:Object:Eprint {uri: $citingUri})-[r:CITES]->(cited:Node:Object:Eprint {uri: $citedUri})
          RETURN r.isInfluential AS isInfluential, r.source AS source
          `,
          { citingUri: eprintA, citedUri: eprintB }
        );

        expect(result.records).toHaveLength(1);
        expect(result.records[0]?.get('isInfluential')).toBe(true);
        expect(result.records[0]?.get('source')).toBe('semantic-scholar');
      } finally {
        await session.close();
      }
    });

    it('should update existing citations on duplicate upsert (idempotent)', async () => {
      // First insert with isInfluential=false
      await citationGraph.upsertCitationsBatch([
        {
          citingUri: eprintA,
          citedUri: eprintB,
          isInfluential: false,
          source: 'openalex',
        },
      ]);

      // Second insert with isInfluential=true (should update, not create duplicate)
      await citationGraph.upsertCitationsBatch([
        {
          citingUri: eprintA,
          citedUri: eprintB,
          isInfluential: true,
          source: 'semantic-scholar',
        },
      ]);

      // Verify only one edge exists with updated properties
      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH (citing:Node:Object:Eprint {uri: $citingUri})-[r:CITES]->(cited:Node:Object:Eprint {uri: $citedUri})
          RETURN count(r) AS edgeCount, r.isInfluential AS isInfluential, r.source AS source
          `,
          { citingUri: eprintA, citedUri: eprintB }
        );

        expect(result.records).toHaveLength(1);
        const record = result.records[0];
        expect(record?.get('edgeCount')).toBe(1);
        expect(record?.get('isInfluential')).toBe(true);
        expect(record?.get('source')).toBe('semantic-scholar');
      } finally {
        await session.close();
      }
    });

    it('should handle batch of multiple citations efficiently', async () => {
      const citations: CitationRelationship[] = [
        {
          citingUri: eprintA,
          citedUri: eprintB,
          isInfluential: true,
          source: 'semantic-scholar',
        },
        {
          citingUri: eprintA,
          citedUri: eprintC,
          isInfluential: false,
          source: 'semantic-scholar',
        },
        { citingUri: eprintB, citedUri: eprintC, isInfluential: true, source: 'openalex' },
        {
          citingUri: eprintC,
          citedUri: eprintD,
          isInfluential: false,
          source: 'semantic-scholar',
        },
      ];

      await citationGraph.upsertCitationsBatch(citations);

      // Verify all edges were created
      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH (p:Node:Object:Eprint)-[r:CITES]->()
          WHERE p.uri IN $uris
          RETURN count(r) AS edgeCount
          `,
          { uris: [eprintA, eprintB, eprintC] }
        );

        expect(result.records[0]?.get('edgeCount')).toBe(4);
      } finally {
        await session.close();
      }
    });

    it('should silently skip citations where citing eprint does not exist', async () => {
      const nonExistentUri = 'at://did:plc:nonexistent/pub.chive.eprint.submission/xyz' as AtUri;

      const citations: CitationRelationship[] = [
        { citingUri: nonExistentUri, citedUri: eprintB, source: 'semantic-scholar' },
      ];

      // Should not throw
      await expect(citationGraph.upsertCitationsBatch(citations)).resolves.not.toThrow();

      // Verify no edges were created
      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH ()-[r:CITES]->(p:Eprint {uri: $uri})
          RETURN count(r) AS edgeCount
          `,
          { uri: eprintB }
        );

        expect(result.records[0]?.get('edgeCount')).toBe(0);
      } finally {
        await session.close();
      }
    });

    it('should silently skip citations where cited eprint does not exist', async () => {
      const nonExistentUri = 'at://did:plc:nonexistent/pub.chive.eprint.submission/xyz' as AtUri;

      const citations: CitationRelationship[] = [
        { citingUri: eprintA, citedUri: nonExistentUri, source: 'semantic-scholar' },
      ];

      await expect(citationGraph.upsertCitationsBatch(citations)).resolves.not.toThrow();

      // Verify no edges were created from eprintA
      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH (p:Node:Object:Eprint {uri: $uri})-[r:CITES]->()
          RETURN count(r) AS edgeCount
          `,
          { uri: eprintA }
        );

        expect(result.records[0]?.get('edgeCount')).toBe(0);
      } finally {
        await session.close();
      }
    });

    it('should handle empty batch gracefully', async () => {
      await expect(citationGraph.upsertCitationsBatch([])).resolves.not.toThrow();
    });

    it('should set discoveredAt timestamp on new citations', async () => {
      const beforeInsert = new Date();

      await citationGraph.upsertCitationsBatch([
        { citingUri: eprintA, citedUri: eprintB, source: 'semantic-scholar' },
      ]);

      const afterInsert = new Date();

      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH (citing:Eprint {uri: $citingUri})-[r:CITES]->(cited:Eprint {uri: $citedUri})
          RETURN r.discoveredAt AS discoveredAt
          `,
          { citingUri: eprintA, citedUri: eprintB }
        );

        const discoveredAt = new Date(
          (result.records[0]?.get('discoveredAt') as { toString(): string }).toString()
        );
        expect(discoveredAt.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime() - 1000);
        expect(discoveredAt.getTime()).toBeLessThanOrEqual(afterInsert.getTime() + 1000);
      } finally {
        await session.close();
      }
    });
  });

  // ==========================================================================
  // getCitingPapers
  // ==========================================================================

  describe('getCitingPapers', () => {
    beforeEach(async () => {
      // Set up citation network: A, B, C all cite D
      await citationGraph.upsertCitationsBatch([
        {
          citingUri: eprintA,
          citedUri: eprintD,
          isInfluential: true,
          source: 'semantic-scholar',
        },
        {
          citingUri: eprintB,
          citedUri: eprintD,
          isInfluential: false,
          source: 'semantic-scholar',
        },
        { citingUri: eprintC, citedUri: eprintD, isInfluential: true, source: 'openalex' },
      ]);
    });

    it('should return all papers that cite the target', async () => {
      const result = await citationGraph.getCitingPapers(eprintD);

      expect(result.citations).toHaveLength(3);
      expect(result.total).toBe(3);

      const citingUris = result.citations.map((c) => c.citingUri);
      expect(citingUris).toContain(eprintA);
      expect(citingUris).toContain(eprintB);
      expect(citingUris).toContain(eprintC);
    });

    it('should include isInfluential flag correctly', async () => {
      const result = await citationGraph.getCitingPapers(eprintD);

      const influentialCount = result.citations.filter((c) => c.isInfluential).length;
      expect(influentialCount).toBe(2);

      const citationFromA = result.citations.find((c) => c.citingUri === eprintA);
      expect(citationFromA?.isInfluential).toBe(true);

      const citationFromB = result.citations.find((c) => c.citingUri === eprintB);
      expect(citationFromB?.isInfluential).toBe(false);
    });

    it('should respect limit option', async () => {
      const result = await citationGraph.getCitingPapers(eprintD, { limit: 2 });

      expect(result.citations).toHaveLength(2);
      expect(result.total).toBe(3); // Total should still reflect all citations
    });

    it('should respect offset option for pagination', async () => {
      const firstPage = await citationGraph.getCitingPapers(eprintD, { limit: 2, offset: 0 });
      const secondPage = await citationGraph.getCitingPapers(eprintD, { limit: 2, offset: 2 });

      expect(firstPage.citations).toHaveLength(2);
      expect(secondPage.citations).toHaveLength(1);

      // Ensure no overlap between pages
      const firstPageUris = new Set(firstPage.citations.map((c) => c.citingUri));
      const secondPageUris = new Set(secondPage.citations.map((c) => c.citingUri));
      for (const uri of secondPageUris) {
        expect(firstPageUris.has(uri)).toBe(false);
      }
    });

    it('should return empty result for paper with no citations', async () => {
      const result = await citationGraph.getCitingPapers(eprintE);

      expect(result.citations).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should include source information', async () => {
      const result = await citationGraph.getCitingPapers(eprintD);

      const citationFromC = result.citations.find((c) => c.citingUri === eprintC);
      expect(citationFromC?.source).toBe('openalex');
    });
  });

  // ==========================================================================
  // getReferences
  // ==========================================================================

  describe('getReferences', () => {
    beforeEach(async () => {
      // Set up citation network: A cites B, C, D
      await citationGraph.upsertCitationsBatch([
        {
          citingUri: eprintA,
          citedUri: eprintB,
          isInfluential: true,
          source: 'semantic-scholar',
        },
        {
          citingUri: eprintA,
          citedUri: eprintC,
          isInfluential: false,
          source: 'semantic-scholar',
        },
        { citingUri: eprintA, citedUri: eprintD, isInfluential: true, source: 'openalex' },
      ]);
    });

    it('should return all papers that the target cites (references)', async () => {
      const result = await citationGraph.getReferences(eprintA);

      expect(result.citations).toHaveLength(3);
      expect(result.total).toBe(3);

      const citedUris = result.citations.map((c) => c.citedUri);
      expect(citedUris).toContain(eprintB);
      expect(citedUris).toContain(eprintC);
      expect(citedUris).toContain(eprintD);
    });

    it('should include isInfluential flag correctly', async () => {
      const result = await citationGraph.getReferences(eprintA);

      const referenceToB = result.citations.find((c) => c.citedUri === eprintB);
      expect(referenceToB?.isInfluential).toBe(true);

      const referenceToC = result.citations.find((c) => c.citedUri === eprintC);
      expect(referenceToC?.isInfluential).toBe(false);
    });

    it('should respect limit option', async () => {
      const result = await citationGraph.getReferences(eprintA, { limit: 2 });

      expect(result.citations).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('should return empty result for paper with no references', async () => {
      const result = await citationGraph.getReferences(eprintE);

      expect(result.citations).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // findCoCitedPapers
  // ==========================================================================

  describe('findCoCitedPapers', () => {
    beforeEach(async () => {
      // Set up co-citation network:
      // A cites B and C
      // D cites B and C
      // E cites B only
      // So B and C are co-cited together by A and D (co-citation count = 2)
      await citationGraph.upsertCitationsBatch([
        { citingUri: eprintA, citedUri: eprintB, source: 'semantic-scholar' },
        { citingUri: eprintA, citedUri: eprintC, source: 'semantic-scholar' },
        { citingUri: eprintD, citedUri: eprintB, source: 'semantic-scholar' },
        { citingUri: eprintD, citedUri: eprintC, source: 'semantic-scholar' },
        { citingUri: eprintE, citedUri: eprintB, source: 'semantic-scholar' },
      ]);
    });

    it('should find papers frequently cited together with target', async () => {
      // Find papers co-cited with B
      const result = await citationGraph.findCoCitedPapers(eprintB, 1);

      // C should be co-cited with B (by A and D = 2 co-citations)
      expect(result.length).toBeGreaterThan(0);

      const coC = result.find((p) => p.uri === eprintC);
      expect(coC).toBeDefined();
      expect(coC?.coCitationCount).toBe(2);
    });

    it('should respect minimum co-citation threshold', async () => {
      // With threshold 2, only papers co-cited at least twice should appear
      const result = await citationGraph.findCoCitedPapers(eprintB, 2);

      // Should only include C (co-cited 2 times)
      expect(result.every((p) => p.coCitationCount >= 2)).toBe(true);

      const coC = result.find((p) => p.uri === eprintC);
      expect(coC).toBeDefined();
    });

    it('should exclude self from co-citation results', async () => {
      const result = await citationGraph.findCoCitedPapers(eprintB, 1);

      // B should not appear in its own co-citation list
      const selfCitation = result.find((p) => p.uri === eprintB);
      expect(selfCitation).toBeUndefined();
    });

    it('should return empty for papers with no co-citations', async () => {
      // E is only cited once, so no co-citations possible
      const result = await citationGraph.findCoCitedPapers(eprintE, 1);

      expect(result).toHaveLength(0);
    });

    it('should order results by co-citation count descending', async () => {
      // Add more co-citations to create varied counts
      await citationGraph.upsertCitationsBatch([
        // Another paper F that cites B and C - increases B-C co-citation to 3
        {
          citingUri: createTestUri(TEST_AUTHOR_3, 'f'),
          citedUri: eprintB,
          source: 'semantic-scholar',
        },
      ]);

      // First create the F eprint node
      const session = connection.getSession();
      try {
        const fUri = createTestUri(TEST_AUTHOR_3, 'f');
        await session.run(
          `
          MERGE (p:Node:Object:Eprint {id: $id})
          SET p.uri = $uri,
              p.subkind = 'eprint',
              p.kind = 'object',
              p.label = 'F',
              p.status = 'published',
              p.createdAt = datetime()
          `,
          { id: `citation-test-f-${Date.now()}`, uri: fUri }
        );
        await citationGraph.upsertCitationsBatch([
          { citingUri: fUri, citedUri: eprintB, source: 'semantic-scholar' },
          { citingUri: fUri, citedUri: eprintC, source: 'semantic-scholar' },
        ]);
      } finally {
        await session.close();
      }

      const result = await citationGraph.findCoCitedPapers(eprintB, 1);

      // Results should be sorted by coCitationCount descending
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1];
        const curr = result[i];
        if (prev && curr) {
          expect(prev.coCitationCount).toBeGreaterThanOrEqual(curr.coCitationCount);
        }
      }
    });
  });
});
