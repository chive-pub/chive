/**
 * Neo4j graph schema integration tests.
 *
 * @remarks
 * Verifies Neo4j graph database configuration:
 * - Constraints created
 * - Indexes exist for performance
 * - Initial data loaded
 * - Facet dimensions bootstrapped
 *
 * @packageDocumentation
 */

import { Driver, Node, Integer } from 'neo4j-driver';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createNeo4jDriver } from '@/storage/neo4j/setup.js';

/**
 * Type definitions for Neo4j query results
 */

interface ConstraintRecord {
  name: string;
  type: string;
}

interface FieldProperties {
  id: string;
  label: string;
  type: string;
}

interface FacetDimensionProperties {
  name: string;
  order: number;
}

interface FieldNodeRecord {
  f: Node<Integer, FieldProperties>;
}

interface FacetDimensionNodeRecord {
  fd: Node<Integer, FacetDimensionProperties>;
}

interface FacetDimensionNameRecord {
  name: string;
  order: number;
}

describe('Neo4j Schema', () => {
  let driver: Driver;

  beforeAll(() => {
    driver = createNeo4jDriver();
    // Note: Schema setup is run in global setup (tests/setup/global-setup.ts)
  });

  afterAll(async () => {
    await driver.close();
  });

  describe('Constraints', () => {
    it('creates unique constraint on Field.id', async () => {
      const session = driver.session();
      try {
        const result = await session.run('SHOW CONSTRAINTS');
        const constraints = result.records.map(
          (record): ConstraintRecord => ({
            name: record.get('name') as string,
            type: record.get('type') as string,
          })
        );

        const fieldIdConstraint = constraints.find((c) => c.name === 'field_id_unique');
        expect(fieldIdConstraint).toBeDefined();
        if (fieldIdConstraint) {
          expect(fieldIdConstraint.type).toBe('UNIQUENESS');
        }
      } finally {
        await session.close();
      }
    });

    it('creates unique constraint on AuthorityRecord.id', async () => {
      const session = driver.session();
      try {
        const result = await session.run('SHOW CONSTRAINTS');
        const constraints = result.records.map((record): string => record.get('name') as string);

        expect(constraints).toContain('authority_id_unique');
      } finally {
        await session.close();
      }
    });

    it('creates unique constraint on WikidataEntity.qid', async () => {
      const session = driver.session();
      try {
        const result = await session.run('SHOW CONSTRAINTS');
        const constraints = result.records.map((record): string => record.get('name') as string);

        expect(constraints).toContain('wikidata_id_unique');
      } finally {
        await session.close();
      }
    });

    it('creates unique constraint on Preprint.uri', async () => {
      const session = driver.session();
      try {
        const result = await session.run('SHOW CONSTRAINTS');
        const constraints = result.records.map((record): string => record.get('name') as string);

        expect(constraints).toContain('preprint_uri_unique');
      } finally {
        await session.close();
      }
    });

    it('creates unique constraint on Author.did', async () => {
      const session = driver.session();
      try {
        const result = await session.run('SHOW CONSTRAINTS');
        const constraints = result.records.map((record): string => record.get('name') as string);

        expect(constraints).toContain('author_did_unique');
      } finally {
        await session.close();
      }
    });
  });

  describe('Indexes', () => {
    it('creates index on Field.label', async () => {
      const session = driver.session();
      try {
        const result = await session.run('SHOW INDEXES');
        const indexes = result.records.map((record): string => record.get('name') as string);

        expect(indexes).toContain('field_label_idx');
      } finally {
        await session.close();
      }
    });

    it('creates index on AuthorityRecord.authorized_heading', async () => {
      const session = driver.session();
      try {
        const result = await session.run('SHOW INDEXES');
        const indexes = result.records.map((record): string => record.get('name') as string);

        expect(indexes).toContain('authority_heading_idx');
      } finally {
        await session.close();
      }
    });

    it('creates index on WikidataEntity.qid', async () => {
      const session = driver.session();
      try {
        const result = await session.run('SHOW INDEXES');
        const indexes = result.records.map((record): string => record.get('name') as string);

        // Uniqueness constraint on qid creates a backing index
        expect(indexes).toContain('wikidata_id_unique');
      } finally {
        await session.close();
      }
    });
  });

  describe('Initial Data', () => {
    it('creates root field node', async () => {
      const session = driver.session();
      try {
        const result = await session.run<FieldNodeRecord>('MATCH (f:Field {id: $id}) RETURN f', {
          id: 'root',
        });

        expect(result.records).toHaveLength(1);
        const record = result.records[0];
        expect(record).toBeDefined();

        if (!record) return;

        const fieldNode = record.get('f');
        expect(fieldNode).toBeDefined();

        if (!fieldNode) return;

        const field = fieldNode.properties;
        expect(field).toBeDefined();
        expect(field.label).toBe('All Fields');
        expect(field.type).toBe('root');
      } finally {
        await session.close();
      }
    });

    it('creates 10 facet dimension templates', async () => {
      const session = driver.session();
      try {
        const result = await session.run<FacetDimensionNodeRecord>(
          'MATCH (fd:FacetDimension) RETURN fd ORDER BY fd.order'
        );

        expect(result.records).toHaveLength(10);

        const dimensions = result.records
          .map((record): string | null => {
            const node = record.get('fd');
            return node ? node.properties.name : null;
          })
          .filter((name): name is string => name !== null);

        expect(dimensions).toContain('personality');
        expect(dimensions).toContain('matter');
        expect(dimensions).toContain('energy');
        expect(dimensions).toContain('space');
        expect(dimensions).toContain('time');
        expect(dimensions).toContain('form');
        expect(dimensions).toContain('topical');
        expect(dimensions).toContain('geographic');
        expect(dimensions).toContain('chronological');
        expect(dimensions).toContain('event');
      } finally {
        await session.close();
      }
    });

    it('PMEST dimensions ordered correctly', async () => {
      const session = driver.session();
      try {
        const result = await session.run<FacetDimensionNameRecord>(`
          MATCH (fd:FacetDimension)
          WHERE fd.name IN ['personality', 'matter', 'energy', 'space', 'time']
          RETURN fd.name AS name, fd.order AS order
          ORDER BY fd.order
        `);

        const dimensions = result.records.map((record): string => record.get('name'));
        expect(dimensions).toEqual(['personality', 'matter', 'energy', 'space', 'time']);
      } finally {
        await session.close();
      }
    });
  });

  describe('Health Check', () => {
    it('connection is healthy', async () => {
      const session = driver.session();
      try {
        const result = await session.run('RETURN 1');
        expect(result.records).toHaveLength(1);
      } finally {
        await session.close();
      }
    });
  });
});
