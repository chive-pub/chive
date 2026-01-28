#!/usr/bin/env tsx

/**
 * Cleanup script for legacy Concept nodes in Neo4j.
 *
 * @remarks
 * Removes all Concept nodes and their relationships from Neo4j.
 * Concept nodes are legacy and have been replaced by the unified Node model.
 * This script also removes Concept-specific constraints and indexes.
 *
 * @packageDocumentation
 */

import neo4j from 'neo4j-driver';
import { createNeo4jDriver } from '../../src/storage/neo4j/setup.js';

const NEO4J_URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'password';

async function main(): Promise<void> {
  console.log('===========================================');
  console.log('Concept Nodes Cleanup Script');
  console.log('===========================================');
  console.log(`Neo4j URI: ${NEO4J_URI}`);
  console.log();

  // Connect to Neo4j
  console.log('Connecting to Neo4j...');
  const driver = createNeo4jDriver();
  const session = driver.session();
  console.log('Connected.\n');

  try {
    // Count Concept nodes before deletion
    const countResult = await session.run('MATCH (c:Concept) RETURN count(c) as count');
    const conceptCount = countResult.records[0]?.get('count')?.toNumber() ?? 0;
    console.log(`Found ${conceptCount} Concept nodes to delete.\n`);

    if (conceptCount === 0) {
      console.log('No Concept nodes found. Nothing to clean up.');
      return;
    }

    // Delete Concept nodes and all their relationships
    console.log('Deleting Concept nodes and relationships...');
    const deleteResult = await session.run(
      'MATCH (c:Concept) DETACH DELETE c RETURN count(c) as deleted'
    );
    const deletedCount = deleteResult.records[0]?.get('deleted')?.toNumber() ?? 0;
    console.log(`Deleted ${deletedCount} Concept nodes.\n`);

    // Drop Concept-specific constraints
    console.log('Dropping Concept constraints...');
    const constraints = [
      'CONSTRAINT concept_id_unique IF EXISTS',
      'CONSTRAINT concept_slug_unique IF EXISTS',
    ];

    for (const constraint of constraints) {
      try {
        await session.run(`DROP ${constraint}`);
        console.log(`  Dropped ${constraint}`);
      } catch (error) {
        // Constraint might not exist, which is fine
        console.log(`  Constraint ${constraint} does not exist (skipping)`);
      }
    }

    // Drop Concept-specific indexes
    console.log('\nDropping Concept indexes...');
    const indexes = ['INDEX concept_id_index IF EXISTS', 'INDEX concept_slug_index IF EXISTS'];

    for (const index of indexes) {
      try {
        await session.run(`DROP ${index}`);
        console.log(`  Dropped ${index}`);
      } catch (error) {
        // Index might not exist, which is fine
        console.log(`  Index ${index} does not exist (skipping)`);
      }
    }

    console.log('\n===========================================');
    console.log('Concept nodes cleanup complete!');
    console.log(`Deleted ${deletedCount} Concept nodes.`);
    console.log('===========================================');
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
