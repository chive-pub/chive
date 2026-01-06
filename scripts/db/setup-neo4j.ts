#!/usr/bin/env tsx

/**
 * Neo4j setup script.
 *
 * @remarks
 * Creates constraints, indexes, and initial data.
 *
 * @packageDocumentation
 */

import { createNeo4jDriver, setupNeo4j } from '../../src/storage/neo4j/setup.js';

async function main(): Promise<void> {
  const driver = createNeo4jDriver();

  try {
    console.log('Setting up Neo4j...');
    await setupNeo4j(driver);
    console.log('Neo4j setup complete');
  } catch (error) {
    console.error('Neo4j setup failed:', error);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

main();
