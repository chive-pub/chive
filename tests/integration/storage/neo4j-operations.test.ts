/**
 * Neo4j graph operations integration tests.
 *
 * @remarks
 * Tests Neo4j adapter, field repository, and authority control
 * operations against a real Neo4j database instance.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { Driver, Node, Integer } from 'neo4j-driver';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { Neo4jAdapter } from '@/storage/neo4j/adapter.js';
import { Neo4jConnection } from '@/storage/neo4j/connection.js';
import { createNeo4jDriver } from '@/storage/neo4j/setup.js';

interface FieldProperties {
  id: string;
  label: string;
  type: string;
  description?: string;
}

interface FieldNodeRecord {
  f: Node<Integer, FieldProperties>;
}

describe('Neo4j Operations', () => {
  let driver: Driver;
  let connection: Neo4jConnection;
  let adapter: Neo4jAdapter;

  beforeAll(async () => {
    driver = createNeo4jDriver();
    connection = new Neo4jConnection();
    await connection.initialize({
      uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
      username: process.env.NEO4J_USER ?? 'neo4j',
      password: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
      database: process.env.NEO4J_DATABASE ?? 'neo4j',
    });
    adapter = new Neo4jAdapter(connection);
  });

  afterAll(async () => {
    await connection.close();
    await driver.close();
  });

  describe('Field Operations', () => {
    const testFieldId = `test-field-${Date.now()}`;

    beforeEach(async () => {
      // Clean up test field if exists
      const session = driver.session();
      try {
        await session.run('MATCH (f:Field {id: $id}) DETACH DELETE f', { id: testFieldId });
      } finally {
        await session.close();
      }
    });

    it('should create a field node', async () => {
      await adapter.upsertField({
        id: testFieldId,
        label: 'Test Field',
        type: 'field',
        description: 'A test field',
      });

      const session = driver.session();
      try {
        const result = await session.run<FieldNodeRecord>('MATCH (f:Field {id: $id}) RETURN f', {
          id: testFieldId,
        });

        expect(result.records).toHaveLength(1);
        const field = result.records[0]?.get('f').properties;
        expect(field).toBeDefined();
        expect(field?.label).toBe('Test Field');
        expect(field?.description).toBe('A test field');
      } finally {
        await session.close();
      }
    });

    it('should update an existing field node', async () => {
      // Create initial field
      await adapter.upsertField({
        id: testFieldId,
        label: 'Initial Label',
        type: 'field',
      });

      // Update field
      await adapter.upsertField({
        id: testFieldId,
        label: 'Updated Label',
        type: 'field',
        description: 'Updated description',
      });

      const session = driver.session();
      try {
        const result = await session.run<FieldNodeRecord>('MATCH (f:Field {id: $id}) RETURN f', {
          id: testFieldId,
        });

        expect(result.records).toHaveLength(1);
        const field = result.records[0]?.get('f').properties;
        expect(field).toBeDefined();
        expect(field?.label).toBe('Updated Label');
        expect(field?.description).toBe('Updated description');
      } finally {
        await session.close();
      }
    });

    it('should retrieve field by ID', async () => {
      await adapter.upsertField({
        id: testFieldId,
        label: 'Test Field',
        type: 'field',
      });

      const field = await adapter.getField(testFieldId);

      expect(field).toBeDefined();
      expect(field?.id).toBe(testFieldId);
      expect(field?.label).toBe('Test Field');
    });

    it('should return null for non-existent field', async () => {
      const field = await adapter.getField('non-existent-field');
      expect(field).toBeNull();
    });
  });

  describe('Field Relationships', () => {
    const parentFieldId = `test-parent-${Date.now()}`;
    const childFieldId = `test-child-${Date.now()}`;

    beforeEach(async () => {
      // Clean up test fields
      const session = driver.session();
      try {
        await session.run('MATCH (f:Field) WHERE f.id IN [$parent, $child] DETACH DELETE f', {
          parent: parentFieldId,
          child: childFieldId,
        });
      } finally {
        await session.close();
      }

      // Create test fields
      await adapter.upsertField({
        id: parentFieldId,
        label: 'Parent Field',
        type: 'field',
      });

      await adapter.upsertField({
        id: childFieldId,
        label: 'Child Field',
        type: 'field',
      });
    });

    it('should create narrower relationship', async () => {
      await adapter.createRelationship({
        fromId: childFieldId,
        toId: parentFieldId,
        type: 'narrower',
        strength: 1.0,
      });

      const session = driver.session();
      try {
        const result = await session.run(
          `MATCH (child:Field {id: $childId})-[r:NARROWER_THAN]->(parent:Field {id: $parentId})
           RETURN r`,
          { childId: childFieldId, parentId: parentFieldId }
        );

        expect(result.records).toHaveLength(1);
      } finally {
        await session.close();
      }
    });

    it('should find related fields', async () => {
      await adapter.createRelationship({
        fromId: childFieldId,
        toId: parentFieldId,
        type: 'narrower',
      });

      const related = await adapter.findRelatedFields(childFieldId, 1);

      expect(related.length).toBeGreaterThan(0);
      expect(related.some((f) => f.id === parentFieldId)).toBe(true);
    });
  });

  describe('Connection Health', () => {
    it('should report healthy connection', async () => {
      const health = await connection.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should execute queries successfully', async () => {
      const result = await connection.executeQuery<{ test: number | Integer }>(
        'RETURN 1 as test',
        {}
      );

      expect(result.records).toHaveLength(1);
      const record = result.records[0];
      expect(record).toBeDefined();

      if (!record) return;

      const testValue = record.get('test');
      expect(testValue).toBeDefined();

      // With disableLosslessIntegers: true, Neo4j returns plain numbers
      // Otherwise it returns Integer objects
      if (Integer.isInteger(testValue)) {
        expect(testValue.toInt()).toBe(1);
      } else {
        expect(testValue).toBe(1);
      }
    });
  });
});
