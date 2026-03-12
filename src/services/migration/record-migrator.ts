/**
 * Record migration service for transforming old-format PDS records at index time.
 *
 * @remarks
 * Chive is a read-only AppView. Records live in user PDSes and cannot be
 * modified. Migration transforms are applied when records are read from the
 * firehose or fetched from a PDS, before indexing into Chive's databases.
 *
 * Migrations are registered as (lexicon, fromRevision, toRevision) tuples and
 * applied in sequence to bring any record up to the current schema revision.
 *
 * @packageDocumentation
 */

/**
 * A single migration step from one schema revision to the next.
 */
export interface RecordMigration {
  /** Lexicon NSID this migration applies to (e.g., 'pub.chive.eprint.submission'). */
  lexicon: string;
  /** Source revision (records at this revision will be migrated). */
  fromRevision: number;
  /** Target revision after migration. */
  toRevision: number;
  /** Human-readable description of the migration. */
  description: string;
  /** Transform function. Returns a new record object (must not mutate input). */
  migrate: (record: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Registry of all record migrations, keyed by lexicon NSID.
 */
const migrations: RecordMigration[] = [];

/**
 * Current schema revision for each record-type lexicon, derived from registered migrations.
 *
 * Records without a schemaRevision field are treated as revision 1.
 */
const currentRevisions: Record<string, number> = {};

/**
 * Register a migration step.
 *
 * @remarks
 * Deduplicates by (lexicon, fromRevision). Updates the current revision
 * for the lexicon to the maximum toRevision across all registered migrations.
 */
export function registerMigration(migration: RecordMigration): void {
  // Deduplicate: skip if an identical (lexicon, fromRevision) migration exists
  const exists = migrations.some(
    (m) => m.lexicon === migration.lexicon && m.fromRevision === migration.fromRevision
  );
  if (exists) return;

  migrations.push(migration);
  // Keep sorted by (lexicon, fromRevision) for sequential application
  migrations.sort((a, b) => a.lexicon.localeCompare(b.lexicon) || a.fromRevision - b.fromRevision);

  // Auto-derive current revision as the max toRevision for this lexicon
  const current = currentRevisions[migration.lexicon] ?? 1;
  if (migration.toRevision > current) {
    currentRevisions[migration.lexicon] = migration.toRevision;
  }
}

/**
 * Get the current schema revision for a lexicon.
 *
 * @returns The current revision number, or 1 if not explicitly tracked.
 */
export function getCurrentRevision(lexicon: string): number {
  return currentRevisions[lexicon] ?? 1;
}

/**
 * Migrate a record from its current schema revision to the latest.
 *
 * @param lexicon - Lexicon NSID of the record
 * @param record - The record data (will not be mutated)
 * @returns The migrated record at the current schema revision
 */
export function migrateRecord(
  lexicon: string,
  record: Record<string, unknown>
): Record<string, unknown> {
  const targetRevision = getCurrentRevision(lexicon);
  let currentRevision = (record.schemaRevision as number) ?? 1;

  if (currentRevision >= targetRevision) {
    return record;
  }

  let migrated = { ...record };
  const lexiconMigrations = migrations.filter((m) => m.lexicon === lexicon);

  while (currentRevision < targetRevision) {
    const migration = lexiconMigrations.find((m) => m.fromRevision === currentRevision);
    if (!migration) {
      // No migration path found; return as-is with a warning marker
      break;
    }
    migrated = migration.migrate(migrated);
    currentRevision = migration.toRevision;
  }

  migrated.schemaRevision = currentRevision;
  return migrated;
}

/**
 * Check if a record needs migration.
 */
export function needsMigration(lexicon: string, record: Record<string, unknown>): boolean {
  const currentRev = (record.schemaRevision as number) ?? 1;
  return currentRev < getCurrentRevision(lexicon);
}

/**
 * Get all registered migrations for a lexicon.
 */
export function getMigrations(lexicon: string): RecordMigration[] {
  return migrations.filter((m) => m.lexicon === lexicon);
}
