/**
 * Schema migration registry.
 *
 * @remarks
 * Provides a centralized registry for all schema migrations. The registry
 * handles migration detection, ordering, and chaining.
 *
 * @packageDocumentation
 */

import type {
  SchemaMigration,
  IMigrationRegistry,
  MigrationDetectionResult,
  MigrationResult,
  MigrationStepResult,
  DetectedMigration,
} from './types';

// =============================================================================
// FIELD DETECTION HELPERS
// =============================================================================

/**
 * Maps migration IDs to affected field names.
 *
 * @remarks
 * Used to provide user-friendly field labels in the migration UI.
 */
const MIGRATION_FIELD_MAP: Record<string, readonly string[]> = {
  'eprint-abstract-string-to-rich-text': ['abstract'],
  'eprint-title-latex-to-rich-text': ['title', 'titleRich'],
  'eprint-license-slug-to-uri': ['license', 'licenseUri', 'licenseSlug'],
};

/**
 * Maps field names to user-friendly labels.
 */
const FIELD_LABELS: Record<string, string> = {
  abstract: 'Abstract format',
  title: 'Title formatting',
  titleRich: 'Title formatting',
  license: 'License reference',
  licenseUri: 'License reference',
  licenseSlug: 'License reference',
  body: 'Review body format',
  reviewBody: 'Review body format',
};

/**
 * Gets affected field names for a migration.
 */
function getAffectedFields(migration: SchemaMigration): readonly string[] {
  return MIGRATION_FIELD_MAP[migration.id] ?? [];
}

/**
 * Gets a user-friendly label for a migration.
 */
function getChangeLabel(migration: SchemaMigration): string {
  const fields = getAffectedFields(migration);
  if (fields.length === 0) {
    return migration.description;
  }

  const labels = fields.map((f) => FIELD_LABELS[f] ?? f);
  const uniqueLabels = [...new Set(labels)];
  return uniqueLabels.join(', ');
}

// =============================================================================
// REGISTRY IMPLEMENTATION
// =============================================================================

/**
 * Default migration priority.
 */
const DEFAULT_PRIORITY = 100;

/**
 * Implementation of the migration registry.
 *
 * @remarks
 * The registry is a singleton that stores all migrations and provides methods
 * to detect and apply them.
 */
class MigrationRegistry implements IMigrationRegistry {
  private readonly migrations: Map<string, SchemaMigration> = new Map();
  private readonly byCollection: Map<string, SchemaMigration[]> = new Map();

  /**
   * Registers a new migration.
   *
   * @param migration - the migration to register
   * @throws Error if a migration with the same ID already exists
   */
  register(migration: SchemaMigration): void {
    if (this.migrations.has(migration.id)) {
      throw new Error(`Migration with ID "${migration.id}" already registered`);
    }

    this.migrations.set(migration.id, migration);

    // Index by collection
    const collectionMigrations = this.byCollection.get(migration.collection) ?? [];
    collectionMigrations.push(migration);

    // Sort by priority (lower first) then by version
    collectionMigrations.sort((a, b) => {
      const priorityA = a.priority ?? DEFAULT_PRIORITY;
      const priorityB = b.priority ?? DEFAULT_PRIORITY;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return compareVersions(a.fromVersion, b.fromVersion);
    });

    this.byCollection.set(migration.collection, collectionMigrations);
  }

  /**
   * Checks a record for needed migrations.
   */
  detectMigrations(collection: string, record: unknown): MigrationDetectionResult {
    const collectionMigrations = this.byCollection.get(collection) ?? [];
    const detected: DetectedMigration[] = [];
    const affectedFieldsSet = new Set<string>();

    for (const migration of collectionMigrations) {
      if (migration.needsMigration(record)) {
        const fields = getAffectedFields(migration);
        fields.forEach((f) => affectedFieldsSet.add(f));

        detected.push({
          migration,
          affectedFields: fields,
          changeLabel: getChangeLabel(migration),
        });
      }
    }

    const needsMigration = detected.length > 0;
    const currentVersion = needsMigration ? detected[0]?.migration.fromVersion : undefined;
    const targetVersion = needsMigration
      ? detected[detected.length - 1]?.migration.toVersion
      : undefined;

    return {
      needsMigration,
      migrations: detected,
      currentVersion,
      targetVersion,
      affectedFields: [...affectedFieldsSet],
    };
  }

  /**
   * Applies all applicable migrations to a record.
   *
   * @remarks
   * This method iterates through all registered migrations for the collection,
   * applying each migration that detects it needs to run on the current record
   * state. Migrations are applied in priority order, and after each migration,
   * subsequent migrations are re-checked against the transformed record.
   */
  applyMigrations<T>(collection: string, record: unknown): MigrationResult<T> {
    const collectionMigrations = this.byCollection.get(collection) ?? [];

    if (collectionMigrations.length === 0) {
      return {
        success: true,
        record: record as T,
        steps: [],
        migrationsApplied: 0,
      };
    }

    const steps: MigrationStepResult[] = [];
    let currentRecord = record;
    let finalVersion: string | undefined;
    const appliedMigrations = new Set<string>();

    // Keep iterating until no more migrations apply
    let hasChanges = true;
    while (hasChanges) {
      hasChanges = false;

      for (const migration of collectionMigrations) {
        // Skip already applied migrations
        if (appliedMigrations.has(migration.id)) {
          continue;
        }

        // Check if this migration applies to the current record state
        if (!migration.needsMigration(currentRecord)) {
          continue;
        }

        const startTime = performance.now();

        try {
          currentRecord = migration.migrate(currentRecord);
          finalVersion = migration.toVersion;
          appliedMigrations.add(migration.id);
          hasChanges = true;

          steps.push({
            migrationId: migration.id,
            success: true,
            fromVersion: migration.fromVersion,
            toVersion: migration.toVersion,
            durationMs: performance.now() - startTime,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';

          steps.push({
            migrationId: migration.id,
            success: false,
            fromVersion: migration.fromVersion,
            toVersion: migration.toVersion,
            error: errorMessage,
            durationMs: performance.now() - startTime,
          });

          return {
            success: false,
            steps,
            migrationsApplied: steps.filter((s) => s.success).length,
            error: `Migration "${migration.id}" failed: ${errorMessage}`,
          };
        }
      }
    }

    return {
      success: true,
      record: currentRecord as T,
      steps,
      migrationsApplied: steps.length,
      finalVersion,
    };
  }

  /**
   * Gets all registered migrations for a collection.
   */
  getMigrationsForCollection(collection: string): readonly SchemaMigration[] {
    return this.byCollection.get(collection) ?? [];
  }

  /**
   * Gets a migration by ID.
   */
  getMigrationById(id: string): SchemaMigration | undefined {
    return this.migrations.get(id);
  }

  /**
   * Gets all registered migrations.
   */
  getAllMigrations(): readonly SchemaMigration[] {
    return [...this.migrations.values()];
  }

  /**
   * Clears all registered migrations.
   *
   * @remarks
   * Primarily useful for testing.
   */
  clear(): void {
    this.migrations.clear();
    this.byCollection.clear();
  }
}

// =============================================================================
// VERSION COMPARISON UTILITY
// =============================================================================

/**
 * Compares two semver version strings.
 *
 * @param a - first version
 * @param b - second version
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] ?? 0;
    const partB = partsB[i] ?? 0;
    if (partA !== partB) {
      return partA - partB;
    }
  }

  return 0;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global migration registry instance.
 *
 * @remarks
 * Use this singleton to register and query migrations throughout the application.
 *
 * @example
 * ```typescript
 * import { migrationRegistry } from '@/lib/migrations';
 *
 * // Register a migration
 * migrationRegistry.register(myMigration);
 *
 * // Check if a record needs migration
 * const result = migrationRegistry.detectMigrations('pub.chive.eprint.submission', record);
 * ```
 */
export const migrationRegistry = new MigrationRegistry();

// =============================================================================
// EXPORTS
// =============================================================================

export { MigrationRegistry, compareVersions };
