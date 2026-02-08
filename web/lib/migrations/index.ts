/**
 * Schema migration system.
 *
 * @remarks
 * Provides a centralized, extensible system for migrating user PDS records
 * from older schema versions to the current format.
 *
 * ## Usage
 *
 * ### Registering Migrations
 *
 * Migrations should be registered at application startup:
 *
 * ```typescript
 * import { registerEprintMigrations } from '@/lib/migrations';
 *
 * // In your app initialization
 * registerEprintMigrations();
 * ```
 *
 * ### Detecting Migrations
 *
 * Check if a record needs migration:
 *
 * ```typescript
 * import { migrationRegistry } from '@/lib/migrations';
 *
 * const detection = migrationRegistry.detectMigrations(
 *   'pub.chive.eprint.submission',
 *   eprintRecord
 * );
 *
 * if (detection.needsMigration) {
 *   console.log('Migrations needed:', detection.migrations);
 * }
 * ```
 *
 * ### Using the Hook
 *
 * In React components, use the `useMigration` hook:
 *
 * ```tsx
 * import { useMigration, canUserMigrateRecord } from '@/lib/migrations';
 *
 * function EprintViewer({ eprint }: { eprint: Eprint }) {
 *   const {
 *     needsMigration,
 *     detection,
 *     applyMigrations,
 *     isPending,
 *     error,
 *   } = useMigration('pub.chive.eprint.submission', eprint, eprint.uri);
 *
 *   if (needsMigration) {
 *     return <MigrationBanner ... />;
 *   }
 *
 *   return <EprintContent eprint={eprint} />;
 * }
 * ```
 *
 * ### Adding New Migrations
 *
 * Create a new migration definition:
 *
 * ```typescript
 * import type { SchemaMigration } from '@/lib/migrations';
 *
 * const myMigration: SchemaMigration<OldType, NewType> = {
 *   id: 'collection-field-change-description',
 *   fromVersion: '0.1.0',
 *   toVersion: '0.2.0',
 *   collection: 'pub.chive.my.collection',
 *   description: 'Human-readable description',
 *   needsMigration: (record): record is OldType => {
 *     // Type guard to check if record needs migration
 *     return hasOldFormat(record);
 *   },
 *   migrate: (old) => {
 *     // Transform to new format
 *     return { ...old, newField: transformOldField(old.oldField) };
 *   },
 * };
 * ```
 *
 * Register it with the registry:
 *
 * ```typescript
 * import { migrationRegistry } from '@/lib/migrations';
 *
 * migrationRegistry.register(myMigration);
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  SchemaMigration,
  IMigrationRegistry,
  MigrationDetectionResult,
  MigrationResult,
  MigrationStepResult,
  DetectedMigration,
  UseMigrationOptions,
  UseMigrationReturn,
} from './types';

// =============================================================================
// REGISTRY EXPORTS
// =============================================================================

export { migrationRegistry, MigrationRegistry, compareVersions } from './registry';

// =============================================================================
// HOOK EXPORTS
// =============================================================================

export { useMigration, canUserMigrateRecord, MigrationError } from './use-migration';

// =============================================================================
// EPRINT MIGRATION EXPORTS
// =============================================================================

export {
  eprintMigrations,
  registerEprintMigrations,
  containsLatex,
  parseTitleToRichText,
  LICENSE_URI_MAP,
} from './eprint-migrations';
