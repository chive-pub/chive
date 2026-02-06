/**
 * Schema migration type definitions.
 *
 * @remarks
 * Defines the core types for the schema migration system, including migration
 * definitions, registry interfaces, and result types.
 *
 * @packageDocumentation
 */

// =============================================================================
// MIGRATION DEFINITION TYPES
// =============================================================================

/**
 * A schema migration that transforms records from one version to another.
 *
 * @typeParam TOld - the shape of the old record format
 * @typeParam TNew - the shape of the new record format
 *
 * @example
 * ```typescript
 * const abstractMigration: SchemaMigration<LegacyEprint, CurrentEprint> = {
 *   id: 'eprint-abstract-string-to-rich-text',
 *   fromVersion: '0.1.0',
 *   toVersion: '0.2.0',
 *   collection: 'pub.chive.eprint.submission',
 *   description: 'Converts plain string abstract to rich text array',
 *   needsMigration: (record): record is LegacyEprint => {
 *     return typeof record.abstract === 'string';
 *   },
 *   migrate: (old) => ({
 *     ...old,
 *     abstract: [{ type: 'text', content: old.abstract }],
 *   }),
 * };
 * ```
 */
export interface SchemaMigration {
  /**
   * Unique identifier for this migration.
   *
   * @remarks
   * Should be descriptive and stable. Format: `{collection}-{field}-{change}`
   */
  readonly id: string;

  /**
   * Source schema version this migration applies to.
   *
   * @remarks
   * Follows semver format (e.g., "0.1.0", "1.0.0").
   */
  readonly fromVersion: string;

  /**
   * Target schema version after migration.
   */
  readonly toVersion: string;

  /**
   * Collection NSID this migration applies to.
   *
   * @remarks
   * Should match the ATProto collection NSID (e.g., "pub.chive.eprint.submission").
   */
  readonly collection: string;

  /**
   * Human-readable description of what the migration changes.
   *
   * @remarks
   * Used in UI to explain the migration to users.
   */
  readonly description: string;

  /**
   * Checks if a record needs this migration.
   *
   * @param record - the record to check (type unknown for safe checking)
   * @returns true if the record matches the old format and needs migration
   *
   * @remarks
   * This function should return true only for records that have the old
   * format and can be safely migrated.
   */
  needsMigration: (record: unknown) => boolean;

  /**
   * Transforms a record from the old format to the new format.
   *
   * @param old - the record in the old format
   * @returns the record in the new format
   *
   * @remarks
   * This function should be pure and not modify the input record.
   * It should handle all edge cases gracefully.
   */
  migrate: (old: unknown) => unknown;

  /**
   * Optional confirmation message for the migration UI.
   *
   * @remarks
   * If provided, shown in the migration dialog. If not provided, a default
   * message is generated from the description.
   */
  readonly confirmationMessage?: string;

  /**
   * Optional priority for migration ordering.
   *
   * @remarks
   * Lower numbers run first. Default is 100. Use to ensure dependent
   * migrations run in the correct order.
   */
  readonly priority?: number;

  /**
   * Optional URL to documentation about this migration.
   */
  readonly documentationUrl?: string;
}

// =============================================================================
// MIGRATION RESULT TYPES
// =============================================================================

/**
 * Result of applying a single migration.
 */
export interface MigrationStepResult {
  /**
   * ID of the migration that was applied.
   */
  readonly migrationId: string;

  /**
   * Whether the migration succeeded.
   */
  readonly success: boolean;

  /**
   * Source version.
   */
  readonly fromVersion: string;

  /**
   * Target version.
   */
  readonly toVersion: string;

  /**
   * Error message if migration failed.
   */
  readonly error?: string;

  /**
   * Time taken in milliseconds.
   */
  readonly durationMs?: number;
}

/**
 * Result of applying all applicable migrations to a record.
 */
export interface MigrationResult<T = unknown> {
  /**
   * Whether all migrations succeeded.
   */
  readonly success: boolean;

  /**
   * The migrated record (only present if success is true).
   */
  readonly record?: T;

  /**
   * Results for each migration step.
   */
  readonly steps: readonly MigrationStepResult[];

  /**
   * Total number of migrations applied.
   */
  readonly migrationsApplied: number;

  /**
   * Combined error message if any migration failed.
   */
  readonly error?: string;

  /**
   * Final schema version after all migrations.
   */
  readonly finalVersion?: string;
}

// =============================================================================
// MIGRATION DETECTION TYPES
// =============================================================================

/**
 * Information about a detected migration opportunity.
 */
export interface DetectedMigration {
  /**
   * Migration definition.
   */
  readonly migration: SchemaMigration;

  /**
   * Fields affected by this migration.
   */
  readonly affectedFields: readonly string[];

  /**
   * User-friendly label for the change.
   */
  readonly changeLabel: string;
}

/**
 * Result of checking a record for needed migrations.
 */
export interface MigrationDetectionResult {
  /**
   * Whether any migrations are available.
   */
  readonly needsMigration: boolean;

  /**
   * List of applicable migrations in order.
   */
  readonly migrations: readonly DetectedMigration[];

  /**
   * Current detected schema version.
   */
  readonly currentVersion?: string;

  /**
   * Target version after all migrations.
   */
  readonly targetVersion?: string;

  /**
   * Combined list of all affected field names.
   */
  readonly affectedFields: readonly string[];
}

// =============================================================================
// REGISTRY TYPES
// =============================================================================

/**
 * Interface for the migration registry.
 *
 * @remarks
 * The registry stores all registered migrations and provides methods to
 * query and apply them.
 */
export interface IMigrationRegistry {
  /**
   * Registers a new migration.
   *
   * @param migration - the migration to register
   * @throws if a migration with the same ID already exists
   */
  register(migration: SchemaMigration): void;

  /**
   * Checks a record for needed migrations.
   *
   * @param collection - the collection NSID
   * @param record - the record to check
   * @returns detection result with list of applicable migrations
   */
  detectMigrations(collection: string, record: unknown): MigrationDetectionResult;

  /**
   * Applies all applicable migrations to a record.
   *
   * @param collection - the collection NSID
   * @param record - the record to migrate
   * @returns migration result with the transformed record
   */
  applyMigrations<T>(collection: string, record: unknown): MigrationResult<T>;

  /**
   * Gets all registered migrations for a collection.
   *
   * @param collection - the collection NSID
   * @returns array of migrations for the collection
   */
  getMigrationsForCollection(collection: string): readonly SchemaMigration[];

  /**
   * Gets a migration by ID.
   *
   * @param id - the migration ID
   * @returns the migration or undefined if not found
   */
  getMigrationById(id: string): SchemaMigration | undefined;

  /**
   * Gets all registered migrations.
   *
   * @returns array of all migrations
   */
  getAllMigrations(): readonly SchemaMigration[];
}

// =============================================================================
// HOOK TYPES
// =============================================================================

/**
 * Options for the useMigration hook.
 */
export interface UseMigrationOptions {
  /**
   * Callback when migration completes successfully.
   */
  onSuccess?: (result: MigrationResult) => void;

  /**
   * Callback when migration fails.
   */
  onError?: (error: Error) => void;

  /**
   * Whether to automatically invalidate queries after migration.
   *
   * @default true
   */
  invalidateQueries?: boolean;
}

/**
 * Return type for the useMigration hook.
 */
export interface UseMigrationReturn {
  /**
   * Detection result for the current record.
   */
  readonly detection: MigrationDetectionResult;

  /**
   * Whether the record needs migration.
   */
  readonly needsMigration: boolean;

  /**
   * Function to apply all migrations.
   */
  applyMigrations: () => Promise<MigrationResult>;

  /**
   * Whether migration is in progress.
   */
  readonly isPending: boolean;

  /**
   * Error from the last migration attempt.
   */
  readonly error: Error | null;

  /**
   * Whether the last migration succeeded.
   */
  readonly isSuccess: boolean;

  /**
   * Reset the mutation state.
   */
  reset: () => void;
}
