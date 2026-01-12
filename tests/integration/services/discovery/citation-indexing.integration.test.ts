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
  return `at://${author}/pub.chive.preprint.submission/citation${timestamp}${suffix}` as AtUri;
}

describe('CitationGraph Integration', () => {
  let driver: Driver;
  let connection: Neo4jConnection;
  let citationGraph: CitationGraph;

  // Test URIs - created once per test run
  let preprintA: AtUri;
  let preprintB: AtUri;
  let preprintC: AtUri;
  let preprintD: AtUri;
  let preprintE: AtUri;

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
    preprintA = createTestUri(TEST_AUTHOR_1, 'a');
    preprintB = createTestUri(TEST_AUTHOR_2, 'b');
    preprintC = createTestUri(TEST_AUTHOR_3, 'c');
    preprintD = createTestUri(TEST_AUTHOR_1, 'd');
    preprintE = createTestUri(TEST_AUTHOR_2, 'e');

    // Create Preprint nodes for testing
    const session = connection.getSession();
    try {
      await session.run(
        `
        UNWIND $uris AS uri
        MERGE (p:Preprint {uri: uri})
        SET p.title = 'Test Preprint ' + uri
        SET p.doi = '10.1234/citation.test.' + uri
        SET p.createdAt = datetime()
        `,
        { uris: [preprintA, preprintB, preprintC, preprintD, preprintE] }
      );
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    // Clean up all test preprints and their relationships
    const session = connection.getSession();
    try {
      await session.run(
        `
        MATCH (p:Preprint)
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
    // Clean up citation edges between tests, but keep preprint nodes
    const session = connection.getSession();
    try {
      await session.run(
        `
        MATCH (p:Preprint)-[r:CITES]->()
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
    it('should create citation edges between existing preprints', async () => {
      const citations: CitationRelationship[] = [
        {
          citingUri: preprintA,
          citedUri: preprintB,
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
          MATCH (citing:Preprint {uri: $citingUri})-[r:CITES]->(cited:Preprint {uri: $citedUri})
          RETURN r.isInfluential AS isInfluential, r.source AS source
          `,
          { citingUri: preprintA, citedUri: preprintB }
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
          citingUri: preprintA,
          citedUri: preprintB,
          isInfluential: false,
          source: 'openalex',
        },
      ]);

      // Second insert with isInfluential=true (should update, not create duplicate)
      await citationGraph.upsertCitationsBatch([
        {
          citingUri: preprintA,
          citedUri: preprintB,
          isInfluential: true,
          source: 'semantic-scholar',
        },
      ]);

      // Verify only one edge exists with updated properties
      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH (citing:Preprint {uri: $citingUri})-[r:CITES]->(cited:Preprint {uri: $citedUri})
          RETURN count(r) AS edgeCount, r.isInfluential AS isInfluential, r.source AS source
          `,
          { citingUri: preprintA, citedUri: preprintB }
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
          citingUri: preprintA,
          citedUri: preprintB,
          isInfluential: true,
          source: 'semantic-scholar',
        },
        {
          citingUri: preprintA,
          citedUri: preprintC,
          isInfluential: false,
          source: 'semantic-scholar',
        },
        { citingUri: preprintB, citedUri: preprintC, isInfluential: true, source: 'openalex' },
        {
          citingUri: preprintC,
          citedUri: preprintD,
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
          MATCH (p:Preprint)-[r:CITES]->()
          WHERE p.uri IN $uris
          RETURN count(r) AS edgeCount
          `,
          { uris: [preprintA, preprintB, preprintC] }
        );

        expect(result.records[0]?.get('edgeCount')).toBe(4);
      } finally {
        await session.close();
      }
    });

    it('should silently skip citations where citing preprint does not exist', async () => {
      const nonExistentUri = 'at://did:plc:nonexistent/pub.chive.preprint.submission/xyz' as AtUri;

      const citations: CitationRelationship[] = [
        { citingUri: nonExistentUri, citedUri: preprintB, source: 'semantic-scholar' },
      ];

      // Should not throw
      await expect(citationGraph.upsertCitationsBatch(citations)).resolves.not.toThrow();

      // Verify no edges were created
      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH ()-[r:CITES]->(p:Preprint {uri: $uri})
          RETURN count(r) AS edgeCount
          `,
          { uri: preprintB }
        );

        expect(result.records[0]?.get('edgeCount')).toBe(0);
      } finally {
        await session.close();
      }
    });

    it('should silently skip citations where cited preprint does not exist', async () => {
      const nonExistentUri = 'at://did:plc:nonexistent/pub.chive.preprint.submission/xyz' as AtUri;

      const citations: CitationRelationship[] = [
        { citingUri: preprintA, citedUri: nonExistentUri, source: 'semantic-scholar' },
      ];

      await expect(citationGraph.upsertCitationsBatch(citations)).resolves.not.toThrow();

      // Verify no edges were created from preprintA
      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH (p:Preprint {uri: $uri})-[r:CITES]->()
          RETURN count(r) AS edgeCount
          `,
          { uri: preprintA }
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
        { citingUri: preprintA, citedUri: preprintB, source: 'semantic-scholar' },
      ]);

      const afterInsert = new Date();

      const session = connection.getSession();
      try {
        const result = await session.run(
          `
          MATCH (citing:Preprint {uri: $citingUri})-[r:CITES]->(cited:Preprint {uri: $citedUri})
          RETURN r.discoveredAt AS discoveredAt
          `,
          { citingUri: preprintA, citedUri: preprintB }
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
          citingUri: preprintA,
          citedUri: preprintD,
          isInfluential: true,
          source: 'semantic-scholar',
        },
        {
          citingUri: preprintB,
          citedUri: preprintD,
          isInfluential: false,
          source: 'semantic-scholar',
        },
        { citingUri: preprintC, citedUri: preprintD, isInfluential: true, source: 'openalex' },
      ]);
    });

    it('should return all papers that cite the target', async () => {
      const result = await citationGraph.getCitingPapers(preprintD);

      expect(result.citations).toHaveLength(3);
      expect(result.total).toBe(3);

      const citingUris = result.citations.map((c) => c.citingUri);
      expect(citingUris).toContain(preprintA);
      expect(citingUris).toContain(preprintB);
      expect(citingUris).toContain(preprintC);
    });

    it('should include isInfluential flag correctly', async () => {
      const result = await citationGraph.getCitingPapers(preprintD);

      const influentialCount = result.citations.filter((c) => c.isInfluential).length;
      expect(influentialCount).toBe(2);

      const citationFromA = result.citations.find((c) => c.citingUri === preprintA);
      expect(citationFromA?.isInfluential).toBe(true);

      const citationFromB = result.citations.find((c) => c.citingUri === preprintB);
      expect(citationFromB?.isInfluential).toBe(false);
    });

    it('should respect limit option', async () => {
      const result = await citationGraph.getCitingPapers(preprintD, { limit: 2 });

      expect(result.citations).toHaveLength(2);
      expect(result.total).toBe(3); // Total should still reflect all citations
    });

    it('should respect offset option for pagination', async () => {
      const firstPage = await citationGraph.getCitingPapers(preprintD, { limit: 2, offset: 0 });
      const secondPage = await citationGraph.getCitingPapers(preprintD, { limit: 2, offset: 2 });

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
      const result = await citationGraph.getCitingPapers(preprintE);

      expect(result.citations).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should include source information', async () => {
      const result = await citationGraph.getCitingPapers(preprintD);

      const citationFromC = result.citations.find((c) => c.citingUri === preprintC);
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
          citingUri: preprintA,
          citedUri: preprintB,
          isInfluential: true,
          source: 'semantic-scholar',
        },
        {
          citingUri: preprintA,
          citedUri: preprintC,
          isInfluential: false,
          source: 'semantic-scholar',
        },
        { citingUri: preprintA, citedUri: preprintD, isInfluential: true, source: 'openalex' },
      ]);
    });

    it('should return all papers that the target cites (references)', async () => {
      const result = await citationGraph.getReferences(preprintA);

      expect(result.citations).toHaveLength(3);
      expect(result.total).toBe(3);

      const citedUris = result.citations.map((c) => c.citedUri);
      expect(citedUris).toContain(preprintB);
      expect(citedUris).toContain(preprintC);
      expect(citedUris).toContain(preprintD);
    });

    it('should include isInfluential flag correctly', async () => {
      const result = await citationGraph.getReferences(preprintA);

      const referenceToB = result.citations.find((c) => c.citedUri === preprintB);
      expect(referenceToB?.isInfluential).toBe(true);

      const referenceToC = result.citations.find((c) => c.citedUri === preprintC);
      expect(referenceToC?.isInfluential).toBe(false);
    });

    it('should respect limit option', async () => {
      const result = await citationGraph.getReferences(preprintA, { limit: 2 });

      expect(result.citations).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('should return empty result for paper with no references', async () => {
      const result = await citationGraph.getReferences(preprintE);

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
        { citingUri: preprintA, citedUri: preprintB, source: 'semantic-scholar' },
        { citingUri: preprintA, citedUri: preprintC, source: 'semantic-scholar' },
        { citingUri: preprintD, citedUri: preprintB, source: 'semantic-scholar' },
        { citingUri: preprintD, citedUri: preprintC, source: 'semantic-scholar' },
        { citingUri: preprintE, citedUri: preprintB, source: 'semantic-scholar' },
      ]);
    });

    it('should find papers frequently cited together with target', async () => {
      // Find papers co-cited with B
      const result = await citationGraph.findCoCitedPapers(preprintB, 1);

      // C should be co-cited with B (by A and D = 2 co-citations)
      expect(result.length).toBeGreaterThan(0);

      const coC = result.find((p) => p.uri === preprintC);
      expect(coC).toBeDefined();
      expect(coC?.coCitationCount).toBe(2);
    });

    it('should respect minimum co-citation threshold', async () => {
      // With threshold 2, only papers co-cited at least twice should appear
      const result = await citationGraph.findCoCitedPapers(preprintB, 2);

      // Should only include C (co-cited 2 times)
      expect(result.every((p) => p.coCitationCount >= 2)).toBe(true);

      const coC = result.find((p) => p.uri === preprintC);
      expect(coC).toBeDefined();
    });

    it('should exclude self from co-citation results', async () => {
      const result = await citationGraph.findCoCitedPapers(preprintB, 1);

      // B should not appear in its own co-citation list
      const selfCitation = result.find((p) => p.uri === preprintB);
      expect(selfCitation).toBeUndefined();
    });

    it('should return empty for papers with no co-citations', async () => {
      // E is only cited once, so no co-citations possible
      const result = await citationGraph.findCoCitedPapers(preprintE, 1);

      expect(result).toHaveLength(0);
    });

    it('should order results by co-citation count descending', async () => {
      // Add more co-citations to create varied counts
      await citationGraph.upsertCitationsBatch([
        // Another paper F that cites B and C - increases B-C co-citation to 3
        {
          citingUri: createTestUri(TEST_AUTHOR_3, 'f'),
          citedUri: preprintB,
          source: 'semantic-scholar',
        },
      ]);

      // First create the F preprint node
      const session = connection.getSession();
      try {
        const fUri = createTestUri(TEST_AUTHOR_3, 'f');
        await session.run(`MERGE (p:Preprint {uri: $uri}) SET p.title = 'F'`, { uri: fUri });
        await citationGraph.upsertCitationsBatch([
          { citingUri: fUri, citedUri: preprintB, source: 'semantic-scholar' },
          { citingUri: fUri, citedUri: preprintC, source: 'semantic-scholar' },
        ]);
      } finally {
        await session.close();
      }

      const result = await citationGraph.findCoCitedPapers(preprintB, 1);

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
