/**
 * Transaction management with automatic rollback on errors.
 *
 * @remarks
 * Provides safe transaction handling with guaranteed cleanup. Transactions
 * automatically commit on success and roll back on errors, preventing
 * partial writes and data corruption.
 *
 * Supports savepoints for nested transactions, allowing partial rollback
 * within a larger transaction. Includes deadlock retry logic for concurrent
 * workloads.
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { Pool, PoolClient } from 'pg';

import { createLogger } from '../../observability/logger.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { Err, Ok, type Result } from '../../types/result.js';

/**
 * Module-level logger for transaction operations.
 */
const logger: ILogger = createLogger({ service: 'postgresql-transaction' });

/**
 * Transaction isolation level.
 *
 * @remarks
 * PostgreSQL supports four isolation levels. Default is READ COMMITTED.
 *
 * - **READ UNCOMMITTED**: Not implemented (behaves as READ COMMITTED)
 * - **READ COMMITTED**: See committed changes from other transactions
 * - **REPEATABLE READ**: Consistent snapshot within transaction
 * - **SERIALIZABLE**: Full serializability (may cause serialization failures)
 *
 * Use REPEATABLE READ or SERIALIZABLE for operations requiring consistency
 * across multiple queries (e.g., read-modify-write cycles).
 *
 * @public
 */
export type IsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

/**
 * Options for transaction execution.
 *
 * @public
 */
export interface TransactionOptions {
  /**
   * Transaction isolation level.
   *
   * @defaultValue 'READ COMMITTED'
   */
  readonly isolationLevel?: IsolationLevel;

  /**
   * Maximum retry attempts for deadlock errors.
   *
   * @remarks
   * Deadlocks can occur with concurrent transactions. PostgreSQL detects
   * deadlocks and aborts one transaction with error code 40P01.
   *
   * This option automatically retries the transaction up to the specified
   * number of times before giving up.
   *
   * @defaultValue 3
   */
  readonly maxRetries?: number;

  /**
   * Delay between retry attempts in milliseconds.
   *
   * @remarks
   * Exponential backoff: delay doubles after each retry.
   *
   * @defaultValue 100
   */
  readonly retryDelay?: number;
}

/**
 * Error indicating deadlock detection.
 *
 * @remarks
 * PostgreSQL error code 40P01 signals deadlock. Transaction should be retried.
 *
 * @public
 */
export class DeadlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeadlockError';
  }
}

/**
 * Executes function within a transaction with automatic commit/rollback.
 *
 * @typeParam T - Return type of the transaction function
 * @param pool - Database connection pool
 * @param fn - Function to execute within transaction
 * @param options - Transaction options (isolation level, retries)
 * @returns Result containing function return value or error
 *
 * @remarks
 * The transaction function receives a PoolClient for executing queries.
 * All queries within the function execute in the same transaction.
 *
 * **Transaction lifecycle:**
 * 1. Acquire client from pool
 * 2. Execute `BEGIN` with isolation level
 * 3. Run function with client
 * 4. On success: `COMMIT`
 * 5. On error: `ROLLBACK`
 * 6. Always release client to pool
 *
 * **Deadlock handling:**
 * If a deadlock occurs (PostgreSQL error 40P01), the transaction is
 * automatically retried up to `maxRetries` times with exponential backoff.
 *
 * @example
 * ```typescript
 * import { withTransaction } from './transaction.js';
 *
 * const result = await withTransaction(pool, async (client) => {
 *   // Insert eprint
 *   await client.query(
 *     'INSERT INTO eprint_index (uri, title, author) VALUES ($1, $2, $3)',
 *     ['at://did:plc:abc/pub.chive.eprint.submission/xyz', 'Title', 'did:plc:abc']
 *   );
 *
 *   // Insert author metadata (same transaction)
 *   await client.query(
 *     'INSERT INTO eprint_authors (uri, author_did, position) VALUES ($1, $2, $3)',
 *     ['at://did:plc:abc/pub.chive.eprint.submission/xyz', 'did:plc:abc', 0]
 *   );
 *
 *   return { success: true };
 * });
 *
 * if (!result.ok) {
 *   console.error('Transaction failed:', result.error);
 * }
 * ```
 *
 * @example
 * With SERIALIZABLE isolation:
 * ```typescript
 * const result = await withTransaction(
 *   pool,
 *   async (client) => {
 *     // Read current value
 *     const res = await client.query('SELECT balance FROM accounts WHERE id = $1', [123]);
 *     const balance = res.rows[0].balance;
 *
 *     // Update based on read (serializable ensures consistency)
 *     await client.query('UPDATE accounts SET balance = $1 WHERE id = $2', [
 *       balance + 100,
 *       123,
 *     ]);
 *   },
 *   { isolationLevel: 'SERIALIZABLE', maxRetries: 5 }
 * );
 * ```
 *
 * @see {@link withSavepoint}
 * @public
 * @since 0.1.0
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<Result<T, Error>> {
  const isolationLevel = options.isolationLevel ?? 'READ COMMITTED';
  const maxRetries = options.maxRetries ?? 3;
  const retryDelay = options.retryDelay ?? 100;

  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;

    const client = await pool.connect();

    try {
      // Begin transaction with isolation level
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);

      // Execute transaction function
      const result = await fn(client);

      // Commit transaction
      await client.query('COMMIT');

      return Ok(result);
    } catch (error) {
      // Rollback transaction on error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Log rollback failure but don't throw
        logger.error(
          'Failed to rollback transaction',
          rollbackError instanceof Error ? rollbackError : undefined,
          { details: rollbackError instanceof Error ? undefined : String(rollbackError) }
        );
      }

      // Check if error is deadlock (PostgreSQL error code 40P01)
      const isDeadlock =
        error instanceof Error && 'code' in error && (error as { code: string }).code === '40P01';

      if (isDeadlock && attempt < maxRetries) {
        // Retry after exponential backoff delay
        const delay = retryDelay * Math.pow(2, attempt - 1);
        logger.warn('Deadlock detected, retrying', {
          delayMs: delay,
          attempt,
          maxRetries,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Return error (no more retries or non-deadlock error)
      if (isDeadlock) {
        return Err(new DeadlockError(`Deadlock after ${maxRetries} retries`));
      }

      return Err(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Always release client back to pool
      client.release();
    }
  }

  // Should never reach here, but TypeScript requires it
  return Err(new Error('Transaction failed after max retries'));
}

/**
 * Executes function within a savepoint for nested transactions.
 *
 * @typeParam T - Return type of the savepoint function
 * @param client - Database client (must be in transaction)
 * @param name - Savepoint name (must be unique within transaction)
 * @param fn - Function to execute within savepoint
 * @returns Result containing function return value or error
 *
 * @remarks
 * Savepoints allow partial rollback within a larger transaction. If the
 * savepoint function fails, only changes within the savepoint are rolled
 * back. The outer transaction can continue.
 *
 * **Use cases:**
 * - Optional operations that shouldn't abort entire transaction
 * - Partial rollback on validation errors
 * - Nested transaction logic
 *
 * **Savepoint lifecycle:**
 * 1. Create savepoint: `SAVEPOINT name`
 * 2. Execute function
 * 3. On success: `RELEASE SAVEPOINT name`
 * 4. On error: `ROLLBACK TO SAVEPOINT name`
 *
 * @example
 * ```typescript
 * import { withTransaction, withSavepoint } from './transaction.js';
 *
 * await withTransaction(pool, async (client) => {
 *   // Main operation (always happens)
 *   await client.query('INSERT INTO eprint_index ...');
 *
 *   // Optional operation (may fail without aborting transaction)
 *   const result = await withSavepoint(client, 'optional_tags', async () => {
 *     await client.query('INSERT INTO eprint_tags ...');
 *   });
 *
 *   if (!result.ok) {
 *     console.warn('Tags insert failed, continuing without tags');
 *   }
 *
 *   // Transaction continues even if savepoint rolled back
 *   return { success: true };
 * });
 * ```
 *
 * @see {@link withTransaction}
 * @public
 * @since 0.1.0
 */
export async function withSavepoint<T>(
  client: PoolClient,
  name: string,
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    // Create savepoint
    await client.query(`SAVEPOINT ${name}`);

    // Execute savepoint function
    const result = await fn();

    // Release savepoint (commits savepoint changes)
    await client.query(`RELEASE SAVEPOINT ${name}`);

    return Ok(result);
  } catch (error) {
    // Rollback to savepoint on error
    try {
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    } catch (rollbackError) {
      logger.error(
        'Failed to rollback to savepoint',
        rollbackError instanceof Error ? rollbackError : undefined,
        {
          savepoint: name,
          details: rollbackError instanceof Error ? undefined : String(rollbackError),
        }
      );
    }

    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}
