/**
 * Database pool interfaces for PostgreSQL operations.
 *
 * @remarks
 * Provides an abstract interface for PostgreSQL connection pools,
 * enabling testability and dependency injection without coupling
 * to the `pg` library directly.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Database pool interface for PostgreSQL operations.
 *
 * @remarks
 * Abstracts the `pg.Pool` interface to allow for:
 * - Unit testing with mock implementations
 * - Dependency injection without tsyringe decorators
 * - Consistent type safety across services
 *
 * @example
 * ```typescript
 * class MyService {
 *   constructor(private readonly db: IDatabasePool) {}
 *
 *   async getData(): Promise<MyData[]> {
 *     const result = await this.db.query<MyData>('SELECT * FROM my_table');
 *     return result.rows;
 *   }
 * }
 * ```
 *
 * @public
 */
export interface IDatabasePool {
  /**
   * Executes a SQL query against the database.
   *
   * @typeParam T - The expected row type
   * @param text - SQL query string with optional $1, $2, ... placeholders
   * @param values - Parameter values to bind to placeholders
   * @returns Query result with typed rows
   */
  query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
