/**
 * Record migration system entry point.
 *
 * @remarks
 * Import this module to register all migrations. The migration registry is
 * populated by side-effect imports of migration files.
 *
 * @packageDocumentation
 */

export {
  migrateRecord,
  needsMigration,
  getCurrentRevision,
  getMigrations,
  registerMigration,
  type RecordMigration,
} from './record-migrator.js';

// Register all migrations (side-effect imports, order matters)
import './migrations/0001-rich-text-and-license.js';
import './migrations/0002-affiliation-tree.js';
