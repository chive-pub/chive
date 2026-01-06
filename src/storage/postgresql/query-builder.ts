/**
 * Type-safe SQL query builder for PostgreSQL.
 *
 * @remarks
 * Provides composable query builders with parameterized queries for SQL
 * injection prevention. Builders are immutable - each method returns a new
 * instance with the updated state.
 *
 * Query builders construct SQL with positional parameters ($1, $2, etc.)
 * compatible with node-postgres. Parameter values are tracked separately
 * and bound at execution time.
 *
 * Type parameters enable compile-time checking of column references,
 * preventing typos and ensuring queries match the database schema.
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { ValidationError } from '../../types/errors.js';

/**
 * Built query with SQL string and parameter values.
 *
 * @remarks
 * Ready for execution with node-postgres Pool or PoolClient. The sql string
 * contains positional parameters ($1, $2, etc.) and params array contains
 * the corresponding values in order.
 *
 * @public
 */
export interface BuiltQuery {
  /**
   * SQL query string with positional parameters ($1, $2, etc.).
   */
  readonly sql: string;

  /**
   * Parameter values in order of appearance in SQL.
   */
  readonly params: readonly unknown[];
}

/**
 * WHERE clause condition.
 *
 * @remarks
 * Supports simple equality conditions as key-value pairs. For complex
 * conditions (AND, OR, NOT, comparison operators), use WhereConditionBuilder.
 *
 * @typeParam T - Record type with column names
 *
 * @public
 */
export type WhereCondition<T> = {
  [K in keyof T]?: T[K] | null;
};

/**
 * Complex WHERE clause condition with operators.
 *
 * @remarks
 * Supports comparison operators (=, !=, <, <=, >, >=), logical operators
 * (AND, OR, NOT), and special operators (IN, NOT IN, IS NULL, IS NOT NULL).
 *
 * @public
 */
export interface ComplexWhereCondition {
  /**
   * Column name.
   */
  readonly column: string;

  /**
   * Comparison operator.
   */
  readonly operator:
    | '='
    | '!='
    | '<'
    | '<='
    | '>'
    | '>='
    | 'IN'
    | 'NOT IN'
    | 'IS NULL'
    | 'IS NOT NULL'
    | 'LIKE'
    | 'ILIKE';

  /**
   * Value for comparison (not required for IS NULL/IS NOT NULL).
   */
  readonly value?: unknown;
}

/**
 * Logical combination of WHERE conditions.
 *
 * @public
 */
export interface LogicalWhereCondition {
  /**
   * Logical operator.
   */
  readonly operator: 'AND' | 'OR';

  /**
   * Conditions to combine.
   */
  readonly conditions: readonly (ComplexWhereCondition | LogicalWhereCondition)[];
}

/**
 * Sort direction for ORDER BY clause.
 *
 * @public
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Type-safe SELECT query builder.
 *
 * @typeParam T - Record type with column names and types
 *
 * @remarks
 * Builds SELECT queries with type-safe column references. Immutable builder
 * pattern - each method returns a new instance.
 *
 * @example
 * ```typescript
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 *   createdAt: Date;
 * }
 *
 * const query = new SelectBuilder<User>()
 *   .select('id', 'name', 'email')
 *   .from('users')
 *   .where({ email: 'user@example.com' })
 *   .orderBy('createdAt', 'DESC')
 *   .limit(10)
 *   .build();
 *
 * // query.sql: 'SELECT id, name, email FROM users WHERE email = $1 ORDER BY createdAt DESC LIMIT 10'
 * // query.params: ['user@example.com']
 * ```
 *
 * @public
 * @since 0.1.0
 */
export class SelectBuilder<T extends Record<string, unknown>> {
  private readonly selectedColumns: readonly (keyof T)[];
  private readonly tableName: string | null;
  private readonly whereConditions: readonly (ComplexWhereCondition | LogicalWhereCondition)[];
  private readonly orderByColumns: readonly { column: keyof T; direction: SortDirection }[];
  private readonly limitValue: number | null;
  private readonly offsetValue: number | null;
  private readonly joinClauses: readonly { type: string; table: string; on: string }[];

  constructor(
    selectedColumns: readonly (keyof T)[] = [],
    tableName: string | null = null,
    whereConditions: readonly (ComplexWhereCondition | LogicalWhereCondition)[] = [],
    orderByColumns: readonly { column: keyof T; direction: SortDirection }[] = [],
    limitValue: number | null = null,
    offsetValue: number | null = null,
    joinClauses: readonly { type: string; table: string; on: string }[] = []
  ) {
    this.selectedColumns = selectedColumns;
    this.tableName = tableName;
    this.whereConditions = whereConditions;
    this.orderByColumns = orderByColumns;
    this.limitValue = limitValue;
    this.offsetValue = offsetValue;
    this.joinClauses = joinClauses;
  }

  /**
   * Specifies columns to select.
   *
   * @param columns - Column names to include in result
   * @returns New SelectBuilder with columns specified
   *
   * @remarks
   * Column names are type-checked against T. Calling select() multiple times
   * replaces previous column selection.
   *
   * To select all columns, pass no arguments or use `select('*')` (though
   * explicit column listing is preferred for type safety).
   *
   * @example
   * ```typescript
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name', 'email');
   * ```
   *
   * @public
   */
  select(...columns: (keyof T)[]): SelectBuilder<T> {
    return new SelectBuilder<T>(
      columns,
      this.tableName,
      this.whereConditions,
      this.orderByColumns,
      this.limitValue,
      this.offsetValue,
      this.joinClauses
    );
  }

  /**
   * Specifies table to query.
   *
   * @param table - Table name
   * @returns New SelectBuilder with table specified
   *
   * @remarks
   * Required before calling build(). Table name is not type-checked
   * (TypeScript cannot validate runtime strings against schema).
   *
   * @example
   * ```typescript
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users');
   * ```
   *
   * @public
   */
  from(table: string): SelectBuilder<T> {
    return new SelectBuilder<T>(
      this.selectedColumns,
      table,
      this.whereConditions,
      this.orderByColumns,
      this.limitValue,
      this.offsetValue,
      this.joinClauses
    );
  }

  /**
   * Adds WHERE clause condition.
   *
   * @param condition - Simple equality conditions as key-value pairs
   * @returns New SelectBuilder with WHERE condition added
   *
   * @remarks
   * Multiple calls to where() are combined with AND. For OR conditions,
   * use whereComplex() with LogicalWhereCondition.
   *
   * Null values generate 'IS NULL' conditions.
   *
   * @example
   * ```typescript
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users')
   *   .where({ email: 'user@example.com', deletedAt: null });
   * // WHERE email = $1 AND deletedAt IS NULL
   * ```
   *
   * @public
   */
  where(condition: WhereCondition<T>): SelectBuilder<T> {
    const conditions: ComplexWhereCondition[] = [];

    for (const [key, value] of Object.entries(condition)) {
      if (value === null) {
        conditions.push({
          column: key,
          operator: 'IS NULL',
        });
      } else if (value === undefined) {
        // Skip undefined values
        continue;
      } else {
        conditions.push({
          column: key,
          operator: '=',
          value,
        });
      }
    }

    return new SelectBuilder<T>(
      this.selectedColumns,
      this.tableName,
      [...this.whereConditions, ...conditions],
      this.orderByColumns,
      this.limitValue,
      this.offsetValue,
      this.joinClauses
    );
  }

  /**
   * Adds complex WHERE clause condition.
   *
   * @param condition - Complex condition with operators
   * @returns New SelectBuilder with WHERE condition added
   *
   * @remarks
   * Use for conditions beyond simple equality:
   * - Comparison operators: <, <=, >, >=, !=
   * - IN/NOT IN for multiple values
   * - LIKE/ILIKE for pattern matching
   * - Logical combinations with AND/OR
   *
   * @example
   * ```typescript
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users')
   *   .whereComplex({
   *     column: 'createdAt',
   *     operator: '>',
   *     value: new Date('2024-01-01')
   *   });
   * ```
   *
   * @example
   * Logical combination:
   * ```typescript
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users')
   *   .whereComplex({
   *     operator: 'OR',
   *     conditions: [
   *       { column: 'role', operator: '=', value: 'admin' },
   *       { column: 'role', operator: '=', value: 'moderator' }
   *     ]
   *   });
   * ```
   *
   * @public
   */
  whereComplex(condition: ComplexWhereCondition | LogicalWhereCondition): SelectBuilder<T> {
    return new SelectBuilder<T>(
      this.selectedColumns,
      this.tableName,
      [...this.whereConditions, condition],
      this.orderByColumns,
      this.limitValue,
      this.offsetValue,
      this.joinClauses
    );
  }

  /**
   * Adds ORDER BY clause.
   *
   * @param column - Column to sort by
   * @param direction - Sort direction (ASC or DESC)
   * @returns New SelectBuilder with ORDER BY added
   *
   * @remarks
   * Multiple calls add additional sort columns. First call determines
   * primary sort order.
   *
   * @example
   * ```typescript
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users')
   *   .orderBy('createdAt', 'DESC')
   *   .orderBy('name', 'ASC');
   * // ORDER BY createdAt DESC, name ASC
   * ```
   *
   * @public
   */
  orderBy(column: keyof T, direction: SortDirection = 'ASC'): SelectBuilder<T> {
    return new SelectBuilder<T>(
      this.selectedColumns,
      this.tableName,
      this.whereConditions,
      [...this.orderByColumns, { column, direction }],
      this.limitValue,
      this.offsetValue,
      this.joinClauses
    );
  }

  /**
   * Sets LIMIT clause.
   *
   * @param count - Maximum number of rows to return
   * @returns New SelectBuilder with LIMIT set
   *
   * @remarks
   * Use with offset() for pagination. Limit must be positive integer.
   *
   * @example
   * ```typescript
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users')
   *   .limit(10);
   * ```
   *
   * @public
   */
  limit(count: number): SelectBuilder<T> {
    if (count < 0) {
      throw new ValidationError('LIMIT must be non-negative', 'limit', 'non_negative');
    }

    return new SelectBuilder<T>(
      this.selectedColumns,
      this.tableName,
      this.whereConditions,
      this.orderByColumns,
      count,
      this.offsetValue,
      this.joinClauses
    );
  }

  /**
   * Sets OFFSET clause.
   *
   * @param count - Number of rows to skip
   * @returns New SelectBuilder with OFFSET set
   *
   * @remarks
   * Use with limit() for pagination. Offset must be non-negative integer.
   *
   * For cursor-based pagination (more efficient), use a WHERE condition
   * on the cursor column instead.
   *
   * @example
   * ```typescript
   * // Page 2 with 10 items per page
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users')
   *   .limit(10)
   *   .offset(10);
   * ```
   *
   * @public
   */
  offset(count: number): SelectBuilder<T> {
    if (count < 0) {
      throw new ValidationError('OFFSET must be non-negative', 'offset', 'non_negative');
    }

    return new SelectBuilder<T>(
      this.selectedColumns,
      this.tableName,
      this.whereConditions,
      this.orderByColumns,
      this.limitValue,
      count,
      this.joinClauses
    );
  }

  /**
   * Adds JOIN clause.
   *
   * @param type - Join type (INNER, LEFT, RIGHT, FULL)
   * @param table - Table to join
   * @param on - Join condition
   * @returns New SelectBuilder with JOIN added
   *
   * @remarks
   * Join condition is a raw SQL string. Use table aliases to avoid
   * ambiguous column references.
   *
   * Multiple calls add additional joins in order.
   *
   * @example
   * ```typescript
   * const builder = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users u')
   *   .join('INNER', 'profiles p', 'u.id = p.user_id')
   *   .where({ 'u.deletedAt': null });
   * ```
   *
   * @public
   */
  join(type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', table: string, on: string): SelectBuilder<T> {
    return new SelectBuilder<T>(
      this.selectedColumns,
      this.tableName,
      this.whereConditions,
      this.orderByColumns,
      this.limitValue,
      this.offsetValue,
      [...this.joinClauses, { type, table, on }]
    );
  }

  /**
   * Builds final SQL query with parameters.
   *
   * @returns Built query ready for execution
   *
   * @throws Error if table name not specified
   * @throws Error if no columns selected
   *
   * @remarks
   * Call after configuring all query aspects. Returns immutable BuiltQuery
   * with SQL string and parameter array.
   *
   * @example
   * ```typescript
   * const query = new SelectBuilder<User>()
   *   .select('id', 'name')
   *   .from('users')
   *   .where({ email: 'user@example.com' })
   *   .build();
   *
   * const result = await pool.query(query.sql, query.params);
   * ```
   *
   * @public
   */
  build(): BuiltQuery {
    if (!this.tableName) {
      throw new ValidationError('Table name is required', 'tableName', 'required');
    }

    if (this.selectedColumns.length === 0) {
      throw new ValidationError('At least one column must be selected', 'columns', 'min_one');
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    // SELECT clause
    const columns = this.selectedColumns.map((col) => String(col)).join(', ');
    let sql = `SELECT ${columns}`;

    // FROM clause
    sql += ` FROM ${this.tableName}`;

    // JOIN clauses
    for (const join of this.joinClauses) {
      sql += ` ${join.type} JOIN ${join.table} ON ${join.on}`;
    }

    // WHERE clause
    if (this.whereConditions.length > 0) {
      const whereClause = this.buildWhereClause(this.whereConditions, params, paramIndex);
      sql += ` WHERE ${whereClause.sql}`;
      paramIndex = whereClause.paramIndex;
    }

    // ORDER BY clause
    if (this.orderByColumns.length > 0) {
      const orderBy = this.orderByColumns
        .map(({ column, direction }) => `${String(column)} ${direction}`)
        .join(', ');
      sql += ` ORDER BY ${orderBy}`;
    }

    // LIMIT clause
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    // OFFSET clause
    if (this.offsetValue !== null) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return {
      sql,
      params,
    };
  }

  /**
   * Builds WHERE clause SQL from conditions.
   *
   * @param conditions - Array of conditions to build
   * @param params - Parameter array to append to
   * @param startIndex - Starting parameter index
   * @returns Built WHERE clause and next parameter index
   *
   * @internal
   */
  private buildWhereClause(
    conditions: readonly (ComplexWhereCondition | LogicalWhereCondition)[],
    params: unknown[],
    startIndex: number
  ): { sql: string; paramIndex: number } {
    let paramIndex = startIndex;
    const clauses: string[] = [];

    for (const condition of conditions) {
      if (
        'operator' in condition &&
        (condition.operator === 'AND' || condition.operator === 'OR')
      ) {
        // Logical condition
        const logical = condition;
        const nested = this.buildWhereClause(logical.conditions, params, paramIndex);
        clauses.push(`(${nested.sql})`);
        paramIndex = nested.paramIndex;
      } else {
        // Simple condition
        const simple = condition as ComplexWhereCondition;
        const clause = this.buildSimpleCondition(simple, params, paramIndex);
        clauses.push(clause.sql);
        paramIndex = clause.paramIndex;
      }
    }

    return {
      sql: clauses.join(' AND '),
      paramIndex,
    };
  }

  /**
   * Builds simple condition SQL.
   *
   * @param condition - Condition to build
   * @param params - Parameter array to append to
   * @param paramIndex - Current parameter index
   * @returns Built condition and next parameter index
   *
   * @internal
   */
  private buildSimpleCondition(
    condition: ComplexWhereCondition,
    params: unknown[],
    paramIndex: number
  ): { sql: string; paramIndex: number } {
    const { column, operator, value } = condition;

    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      return {
        sql: `${column} ${operator}`,
        paramIndex,
      };
    }

    if (operator === 'IN' || operator === 'NOT IN') {
      if (!Array.isArray(value)) {
        throw new ValidationError(`${operator} requires array value`, 'value', 'array_required');
      }

      if (value.length === 0) {
        // Handle empty IN clause (always false for IN, always true for NOT IN)
        return {
          sql: operator === 'IN' ? 'FALSE' : 'TRUE',
          paramIndex,
        };
      }

      const placeholders = value.map((v) => {
        params.push(v);
        return `$${paramIndex++}`;
      });

      return {
        sql: `${column} ${operator} (${placeholders.join(', ')})`,
        paramIndex,
      };
    }

    // Standard comparison operators
    params.push(value);
    return {
      sql: `${column} ${operator} $${paramIndex}`,
      paramIndex: paramIndex + 1,
    };
  }
}

/**
 * Type-safe INSERT query builder.
 *
 * @typeParam T - Record type with column names and types
 *
 * @remarks
 * Builds INSERT queries with ON CONFLICT support for upserts. Type-safe
 * column references prevent typos.
 *
 * @example
 * ```typescript
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 * }
 *
 * const query = new InsertBuilder<User>()
 *   .into('users')
 *   .values({ id: 1, name: 'Alice', email: 'alice@example.com' })
 *   .onConflict('email', 'update')
 *   .returning('id')
 *   .build();
 * ```
 *
 * @public
 * @since 0.1.0
 */
export class InsertBuilder<T extends Record<string, unknown>> {
  private readonly tableName: string | null;
  private readonly records: readonly Partial<T>[];
  private readonly conflictColumn: keyof T | null;
  private readonly conflictAction: 'update' | 'ignore' | null;
  private readonly returningColumns: readonly (keyof T)[];

  constructor(
    tableName: string | null = null,
    records: readonly Partial<T>[] = [],
    conflictColumn: keyof T | null = null,
    conflictAction: 'update' | 'ignore' | null = null,
    returningColumns: readonly (keyof T)[] = []
  ) {
    this.tableName = tableName;
    this.records = records;
    this.conflictColumn = conflictColumn;
    this.conflictAction = conflictAction;
    this.returningColumns = returningColumns;
  }

  /**
   * Specifies table to insert into.
   *
   * @param table - Table name
   * @returns New InsertBuilder with table specified
   *
   * @example
   * ```typescript
   * const builder = new InsertBuilder<User>().into('users');
   * ```
   *
   * @public
   */
  into(table: string): InsertBuilder<T> {
    return new InsertBuilder<T>(
      table,
      this.records,
      this.conflictColumn,
      this.conflictAction,
      this.returningColumns
    );
  }

  /**
   * Adds record to insert.
   *
   * @param record - Record values
   * @returns New InsertBuilder with record added
   *
   * @remarks
   * Multiple calls add multiple records (multi-row insert). All records
   * must have the same columns.
   *
   * @example
   * ```typescript
   * const builder = new InsertBuilder<User>()
   *   .into('users')
   *   .values({ name: 'Alice', email: 'alice@example.com' })
   *   .values({ name: 'Bob', email: 'bob@example.com' });
   * ```
   *
   * @public
   */
  values(record: Partial<T>): InsertBuilder<T> {
    return new InsertBuilder<T>(
      this.tableName,
      [...this.records, record],
      this.conflictColumn,
      this.conflictAction,
      this.returningColumns
    );
  }

  /**
   * Adds ON CONFLICT clause for upsert.
   *
   * @param column - Conflict target column
   * @param action - Action on conflict (update or ignore)
   * @returns New InsertBuilder with ON CONFLICT specified
   *
   * @remarks
   * 'update' action updates all columns from VALUES. 'ignore' action
   * does nothing on conflict (DO NOTHING).
   *
   * @example
   * ```typescript
   * const builder = new InsertBuilder<User>()
   *   .into('users')
   *   .values({ email: 'alice@example.com', name: 'Alice' })
   *   .onConflict('email', 'update');
   * // ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
   * ```
   *
   * @public
   */
  onConflict(column: keyof T, action: 'update' | 'ignore'): InsertBuilder<T> {
    return new InsertBuilder<T>(
      this.tableName,
      this.records,
      column,
      action,
      this.returningColumns
    );
  }

  /**
   * Adds RETURNING clause.
   *
   * @param columns - Columns to return
   * @returns New InsertBuilder with RETURNING specified
   *
   * @remarks
   * Returns specified columns from inserted rows. Useful for getting
   * auto-generated IDs or timestamps.
   *
   * @example
   * ```typescript
   * const builder = new InsertBuilder<User>()
   *   .into('users')
   *   .values({ name: 'Alice', email: 'alice@example.com' })
   *   .returning('id', 'createdAt');
   * ```
   *
   * @public
   */
  returning(...columns: (keyof T)[]): InsertBuilder<T> {
    return new InsertBuilder<T>(
      this.tableName,
      this.records,
      this.conflictColumn,
      this.conflictAction,
      columns
    );
  }

  /**
   * Builds final SQL query with parameters.
   *
   * @returns Built query ready for execution
   *
   * @throws Error if table name not specified
   * @throws Error if no records to insert
   *
   * @public
   */
  build(): BuiltQuery {
    if (!this.tableName) {
      throw new ValidationError('Table name is required', 'tableName', 'required');
    }

    if (this.records.length === 0) {
      throw new ValidationError('At least one record is required', 'records', 'min_one');
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    // Get columns from first record (all records must have same columns)
    const firstRecord = this.records[0];
    if (!firstRecord) {
      throw new ValidationError('At least one record is required', 'records', 'min_one');
    }
    const columns = Object.keys(firstRecord);

    if (columns.length === 0) {
      throw new ValidationError('Record must have at least one column', 'record', 'min_one');
    }

    // INSERT INTO clause
    let sql = `INSERT INTO ${this.tableName} (${columns.join(', ')})`;

    // VALUES clause
    const valueRows: string[] = [];
    for (const record of this.records) {
      const values: string[] = [];
      for (const col of columns) {
        params.push(record[col as keyof T]);
        values.push(`$${paramIndex++}`);
      }
      valueRows.push(`(${values.join(', ')})`);
    }
    sql += ` VALUES ${valueRows.join(', ')}`;

    // ON CONFLICT clause
    if (this.conflictColumn && this.conflictAction) {
      sql += ` ON CONFLICT (${String(this.conflictColumn)})`;

      if (this.conflictAction === 'update') {
        // Update all columns except conflict column
        const updateCols = columns
          .filter((col) => col !== this.conflictColumn)
          .map((col) => `${col} = EXCLUDED.${col}`)
          .join(', ');
        sql += ` DO UPDATE SET ${updateCols}`;
      } else {
        sql += ' DO NOTHING';
      }
    }

    // RETURNING clause
    if (this.returningColumns.length > 0) {
      const returning = this.returningColumns.map((col) => String(col)).join(', ');
      sql += ` RETURNING ${returning}`;
    }

    return {
      sql,
      params,
    };
  }
}

/**
 * Type-safe UPDATE query builder.
 *
 * @typeParam T - Record type with column names and types
 *
 * @remarks
 * Builds UPDATE queries with WHERE clause support. Type-safe column
 * references prevent typos and ensure updates match schema.
 *
 * @example
 * ```typescript
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 *   updatedAt: Date;
 * }
 *
 * const query = new UpdateBuilder<User>()
 *   .table('users')
 *   .set({ name: 'Alice Updated', updatedAt: new Date() })
 *   .where({ id: 1 })
 *   .returning('id', 'updatedAt')
 *   .build();
 * ```
 *
 * @public
 * @since 0.1.0
 */
export class UpdateBuilder<T extends Record<string, unknown>> {
  private readonly tableName: string | null;
  private readonly updates: Partial<T> | null;
  private readonly whereConditions: readonly (ComplexWhereCondition | LogicalWhereCondition)[];
  private readonly returningColumns: readonly (keyof T)[];

  constructor(
    tableName: string | null = null,
    updates: Partial<T> | null = null,
    whereConditions: readonly (ComplexWhereCondition | LogicalWhereCondition)[] = [],
    returningColumns: readonly (keyof T)[] = []
  ) {
    this.tableName = tableName;
    this.updates = updates;
    this.whereConditions = whereConditions;
    this.returningColumns = returningColumns;
  }

  /**
   * Specifies table to update.
   *
   * @param name - Table name
   * @returns New UpdateBuilder with table specified
   *
   * @example
   * ```typescript
   * const builder = new UpdateBuilder<User>().table('users');
   * ```
   *
   * @public
   */
  table(name: string): UpdateBuilder<T> {
    return new UpdateBuilder<T>(name, this.updates, this.whereConditions, this.returningColumns);
  }

  /**
   * Specifies columns to update with new values.
   *
   * @param updates - Column updates as key-value pairs
   * @returns New UpdateBuilder with updates specified
   *
   * @remarks
   * Calling set() multiple times replaces previous updates.
   *
   * @example
   * ```typescript
   * const builder = new UpdateBuilder<User>()
   *   .table('users')
   *   .set({ name: 'Alice', updatedAt: new Date() });
   * ```
   *
   * @public
   */
  set(updates: Partial<T>): UpdateBuilder<T> {
    return new UpdateBuilder<T>(
      this.tableName,
      updates,
      this.whereConditions,
      this.returningColumns
    );
  }

  /**
   * Adds WHERE clause condition.
   *
   * @param condition - Simple equality conditions as key-value pairs
   * @returns New UpdateBuilder with WHERE condition added
   *
   * @remarks
   * Multiple calls to where() are combined with AND. Always include a
   * WHERE clause to avoid updating all rows unintentionally.
   *
   * @example
   * ```typescript
   * const builder = new UpdateBuilder<User>()
   *   .table('users')
   *   .set({ name: 'Alice' })
   *   .where({ id: 1 });
   * ```
   *
   * @public
   */
  where(condition: WhereCondition<T>): UpdateBuilder<T> {
    const conditions: ComplexWhereCondition[] = [];

    for (const [key, value] of Object.entries(condition)) {
      if (value === null) {
        conditions.push({
          column: key,
          operator: 'IS NULL',
        });
      } else if (value === undefined) {
        continue;
      } else {
        conditions.push({
          column: key,
          operator: '=',
          value,
        });
      }
    }

    return new UpdateBuilder<T>(
      this.tableName,
      this.updates,
      [...this.whereConditions, ...conditions],
      this.returningColumns
    );
  }

  /**
   * Adds complex WHERE clause condition.
   *
   * @param condition - Complex condition with operators
   * @returns New UpdateBuilder with WHERE condition added
   *
   * @remarks
   * Use for conditions beyond simple equality (see SelectBuilder.whereComplex
   * for detailed examples).
   *
   * @public
   */
  whereComplex(condition: ComplexWhereCondition | LogicalWhereCondition): UpdateBuilder<T> {
    return new UpdateBuilder<T>(
      this.tableName,
      this.updates,
      [...this.whereConditions, condition],
      this.returningColumns
    );
  }

  /**
   * Adds RETURNING clause.
   *
   * @param columns - Columns to return
   * @returns New UpdateBuilder with RETURNING specified
   *
   * @remarks
   * Returns specified columns from updated rows. Useful for getting
   * updated timestamps or checking actual changes.
   *
   * @example
   * ```typescript
   * const builder = new UpdateBuilder<User>()
   *   .table('users')
   *   .set({ name: 'Alice' })
   *   .where({ id: 1 })
   *   .returning('id', 'name', 'updatedAt');
   * ```
   *
   * @public
   */
  returning(...columns: (keyof T)[]): UpdateBuilder<T> {
    return new UpdateBuilder<T>(this.tableName, this.updates, this.whereConditions, columns);
  }

  /**
   * Builds final SQL query with parameters.
   *
   * @returns Built query ready for execution
   *
   * @throws Error if table name not specified
   * @throws Error if no updates specified
   * @throws Error if no WHERE clause specified (safety check)
   *
   * @remarks
   * Requires WHERE clause to prevent accidental updates of all rows.
   * To update all rows intentionally, use whereComplex with TRUE condition.
   *
   * @public
   */
  build(): BuiltQuery {
    if (!this.tableName) {
      throw new ValidationError('Table name is required', 'tableName', 'required');
    }

    if (!this.updates || Object.keys(this.updates).length === 0) {
      throw new ValidationError('At least one column must be updated', 'columns', 'min_one');
    }

    if (this.whereConditions.length === 0) {
      throw new ValidationError(
        'WHERE clause is required for UPDATE (use whereComplex for intentional updates of all rows)',
        'where',
        'required'
      );
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    // UPDATE clause
    let sql = `UPDATE ${this.tableName}`;

    // SET clause
    const setClauses: string[] = [];
    for (const [key, value] of Object.entries(this.updates)) {
      params.push(value);
      setClauses.push(`${key} = $${paramIndex++}`);
    }
    sql += ` SET ${setClauses.join(', ')}`;

    // WHERE clause
    const whereClause = this.buildWhereClause(this.whereConditions, params, paramIndex);
    sql += ` WHERE ${whereClause.sql}`;
    paramIndex = whereClause.paramIndex;

    // RETURNING clause
    if (this.returningColumns.length > 0) {
      const returning = this.returningColumns.map((col) => String(col)).join(', ');
      sql += ` RETURNING ${returning}`;
    }

    return {
      sql,
      params,
    };
  }

  /**
   * Builds WHERE clause SQL from conditions.
   *
   * @param conditions - Array of conditions to build
   * @param params - Parameter array to append to
   * @param startIndex - Starting parameter index
   * @returns Built WHERE clause and next parameter index
   *
   * @internal
   */
  private buildWhereClause(
    conditions: readonly (ComplexWhereCondition | LogicalWhereCondition)[],
    params: unknown[],
    startIndex: number
  ): { sql: string; paramIndex: number } {
    let paramIndex = startIndex;
    const clauses: string[] = [];

    for (const condition of conditions) {
      if (
        'operator' in condition &&
        (condition.operator === 'AND' || condition.operator === 'OR')
      ) {
        // Logical condition
        const logical = condition;
        const nested = this.buildWhereClause(logical.conditions, params, paramIndex);
        clauses.push(`(${nested.sql})`);
        paramIndex = nested.paramIndex;
      } else {
        // Simple condition
        const simple = condition as ComplexWhereCondition;
        const clause = this.buildSimpleCondition(simple, params, paramIndex);
        clauses.push(clause.sql);
        paramIndex = clause.paramIndex;
      }
    }

    return {
      sql: clauses.join(' AND '),
      paramIndex,
    };
  }

  /**
   * Builds simple condition SQL.
   *
   * @param condition - Condition to build
   * @param params - Parameter array to append to
   * @param paramIndex - Current parameter index
   * @returns Built condition and next parameter index
   *
   * @internal
   */
  private buildSimpleCondition(
    condition: ComplexWhereCondition,
    params: unknown[],
    paramIndex: number
  ): { sql: string; paramIndex: number } {
    const { column, operator, value } = condition;

    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      return {
        sql: `${column} ${operator}`,
        paramIndex,
      };
    }

    if (operator === 'IN' || operator === 'NOT IN') {
      if (!Array.isArray(value)) {
        throw new ValidationError(`${operator} requires array value`, 'value', 'array_required');
      }

      if (value.length === 0) {
        return {
          sql: operator === 'IN' ? 'FALSE' : 'TRUE',
          paramIndex,
        };
      }

      const placeholders = value.map((v) => {
        params.push(v);
        return `$${paramIndex++}`;
      });

      return {
        sql: `${column} ${operator} (${placeholders.join(', ')})`,
        paramIndex,
      };
    }

    // Standard comparison operators
    params.push(value);
    return {
      sql: `${column} ${operator} $${paramIndex}`,
      paramIndex: paramIndex + 1,
    };
  }
}
