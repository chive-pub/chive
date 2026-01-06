/**
 * Unit tests for query builder.
 */

import { describe, it, expect } from 'vitest';

import {
  SelectBuilder,
  InsertBuilder,
  UpdateBuilder,
} from '../../../../src/storage/postgresql/query-builder.js';

interface TestUser extends Record<string, unknown> {
  id: number;
  name: string;
  email: string;
  age: number;
  createdAt: Date;
  deletedAt: Date | null;
}

describe('query-builder', () => {
  describe('SelectBuilder', () => {
    describe('basic queries', () => {
      it('should build simple SELECT query', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name', 'email')
          .from('users')
          .build();

        expect(query.sql).toBe('SELECT id, name, email FROM users');
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with single WHERE condition', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .where({ email: 'test@example.com' })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE email = $1');
        expect(query.params).toEqual(['test@example.com']);
      });

      it('should build SELECT with multiple WHERE conditions', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .where({ email: 'test@example.com', age: 25 })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE email = $1 AND age = $2');
        expect(query.params).toEqual(['test@example.com', 25]);
      });

      it('should build SELECT with NULL condition', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .where({ deletedAt: null })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE deletedAt IS NULL');
        expect(query.params).toEqual([]);
      });

      it('should skip undefined values in WHERE', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .where({ email: 'test@example.com', deletedAt: undefined })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE email = $1');
        expect(query.params).toEqual(['test@example.com']);
      });
    });

    describe('ORDER BY clause', () => {
      it('should build SELECT with ORDER BY ASC', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .orderBy('name', 'ASC')
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users ORDER BY name ASC');
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with ORDER BY DESC', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .orderBy('createdAt', 'DESC')
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users ORDER BY createdAt DESC');
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with multiple ORDER BY columns', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .orderBy('age', 'DESC')
          .orderBy('name', 'ASC')
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users ORDER BY age DESC, name ASC');
        expect(query.params).toEqual([]);
      });
    });

    describe('LIMIT and OFFSET clauses', () => {
      it('should build SELECT with LIMIT', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .limit(10)
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users LIMIT 10');
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with OFFSET', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .offset(20)
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users OFFSET 20');
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with LIMIT and OFFSET', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .limit(10)
          .offset(20)
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users LIMIT 10 OFFSET 20');
        expect(query.params).toEqual([]);
      });

      it('should throw error for negative LIMIT', () => {
        expect(() => {
          new SelectBuilder<TestUser>().select('id').from('users').limit(-1);
        }).toThrow('LIMIT must be non-negative');
      });

      it('should throw error for negative OFFSET', () => {
        expect(() => {
          new SelectBuilder<TestUser>().select('id').from('users').offset(-1);
        }).toThrow('OFFSET must be non-negative');
      });
    });

    describe('JOIN clauses', () => {
      it('should build SELECT with INNER JOIN', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users u')
          .join('INNER', 'profiles p', 'u.id = p.user_id')
          .build();

        expect(query.sql).toBe(
          'SELECT id, name FROM users u INNER JOIN profiles p ON u.id = p.user_id'
        );
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with LEFT JOIN', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users u')
          .join('LEFT', 'profiles p', 'u.id = p.user_id')
          .build();

        expect(query.sql).toBe(
          'SELECT id, name FROM users u LEFT JOIN profiles p ON u.id = p.user_id'
        );
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with multiple JOINs', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users u')
          .join('INNER', 'profiles p', 'u.id = p.user_id')
          .join('LEFT', 'avatars a', 'p.id = a.profile_id')
          .build();

        expect(query.sql).toBe(
          'SELECT id, name FROM users u INNER JOIN profiles p ON u.id = p.user_id LEFT JOIN avatars a ON p.id = a.profile_id'
        );
        expect(query.params).toEqual([]);
      });
    });

    describe('complex WHERE conditions', () => {
      it('should build SELECT with comparison operators', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'age',
            operator: '>',
            value: 18,
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE age > $1');
        expect(query.params).toEqual([18]);
      });

      it('should build SELECT with IN operator', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'id',
            operator: 'IN',
            value: [1, 2, 3],
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE id IN ($1, $2, $3)');
        expect(query.params).toEqual([1, 2, 3]);
      });

      it('should build SELECT with empty IN operator', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'id',
            operator: 'IN',
            value: [],
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE FALSE');
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with NOT IN operator', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'id',
            operator: 'NOT IN',
            value: [1, 2],
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE id NOT IN ($1, $2)');
        expect(query.params).toEqual([1, 2]);
      });

      it('should build SELECT with empty NOT IN operator', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'id',
            operator: 'NOT IN',
            value: [],
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE TRUE');
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with LIKE operator', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'name',
            operator: 'LIKE',
            value: 'Alice%',
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE name LIKE $1');
        expect(query.params).toEqual(['Alice%']);
      });

      it('should build SELECT with ILIKE operator', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'email',
            operator: 'ILIKE',
            value: '%@example.com',
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE email ILIKE $1');
        expect(query.params).toEqual(['%@example.com']);
      });

      it('should build SELECT with IS NOT NULL operator', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'deletedAt',
            operator: 'IS NOT NULL',
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE deletedAt IS NOT NULL');
        expect(query.params).toEqual([]);
      });

      it('should build SELECT with multiple complex conditions', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name')
          .from('users')
          .whereComplex({
            column: 'age',
            operator: '>=',
            value: 18,
          })
          .whereComplex({
            column: 'age',
            operator: '<=',
            value: 65,
          })
          .build();

        expect(query.sql).toBe('SELECT id, name FROM users WHERE age >= $1 AND age <= $2');
        expect(query.params).toEqual([18, 65]);
      });
    });

    describe('complete queries', () => {
      it('should build complete SELECT with all clauses', () => {
        const query = new SelectBuilder<TestUser>()
          .select('id', 'name', 'email')
          .from('users')
          .where({ deletedAt: null })
          .whereComplex({
            column: 'age',
            operator: '>',
            value: 18,
          })
          .orderBy('createdAt', 'DESC')
          .limit(10)
          .offset(20)
          .build();

        expect(query.sql).toBe(
          'SELECT id, name, email FROM users WHERE deletedAt IS NULL AND age > $1 ORDER BY createdAt DESC LIMIT 10 OFFSET 20'
        );
        expect(query.params).toEqual([18]);
      });
    });

    describe('error handling', () => {
      it('should throw error when table not specified', () => {
        expect(() => {
          new SelectBuilder<TestUser>().select('id').build();
        }).toThrow('Table name is required');
      });

      it('should throw error when no columns selected', () => {
        expect(() => {
          new SelectBuilder<TestUser>().from('users').build();
        }).toThrow('At least one column must be selected');
      });

      it('should throw error for IN operator with non-array value', () => {
        expect(() => {
          new SelectBuilder<TestUser>()
            .select('id')
            .from('users')
            .whereComplex({
              column: 'id',
              operator: 'IN',
              value: 'not-an-array',
            })
            .build();
        }).toThrow('IN requires array value');
      });
    });
  });

  describe('InsertBuilder', () => {
    describe('basic inserts', () => {
      it('should build simple INSERT query', () => {
        const query = new InsertBuilder<TestUser>()
          .into('users')
          .values({ name: 'Alice', email: 'alice@example.com', age: 30 })
          .build();

        expect(query.sql).toBe('INSERT INTO users (name, email, age) VALUES ($1, $2, $3)');
        expect(query.params).toEqual(['Alice', 'alice@example.com', 30]);
      });

      it('should build multi-row INSERT', () => {
        const query = new InsertBuilder<TestUser>()
          .into('users')
          .values({ name: 'Alice', email: 'alice@example.com', age: 30 })
          .values({ name: 'Bob', email: 'bob@example.com', age: 25 })
          .build();

        expect(query.sql).toBe(
          'INSERT INTO users (name, email, age) VALUES ($1, $2, $3), ($4, $5, $6)'
        );
        expect(query.params).toEqual([
          'Alice',
          'alice@example.com',
          30,
          'Bob',
          'bob@example.com',
          25,
        ]);
      });
    });

    describe('RETURNING clause', () => {
      it('should build INSERT with RETURNING', () => {
        const query = new InsertBuilder<TestUser>()
          .into('users')
          .values({ name: 'Alice', email: 'alice@example.com', age: 30 })
          .returning('id', 'createdAt')
          .build();

        expect(query.sql).toBe(
          'INSERT INTO users (name, email, age) VALUES ($1, $2, $3) RETURNING id, createdAt'
        );
        expect(query.params).toEqual(['Alice', 'alice@example.com', 30]);
      });
    });

    describe('ON CONFLICT clause', () => {
      it('should build INSERT with ON CONFLICT DO NOTHING', () => {
        const query = new InsertBuilder<TestUser>()
          .into('users')
          .values({ name: 'Alice', email: 'alice@example.com', age: 30 })
          .onConflict('email', 'ignore')
          .build();

        expect(query.sql).toBe(
          'INSERT INTO users (name, email, age) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING'
        );
        expect(query.params).toEqual(['Alice', 'alice@example.com', 30]);
      });

      it('should build INSERT with ON CONFLICT DO UPDATE', () => {
        const query = new InsertBuilder<TestUser>()
          .into('users')
          .values({ name: 'Alice', email: 'alice@example.com', age: 30 })
          .onConflict('email', 'update')
          .build();

        expect(query.sql).toBe(
          'INSERT INTO users (name, email, age) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, age = EXCLUDED.age'
        );
        expect(query.params).toEqual(['Alice', 'alice@example.com', 30]);
      });

      it('should build INSERT with ON CONFLICT and RETURNING', () => {
        const query = new InsertBuilder<TestUser>()
          .into('users')
          .values({ name: 'Alice', email: 'alice@example.com', age: 30 })
          .onConflict('email', 'update')
          .returning('id', 'name')
          .build();

        expect(query.sql).toBe(
          'INSERT INTO users (name, email, age) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, age = EXCLUDED.age RETURNING id, name'
        );
        expect(query.params).toEqual(['Alice', 'alice@example.com', 30]);
      });
    });

    describe('error handling', () => {
      it('should throw error when table not specified', () => {
        expect(() => {
          new InsertBuilder<TestUser>()
            .values({ name: 'Alice', email: 'alice@example.com', age: 30 })
            .build();
        }).toThrow('Table name is required');
      });

      it('should throw error when no records provided', () => {
        expect(() => {
          new InsertBuilder<TestUser>().into('users').build();
        }).toThrow('At least one record is required');
      });

      it('should throw error when record has no columns', () => {
        expect(() => {
          new InsertBuilder<TestUser>().into('users').values({}).build();
        }).toThrow('Record must have at least one column');
      });
    });
  });

  describe('UpdateBuilder', () => {
    describe('basic updates', () => {
      it('should build simple UPDATE query', () => {
        const query = new UpdateBuilder<TestUser>()
          .table('users')
          .set({ name: 'Alice Updated' })
          .where({ id: 1 })
          .build();

        expect(query.sql).toBe('UPDATE users SET name = $1 WHERE id = $2');
        expect(query.params).toEqual(['Alice Updated', 1]);
      });

      it('should build UPDATE with multiple columns', () => {
        const query = new UpdateBuilder<TestUser>()
          .table('users')
          .set({ name: 'Alice', age: 31 })
          .where({ id: 1 })
          .build();

        expect(query.sql).toBe('UPDATE users SET name = $1, age = $2 WHERE id = $3');
        expect(query.params).toEqual(['Alice', 31, 1]);
      });

      it('should build UPDATE with multiple WHERE conditions', () => {
        const query = new UpdateBuilder<TestUser>()
          .table('users')
          .set({ name: 'Alice' })
          .where({ id: 1, email: 'alice@example.com' })
          .build();

        expect(query.sql).toBe('UPDATE users SET name = $1 WHERE id = $2 AND email = $3');
        expect(query.params).toEqual(['Alice', 1, 'alice@example.com']);
      });

      it('should build UPDATE with NULL in WHERE', () => {
        const query = new UpdateBuilder<TestUser>()
          .table('users')
          .set({ name: 'Active' })
          .where({ deletedAt: null })
          .build();

        expect(query.sql).toBe('UPDATE users SET name = $1 WHERE deletedAt IS NULL');
        expect(query.params).toEqual(['Active']);
      });
    });

    describe('RETURNING clause', () => {
      it('should build UPDATE with RETURNING', () => {
        const query = new UpdateBuilder<TestUser>()
          .table('users')
          .set({ name: 'Alice' })
          .where({ id: 1 })
          .returning('id', 'name', 'createdAt')
          .build();

        expect(query.sql).toBe(
          'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, createdAt'
        );
        expect(query.params).toEqual(['Alice', 1]);
      });
    });

    describe('complex WHERE conditions', () => {
      it('should build UPDATE with complex WHERE', () => {
        const query = new UpdateBuilder<TestUser>()
          .table('users')
          .set({ name: 'Adult' })
          .whereComplex({
            column: 'age',
            operator: '>=',
            value: 18,
          })
          .build();

        expect(query.sql).toBe('UPDATE users SET name = $1 WHERE age >= $2');
        expect(query.params).toEqual(['Adult', 18]);
      });

      it('should build UPDATE with multiple complex conditions', () => {
        const query = new UpdateBuilder<TestUser>()
          .table('users')
          .set({ name: 'Updated' })
          .whereComplex({
            column: 'age',
            operator: '>',
            value: 18,
          })
          .whereComplex({
            column: 'deletedAt',
            operator: 'IS NULL',
          })
          .build();

        expect(query.sql).toBe('UPDATE users SET name = $1 WHERE age > $2 AND deletedAt IS NULL');
        expect(query.params).toEqual(['Updated', 18]);
      });

      it('should build UPDATE with IN operator', () => {
        const query = new UpdateBuilder<TestUser>()
          .table('users')
          .set({ name: 'Batch Update' })
          .whereComplex({
            column: 'id',
            operator: 'IN',
            value: [1, 2, 3],
          })
          .build();

        expect(query.sql).toBe('UPDATE users SET name = $1 WHERE id IN ($2, $3, $4)');
        expect(query.params).toEqual(['Batch Update', 1, 2, 3]);
      });
    });

    describe('error handling', () => {
      it('should throw error when table not specified', () => {
        expect(() => {
          new UpdateBuilder<TestUser>().set({ name: 'Alice' }).where({ id: 1 }).build();
        }).toThrow('Table name is required');
      });

      it('should throw error when no updates specified', () => {
        expect(() => {
          new UpdateBuilder<TestUser>().table('users').where({ id: 1 }).build();
        }).toThrow('At least one column must be updated');
      });

      it('should throw error when no WHERE clause specified', () => {
        expect(() => {
          new UpdateBuilder<TestUser>().table('users').set({ name: 'Alice' }).build();
        }).toThrow('WHERE clause is required');
      });
    });
  });
});
