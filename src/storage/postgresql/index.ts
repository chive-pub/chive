/**
 * PostgreSQL storage module for Chive.
 *
 * @remarks
 * This module provides PostgreSQL-based storage for Chive's local index,
 * implementing the IStorageBackend interface with connection pooling,
 * transaction management, and batch operations.
 *
 * **Key components:**
 * - Connection pool management with health checking
 * - Transaction wrapper with automatic rollback
 * - Type-safe SQL query builders
 * - Storage adapter implementing IStorageBackend
 * - Batch operations for high-performance bulk inserts
 *
 * **Usage:**
 * ```typescript
 * import { getDatabaseConfig, createPool, PostgreSQLAdapter } from './storage/postgresql';
 *
 * const config = getDatabaseConfig();
 * const pool = createPool(config);
 * const storage = new PostgreSQLAdapter(pool);
 *
 * await storage.storePreprint(preprint);
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

export {
  getDatabaseConfig,
  getMigrationConfig,
  type DatabaseConfig,
  type MigrationConfig,
} from './config.js';
export { createPool, healthCheck, getPoolStats, closePool, type PoolStats } from './connection.js';
export {
  withTransaction,
  withSavepoint,
  DeadlockError,
  type IsolationLevel,
  type TransactionOptions,
} from './transaction.js';
export {
  SelectBuilder,
  InsertBuilder,
  UpdateBuilder,
  type BuiltQuery,
  type SortDirection,
  type WhereCondition,
  type ComplexWhereCondition,
  type LogicalWhereCondition,
} from './query-builder.js';
export { PostgreSQLAdapter } from './adapter.js';
export {
  BatchOperations,
  type BatchConfig,
  type BatchResult,
  type BatchFailure,
  type BatchProgressCallback,
} from './batch-operations.js';
export { PDSTracker } from './pds-tracker.js';
export { StalenessDetector } from './staleness-detector.js';
export { PreprintsRepository } from './preprints-repository.js';
export { ReviewsRepository, type StoredReview } from './reviews-repository.js';
