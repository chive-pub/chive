/**
 * Neo4j graph database setup and management.
 *
 * @remarks
 * Sets up Neo4j schema for Chive's knowledge graph:
 * - Unique constraints on node IDs
 * - Indexes for search performance
 * - Initial facet dimension data
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import neo4j, { Driver, Session } from 'neo4j-driver';

import { DatabaseError } from '../../types/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Neo4j connection configuration.
 *
 * @public
 */
export interface Neo4jConfig {
  /**
   * Neo4j connection URI.
   *
   * @defaultValue 'bolt://localhost:7687'
   */
  uri: string;

  /**
   * Username.
   *
   * @defaultValue 'neo4j'
   */
  username: string;

  /**
   * Password.
   */
  password: string;
}

/**
 * Loads Neo4j configuration from environment.
 *
 * @returns Neo4j driver configuration
 *
 * @remarks
 * Environment variables:
 * - `NEO4J_URI` - Connection URI (default: bolt://localhost:7687)
 * - `NEO4J_USER` - Username (default: neo4j)
 * - `NEO4J_PASSWORD` - Password (default: chive_test_password)
 *
 * @public
 */
export function getNeo4jConfig(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    username: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'chive_test_password',
  };
}

/**
 * Loads Chive Governance DID from environment.
 *
 * @returns Governance DID for community-approved authority records
 *
 * @remarks
 * Environment variable:
 * - `CHIVE_GOVERNANCE_DID` - DID for governance PDS (default: did:plc:chive-governance)
 *
 * The governance DID represents the community-controlled PDS where approved
 * authority records, field proposals, and other governance data are stored.
 *
 * @public
 */
export function getGovernanceDid(): string {
  return process.env.CHIVE_GOVERNANCE_DID ?? 'did:plc:chive-governance';
}

/**
 * Creates Neo4j driver instance.
 *
 * @returns Configured Neo4j driver
 *
 * @public
 */
export function createNeo4jDriver(): Driver {
  const config = getNeo4jConfig();
  // disableLosslessIntegers: true makes the driver return native JavaScript numbers
  // instead of Integer objects. See: https://neo4j.com/docs/api/javascript-driver/current/
  return neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
    disableLosslessIntegers: true,
  });
}

/**
 * Loads Cypher script from file.
 *
 * @param filename - Relative path to Cypher file
 * @returns Cypher script content
 */
function loadCypher(filename: string): string {
  const path = join(__dirname, 'schema', filename);
  return readFileSync(path, 'utf-8');
}

/**
 * Executes Cypher script with multiple statements.
 *
 * @param session - Neo4j session
 * @param script - Cypher script (multiple statements separated by semicolons)
 *
 * @remarks
 * Splits script by semicolons and executes each statement separately.
 * Skips empty statements (whitespace or comments).
 */
async function executeCypherScript(session: Session, script: string): Promise<void> {
  const statements = script
    .split(';')
    .map((s) => {
      // Remove comment lines and trim
      const lines = s.split('\n');
      const codeLines = lines.filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('//');
      });
      return codeLines.join('\n').trim();
    })
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await session.run(statement);
  }
}

/**
 * Creates constraints on node properties.
 *
 * @param driver - Neo4j driver
 *
 * @remarks
 * Constraints enforce:
 * - Unique IDs (Field, AuthorityRecord, WikidataEntity, etc.)
 * - Required properties (labels, headings)
 *
 * @public
 */
export async function setupConstraints(driver: Driver): Promise<void> {
  const session = driver.session();
  try {
    const script = loadCypher('constraints.cypher');
    await executeCypherScript(session, script);
  } finally {
    await session.close();
  }
}

/**
 * Creates indexes for query performance.
 *
 * @param driver - Neo4j driver
 *
 * @remarks
 * Indexes enable fast lookups on:
 * - Field labels (search)
 * - Authority headings (autocomplete)
 * - Wikidata QIDs (external linking)
 *
 * @public
 */
export async function setupIndexes(driver: Driver): Promise<void> {
  const session = driver.session();
  try {
    const script = loadCypher('indexes.cypher');
    await executeCypherScript(session, script);
  } finally {
    await session.close();
  }
}

/**
 * Creates initial data (root nodes, facet dimensions).
 *
 * @param driver - Neo4j driver
 *
 * @remarks
 * Bootstraps knowledge graph with:
 * - Root field node
 * - 10 facet dimension templates (PMEST + FAST)
 *
 * Uses MERGE to avoid duplicates on repeated runs.
 *
 * @public
 */
export async function bootstrapInitialData(driver: Driver): Promise<void> {
  const session = driver.session();
  try {
    const script = loadCypher('initial-data.cypher');
    await executeCypherScript(session, script);
  } finally {
    await session.close();
  }
}

/**
 * Checks Neo4j connection health.
 *
 * @param driver - Neo4j driver
 * @returns True if connection is healthy
 *
 * @remarks
 * Verifies driver can connect to Neo4j server.
 *
 * @public
 */
export async function checkHealth(driver: Driver): Promise<boolean> {
  const session = driver.session();
  try {
    await session.run('RETURN 1');
    return true;
  } catch {
    return false;
  } finally {
    await session.close();
  }
}

/**
 * Sets up all Neo4j resources.
 *
 * @param driver - Neo4j driver
 *
 * @remarks
 * Performs complete setup:
 * 1. Create constraints
 * 2. Create indexes
 * 3. Bootstrap initial data
 * 4. Verify health
 *
 * @throws Error if health check fails
 *
 * @example
 * ```typescript
 * import { createNeo4jDriver, setupNeo4j } from './setup.js';
 *
 * const driver = createNeo4jDriver();
 * try {
 *   await setupNeo4j(driver);
 *   console.log('Neo4j ready');
 * } finally {
 *   await driver.close();
 * }
 * ```
 *
 * @public
 */
export async function setupNeo4j(driver: Driver): Promise<void> {
  await setupConstraints(driver);
  await setupIndexes(driver);
  await bootstrapInitialData(driver);

  const healthy = await checkHealth(driver);
  if (!healthy) {
    throw new DatabaseError('HEALTH_CHECK', 'Neo4j connection is not healthy');
  }
}
