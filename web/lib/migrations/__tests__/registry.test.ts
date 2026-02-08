import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationRegistry, compareVersions } from '../registry';
import type { SchemaMigration } from '../types';

describe('MigrationRegistry', () => {
  let registry: MigrationRegistry;

  beforeEach(() => {
    registry = new MigrationRegistry();
  });

  describe('register', () => {
    it('registers a migration successfully', () => {
      const migration: SchemaMigration = {
        id: 'test-migration',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Test migration',
        needsMigration: (r) => typeof r === 'object' && r !== null && 'old' in r,
        migrate: (old) => {
          const rec = old as { old: string };
          return { new: rec.old };
        },
      };

      registry.register(migration);

      expect(registry.getMigrationById('test-migration')).toBe(migration);
    });

    it('throws when registering duplicate migration ID', () => {
      const migration: SchemaMigration = {
        id: 'duplicate-id',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Test migration',
        needsMigration: () => false,
        migrate: (x) => x,
      };

      registry.register(migration);

      expect(() => registry.register(migration)).toThrow('already registered');
    });

    it('sorts migrations by priority', () => {
      const lowPriority: SchemaMigration = {
        id: 'low-priority',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Low priority',
        priority: 200,
        needsMigration: () => false,
        migrate: (x) => x,
      };

      const highPriority: SchemaMigration = {
        id: 'high-priority',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'High priority',
        priority: 10,
        needsMigration: () => false,
        migrate: (x) => x,
      };

      registry.register(lowPriority);
      registry.register(highPriority);

      const migrations = registry.getMigrationsForCollection('test.collection');
      expect(migrations[0]?.id).toBe('high-priority');
      expect(migrations[1]?.id).toBe('low-priority');
    });
  });

  describe('detectMigrations', () => {
    it('returns empty result for records that do not need migration', () => {
      const migration: SchemaMigration = {
        id: 'test-migration',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Test migration',
        needsMigration: () => false,
        migrate: (x) => x,
      };

      registry.register(migration);

      const result = registry.detectMigrations('test.collection', { data: 'value' });

      expect(result.needsMigration).toBe(false);
      expect(result.migrations).toHaveLength(0);
    });

    it('detects migrations for records that need them', () => {
      const migration: SchemaMigration = {
        id: 'test-migration',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Test migration',
        needsMigration: (r) => typeof r === 'object' && r !== null && 'old' in r,
        migrate: (old) => {
          const rec = old as { old: string };
          return { new: rec.old };
        },
      };

      registry.register(migration);

      const result = registry.detectMigrations('test.collection', { old: 'value' });

      expect(result.needsMigration).toBe(true);
      expect(result.migrations).toHaveLength(1);
      expect(result.migrations[0]?.migration.id).toBe('test-migration');
    });

    it('detects multiple migrations', () => {
      const migration1: SchemaMigration = {
        id: 'migration-1',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Migration 1',
        priority: 10,
        needsMigration: (r) => typeof r === 'object' && r !== null && 'field1' in r,
        migrate: (x) => x,
      };

      const migration2: SchemaMigration = {
        id: 'migration-2',
        fromVersion: '0.2.0',
        toVersion: '0.3.0',
        collection: 'test.collection',
        description: 'Migration 2',
        priority: 20,
        needsMigration: (r) => typeof r === 'object' && r !== null && 'field2' in r,
        migrate: (x) => x,
      };

      registry.register(migration1);
      registry.register(migration2);

      const result = registry.detectMigrations('test.collection', { field1: 'a', field2: 'b' });

      expect(result.needsMigration).toBe(true);
      expect(result.migrations).toHaveLength(2);
      expect(result.currentVersion).toBe('0.1.0');
      expect(result.targetVersion).toBe('0.3.0');
    });

    it('returns empty for unknown collection', () => {
      const result = registry.detectMigrations('unknown.collection', { data: 'value' });

      expect(result.needsMigration).toBe(false);
      expect(result.migrations).toHaveLength(0);
    });
  });

  describe('applyMigrations', () => {
    it('returns unchanged record when no migrations needed', () => {
      const record = { data: 'value' };
      const result = registry.applyMigrations('test.collection', record);

      expect(result.success).toBe(true);
      expect(result.record).toBe(record);
      expect(result.migrationsApplied).toBe(0);
      expect(result.steps).toHaveLength(0);
    });

    it('applies a single migration', () => {
      const migration: SchemaMigration = {
        id: 'test-migration',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Test migration',
        needsMigration: (r) => typeof r === 'object' && r !== null && 'old' in r,
        migrate: (old) => {
          const rec = old as { old: string };
          return { new: rec.old };
        },
      };

      registry.register(migration);

      const result = registry.applyMigrations('test.collection', { old: 'value' });

      expect(result.success).toBe(true);
      expect(result.record).toEqual({ new: 'value' });
      expect(result.migrationsApplied).toBe(1);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]?.success).toBe(true);
      expect(result.steps[0]?.migrationId).toBe('test-migration');
      expect(result.finalVersion).toBe('0.2.0');
    });

    it('chains multiple migrations', () => {
      const migration1: SchemaMigration = {
        id: 'migration-1',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Migration 1',
        priority: 10,
        needsMigration: (r) => typeof r === 'object' && r !== null && 'v1' in r,
        migrate: (old) => {
          const rec = old as { v1: string };
          return { v2: rec.v1, fromV1: true };
        },
      };

      const migration2: SchemaMigration = {
        id: 'migration-2',
        fromVersion: '0.2.0',
        toVersion: '0.3.0',
        collection: 'test.collection',
        description: 'Migration 2',
        priority: 20,
        needsMigration: (r) => typeof r === 'object' && r !== null && 'v2' in r && !('v3' in r),
        migrate: (old) => {
          const rec = old as { v2: string; fromV1: boolean };
          return { v3: rec.v2, fromV1: rec.fromV1, fromV2: true };
        },
      };

      registry.register(migration1);
      registry.register(migration2);

      const result = registry.applyMigrations('test.collection', { v1: 'data' });

      expect(result.success).toBe(true);
      expect(result.record).toEqual({ v3: 'data', fromV1: true, fromV2: true });
      expect(result.migrationsApplied).toBe(2);
      expect(result.finalVersion).toBe('0.3.0');
    });

    it('handles migration errors gracefully', () => {
      const migration: SchemaMigration = {
        id: 'failing-migration',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Failing migration',
        needsMigration: () => true,
        migrate: () => {
          throw new Error('Migration failed');
        },
      };

      registry.register(migration);

      const result = registry.applyMigrations('test.collection', { data: 'value' });

      expect(result.success).toBe(false);
      expect(result.record).toBeUndefined();
      expect(result.error).toContain('Migration failed');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]?.success).toBe(false);
      expect(result.steps[0]?.error).toBe('Migration failed');
    });

    it('stops on first failure in chain', () => {
      const migration1: SchemaMigration = {
        id: 'succeeding-migration',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Succeeding migration',
        priority: 10,
        needsMigration: () => true,
        migrate: (x) => x,
      };

      const migration2: SchemaMigration = {
        id: 'failing-migration',
        fromVersion: '0.2.0',
        toVersion: '0.3.0',
        collection: 'test.collection',
        description: 'Failing migration',
        priority: 20,
        needsMigration: () => true,
        migrate: () => {
          throw new Error('Second migration failed');
        },
      };

      const migration3: SchemaMigration = {
        id: 'not-reached-migration',
        fromVersion: '0.3.0',
        toVersion: '0.4.0',
        collection: 'test.collection',
        description: 'Not reached',
        priority: 30,
        needsMigration: () => true,
        migrate: (x) => x,
      };

      registry.register(migration1);
      registry.register(migration2);
      registry.register(migration3);

      const result = registry.applyMigrations('test.collection', { data: 'value' });

      expect(result.success).toBe(false);
      expect(result.migrationsApplied).toBe(1);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0]?.success).toBe(true);
      expect(result.steps[1]?.success).toBe(false);
    });

    it('skips migrations that no longer apply after previous migrations', () => {
      const migration1: SchemaMigration = {
        id: 'migration-1',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Migration 1',
        priority: 10,
        needsMigration: (r) => typeof r === 'object' && r !== null && 'old' in r && !('new' in r),
        migrate: (old) => {
          const rec = old as { old: string };
          return { new: rec.old };
        },
      };

      // This migration checks for 'old' which won't exist after migration1
      const migration2: SchemaMigration = {
        id: 'migration-2',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Migration 2',
        priority: 20,
        needsMigration: (r) => typeof r === 'object' && r !== null && 'old' in r,
        migrate: (x) => x,
      };

      registry.register(migration1);
      registry.register(migration2);

      const result = registry.applyMigrations('test.collection', { old: 'value' });

      expect(result.success).toBe(true);
      expect(result.record).toEqual({ new: 'value' });
      // Only migration1 should have been applied
      expect(result.migrationsApplied).toBe(1);
    });
  });

  describe('getMigrationsForCollection', () => {
    it('returns all migrations for a collection', () => {
      const migration1: SchemaMigration = {
        id: 'migration-1',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'collection.a',
        description: 'Migration 1',
        needsMigration: () => false,
        migrate: (x) => x,
      };

      const migration2: SchemaMigration = {
        id: 'migration-2',
        fromVersion: '0.2.0',
        toVersion: '0.3.0',
        collection: 'collection.a',
        description: 'Migration 2',
        needsMigration: () => false,
        migrate: (x) => x,
      };

      const migration3: SchemaMigration = {
        id: 'migration-3',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'collection.b',
        description: 'Migration 3',
        needsMigration: () => false,
        migrate: (x) => x,
      };

      registry.register(migration1);
      registry.register(migration2);
      registry.register(migration3);

      const migrationsA = registry.getMigrationsForCollection('collection.a');
      const migrationsB = registry.getMigrationsForCollection('collection.b');

      expect(migrationsA).toHaveLength(2);
      expect(migrationsB).toHaveLength(1);
    });

    it('returns empty array for unknown collection', () => {
      const migrations = registry.getMigrationsForCollection('unknown.collection');
      expect(migrations).toHaveLength(0);
    });
  });

  describe('getAllMigrations', () => {
    it('returns all registered migrations', () => {
      const migration1: SchemaMigration = {
        id: 'migration-1',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'collection.a',
        description: 'Migration 1',
        needsMigration: () => false,
        migrate: (x) => x,
      };

      const migration2: SchemaMigration = {
        id: 'migration-2',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'collection.b',
        description: 'Migration 2',
        needsMigration: () => false,
        migrate: (x) => x,
      };

      registry.register(migration1);
      registry.register(migration2);

      const allMigrations = registry.getAllMigrations();

      expect(allMigrations).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('removes all migrations', () => {
      const migration: SchemaMigration = {
        id: 'test-migration',
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        collection: 'test.collection',
        description: 'Test migration',
        needsMigration: () => false,
        migrate: (x) => x,
      };

      registry.register(migration);
      expect(registry.getAllMigrations()).toHaveLength(1);

      registry.clear();
      expect(registry.getAllMigrations()).toHaveLength(0);
    });
  });
});

describe('compareVersions', () => {
  it('compares major versions correctly', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('compares minor versions correctly', () => {
    expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
    expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
  });

  it('compares patch versions correctly', () => {
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
    expect(compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
  });

  it('handles different length versions', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0')).toBe(0);
    expect(compareVersions('1', '1.0.0')).toBe(0);
  });
});
