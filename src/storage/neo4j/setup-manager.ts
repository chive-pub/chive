import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { singleton } from 'tsyringe';

import { DatabaseError } from '../../types/errors.js';

import { Neo4jConnection } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration options for Neo4j setup and initialization
 */
export interface SetupOptions {
  skipConstraints?: boolean;
  skipIndexes?: boolean;
  skipInitialData?: boolean;
  verifySchema?: boolean;
}

/**
 * Schema version information for migration tracking
 */
export interface SchemaVersion {
  version: string;
  appliedAt: Date;
  description: string;
}

/**
 * Schema statistics for monitoring
 */
export interface SchemaStats {
  nodeCount: number;
  relationshipCount: number;
  constraintCount: number;
  indexCount: number;
}

/**
 * Neo4j database setup and schema management.
 *
 * Handles constraint creation, index setup, initial data loading,
 * and schema version verification for the knowledge graph.
 *
 * @example
 * ```typescript
 * const setupManager = container.resolve(Neo4jSetupManager);
 * await setupManager.initialize({
 *   skipInitialData: false,
 *   verifySchema: true
 * });
 * ```
 */
@singleton()
export class Neo4jSetupManager {
  private static readonly SCHEMA_VERSION = '0.1.0';

  constructor(private connection: Neo4jConnection) {}

  /**
   * Initialize Neo4j database with schema, constraints, indexes, and initial data.
   *
   * Executes schema setup in the correct order:
   * 1. Create constraints (uniqueness, node keys)
   * 2. Create indexes (performance optimization)
   * 3. Load initial data (facet dimensions, root nodes)
   * 4. Verify schema version (if requested)
   *
   * @param options - Setup configuration options
   * @throws {Error} If schema setup fails
   *
   * @example
   * ```typescript
   * await setupManager.initialize({
   *   skipConstraints: false,  // Create all constraints
   *   skipIndexes: false,      // Create all indexes
   *   skipInitialData: false,  // Load facet dimensions
   *   verifySchema: true       // Verify compatibility
   * });
   * ```
   */
  async initialize(options: SetupOptions = {}): Promise<void> {
    if (!options.skipConstraints) {
      await this.createConstraints();
    }

    if (!options.skipIndexes) {
      await this.createIndexes();
    }

    if (!options.skipInitialData) {
      await this.loadInitialData();
    }

    if (options.verifySchema) {
      await this.verifySchemaVersion();
    }
  }

  /**
   * Create all database constraints from constraints.cypher file.
   *
   * Constraints enforce data integrity:
   * - Unique constraints prevent duplicates
   * - Node key constraints ensure composite uniqueness
   * - Existence constraints require properties
   *
   * @throws {Error} If constraint creation fails
   */
  private async createConstraints(): Promise<void> {
    const constraintsFile = join(__dirname, 'schema', 'constraints.cypher');
    const constraints = readFileSync(constraintsFile, 'utf-8');

    const statements = this.parseStatements(constraints);

    for (const statement of statements) {
      try {
        await this.connection.executeQuery(statement + ';');
      } catch (err) {
        // Ignore "already exists" errors for idempotency
        const error = err instanceof Error ? err : new Error(String(err));
        if (!error.message.includes('already exists')) {
          throw new DatabaseError(
            'CREATE_CONSTRAINT',
            `Failed to create constraint: ${error.message}\nStatement: ${statement}`,
            error
          );
        }
      }
    }
  }

  /**
   * Create all database indexes from indexes.cypher file.
   *
   * Indexes improve query performance:
   * - Single-property indexes for common filters
   * - Composite indexes for multi-property queries
   * - Full-text indexes for search functionality
   *
   * @throws {Error} If index creation fails
   */
  private async createIndexes(): Promise<void> {
    const indexesFile = join(__dirname, 'schema', 'indexes.cypher');
    const indexes = readFileSync(indexesFile, 'utf-8');

    const statements = this.parseStatements(indexes);

    for (const statement of statements) {
      try {
        await this.connection.executeQuery(statement + ';');
      } catch (err) {
        // Ignore "already exists" errors for idempotency
        const error = err instanceof Error ? err : new Error(String(err));
        if (!error.message.includes('already exists')) {
          throw new DatabaseError(
            'CREATE_INDEX',
            `Failed to create index: ${error.message}\nStatement: ${statement}`,
            error
          );
        }
      }
    }
  }

  /**
   * Load initial data from initial-data.cypher file.
   *
   * Initial data includes:
   * - Root knowledge graph nodes
   * - 10 facet dimensions (PMEST + FAST)
   * - Sample fields for testing (if applicable)
   *
   * @throws {Error} If data loading fails
   */
  private async loadInitialData(): Promise<void> {
    const dataFile = join(__dirname, 'schema', 'initial-data.cypher');
    const data = readFileSync(dataFile, 'utf-8');

    const statements = this.parseStatements(data);

    for (const statement of statements) {
      try {
        await this.connection.executeQuery(statement + ';');
      } catch (err) {
        // Log but don't fail on duplicate data (MERGE should handle)
        const error = err instanceof Error ? err : new Error(String(err));
        console.warn(`Warning during initial data load: ${error.message}`);
      }
    }
  }

  /**
   * Parse Cypher file into executable statements.
   *
   * Handles:
   * - Comment removal (// comments)
   * - Statement splitting (by semicolon)
   * - Whitespace normalization
   *
   * @param content - Raw Cypher file content
   * @returns Array of executable Cypher statements
   */
  private parseStatements(content: string): string[] {
    // Remove single-line comments
    const withoutComments = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    // Split by semicolon and clean up
    return withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Verify schema version compatibility.
   *
   * Checks that the database schema version matches the application version.
   * Creates version tracking node if it doesn't exist.
   *
   * @throws {Error} If schema version is incompatible
   */
  private async verifySchemaVersion(): Promise<void> {
    // Get current schema version from database
    const result = await this.connection.executeQuery<{
      version: string;
      appliedAt: string;
    }>(
      `
      MATCH (v:SchemaVersion)
      RETURN v.version as version, v.appliedAt as appliedAt
      ORDER BY v.appliedAt DESC
      LIMIT 1
      `
    );

    if (result.records.length === 0) {
      // First time setup: create version node
      await this.connection.executeQuery(
        `
        CREATE (v:SchemaVersion {
          version: $version,
          appliedAt: datetime(),
          description: 'Initial schema setup'
        })
        `,
        { version: Neo4jSetupManager.SCHEMA_VERSION }
      );
      return;
    }

    const record = result.records[0];
    if (!record) {
      throw new DatabaseError(
        'READ',
        'Failed to retrieve schema version from database: no record returned'
      );
    }

    const dbVersion = record.get('version');

    if (dbVersion !== Neo4jSetupManager.SCHEMA_VERSION) {
      throw new DatabaseError(
        'SCHEMA_VERSION',
        `Schema version mismatch: database is ${dbVersion}, application expects ${Neo4jSetupManager.SCHEMA_VERSION}`
      );
    }
  }

  /**
   * Drop all constraints and indexes (for testing or migration).
   *
   * WARNING: This operation cannot be undone. Use with caution.
   *
   * @example
   * ```typescript
   * // Only use in test environments
   * if (process.env.NODE_ENV === 'test') {
   *   await setupManager.dropAll();
   * }
   * ```
   */
  async dropAll(): Promise<void> {
    // Get all constraints
    const constraintsResult = await this.connection.executeQuery<{
      name: string;
    }>('SHOW CONSTRAINTS');

    for (const record of constraintsResult.records) {
      const name = record.get('name');
      await this.connection.executeQuery(`DROP CONSTRAINT ${name} IF EXISTS`);
    }

    // Get all indexes
    const indexesResult = await this.connection.executeQuery<{ name: string }>('SHOW INDEXES');

    for (const record of indexesResult.records) {
      const name = record.get('name');
      await this.connection.executeQuery(`DROP INDEX ${name} IF EXISTS`);
    }
  }

  /**
   * Get current schema statistics for monitoring.
   *
   * @returns Object with counts of nodes, relationships, constraints, and indexes
   */
  async getSchemaStats(): Promise<SchemaStats> {
    const nodeResult = await this.connection.executeQuery<{ count: number }>(
      'MATCH (n) RETURN count(n) as count'
    );
    const nodeCount = Number(nodeResult.records[0]?.get('count')) || 0;

    const relResult = await this.connection.executeQuery<{ count: number }>(
      'MATCH ()-[r]->() RETURN count(r) as count'
    );
    const relationshipCount = Number(relResult.records[0]?.get('count')) || 0;

    const constraintResult = await this.connection.executeQuery<{
      count: number;
    }>('SHOW CONSTRAINTS YIELD name RETURN count(name) as count');
    const constraintCount = Number(constraintResult.records[0]?.get('count')) || 0;

    const indexResult = await this.connection.executeQuery<{ count: number }>(
      'SHOW INDEXES YIELD name RETURN count(name) as count'
    );
    const indexCount = Number(indexResult.records[0]?.get('count')) || 0;

    return {
      nodeCount,
      relationshipCount,
      constraintCount,
      indexCount,
    };
  }
}
