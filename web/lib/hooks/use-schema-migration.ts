/**
 * Hook for schema migration operations.
 *
 * @remarks
 * Provides functionality to migrate eprint records from legacy formats
 * to the current schema. The migration flow:
 *
 * 1. Fetch the current record from the user's PDS
 * 2. Transform deprecated fields to current format
 * 3. Use `putRecord` to update the record in the PDS
 * 4. Invalidate relevant queries to refresh the UI
 *
 * @packageDocumentation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { authApi } from '@/lib/api/client';
import {
  transformToCurrentSchema,
  type SchemaMigrationResult,
  type MigratableEprintRecord,
} from '@/lib/api/schema-migration';
import { logger } from '@/lib/observability';

import { eprintKeys } from './use-eprint';

const migrationLogger = logger.child({ component: 'schema-migration' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parameters for the schema migration mutation.
 */
interface MigrateRecordParams {
  /** AT-URI of the record to migrate */
  uri: string;
}

/**
 * Result of a successful migration.
 */
interface MigrationSuccess extends SchemaMigrationResult {
  /** URI of the migrated record */
  uri: string;
  /** New CID after the update */
  cid?: string;
}

/**
 * Error thrown during schema migration.
 */
export class SchemaMigrationError extends Error {
  readonly code = 'SCHEMA_MIGRATION_ERROR';
  readonly uri: string;
  readonly phase: 'fetch' | 'transform' | 'update';

  constructor(
    message: string,
    uri: string,
    phase: 'fetch' | 'transform' | 'update',
    cause?: Error
  ) {
    super(message);
    this.name = 'SchemaMigrationError';
    this.uri = uri;
    this.phase = phase;
    this.cause = cause;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extracts the rkey from an AT-URI.
 *
 * @param uri - AT-URI (e.g., at://did:plc:abc/pub.chive.eprint.submission/xyz)
 * @returns Record key (e.g., xyz)
 */
function extractRkey(uri: string): string {
  const parts = uri.split('/');
  const rkey = parts[parts.length - 1];
  if (!rkey) {
    throw new Error(`Invalid AT-URI: ${uri}`);
  }
  return rkey;
}

/**
 * Extracts the DID from an AT-URI.
 *
 * @param uri - AT-URI (e.g., at://did:plc:abc/pub.chive.eprint.submission/xyz)
 * @returns DID (e.g., did:plc:abc)
 */
function extractDid(uri: string): string {
  const match = /^at:\/\/(did:[^/]+)\//.exec(uri);
  if (!match?.[1]) {
    throw new Error(`Invalid AT-URI: ${uri}`);
  }
  return match[1];
}

/**
 * Extracts the collection from an AT-URI.
 *
 * @param uri - AT-URI (e.g., at://did:plc:abc/pub.chive.eprint.submission/xyz)
 * @returns Collection NSID (e.g., pub.chive.eprint.submission)
 */
function extractCollection(uri: string): string {
  const parts = uri.replace('at://', '').split('/');
  if (parts.length < 2) {
    throw new Error(`Invalid AT-URI: ${uri}`);
  }
  return parts[1] ?? '';
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for migrating eprint records to the current schema.
 *
 * @returns Mutation object with `migrateRecord`, loading state, and error
 *
 * @remarks
 * This hook handles the complete migration flow:
 * 1. Validates the user is authenticated
 * 2. Fetches the current record from the PDS
 * 3. Transforms deprecated fields using schema migration utilities
 * 4. Updates the record in the PDS via `putRecord`
 * 5. Invalidates relevant queries to refresh the UI
 *
 * The mutation requires the user to be the record owner (same DID).
 *
 * @example
 * ```tsx
 * const { mutate: migrateRecord, isPending, error, isSuccess } = useSchemaMigration();
 *
 * const handleMigrate = async () => {
 *   try {
 *     await migrateRecord({ uri: eprint.uri });
 *     toast.success('Record updated to latest format');
 *   } catch (error) {
 *     toast.error('Failed to update record');
 *   }
 * };
 *
 * return (
 *   <Button onClick={handleMigrate} disabled={isPending}>
 *     {isPending ? 'Updating...' : 'Update to Latest Format'}
 *   </Button>
 * );
 * ```
 */
export function useSchemaMigration() {
  const queryClient = useQueryClient();

  return useMutation<MigrationSuccess, SchemaMigrationError, MigrateRecordParams>({
    mutationFn: async ({ uri }) => {
      const agent = getCurrentAgent();

      if (!agent) {
        throw new SchemaMigrationError(
          'Not authenticated. Please sign in to migrate records.',
          uri,
          'fetch'
        );
      }

      const did = extractDid(uri);
      const collection = extractCollection(uri);
      const rkey = extractRkey(uri);

      migrationLogger.info('Starting schema migration', { uri, did, collection, rkey });

      // Step 1: Fetch the current record from the PDS
      let currentRecord: MigratableEprintRecord;
      try {
        const response = await agent.api.com.atproto.repo.getRecord({
          repo: did,
          collection,
          rkey,
        });

        if (!response.data.value) {
          throw new Error('Record not found');
        }

        currentRecord = response.data.value as MigratableEprintRecord;

        migrationLogger.debug('Fetched current record', {
          uri,
          hasTitle: !!currentRecord.title,
          hasTitleRich: !!currentRecord.titleRich,
          hasAbstract: !!currentRecord.abstract,
          abstractType: typeof currentRecord.abstract,
          hasLicenseUri: !!currentRecord.licenseUri,
        });
      } catch (err) {
        migrationLogger.error('Failed to fetch record for migration', err as Error, { uri });
        throw new SchemaMigrationError(
          'Failed to fetch record from PDS. The record may have been deleted or you may not have access.',
          uri,
          'fetch',
          err instanceof Error ? err : undefined
        );
      }

      // Step 2: Transform to current schema
      let migrationResult: SchemaMigrationResult;
      try {
        migrationResult = transformToCurrentSchema(currentRecord);

        if (!migrationResult.success || !migrationResult.record) {
          const failedFields = migrationResult.fields
            .filter((f) => !f.success)
            .map((f) => f.field)
            .join(', ');
          throw new Error(`Migration failed for fields: ${failedFields}`);
        }

        migrationLogger.debug('Transformed record', {
          uri,
          migratedFields: migrationResult.fields.map((f) => f.field),
        });
      } catch (err) {
        migrationLogger.error('Failed to transform record', err as Error, { uri });
        throw new SchemaMigrationError(
          'Failed to transform record to current schema format.',
          uri,
          'transform',
          err instanceof Error ? err : undefined
        );
      }

      // Step 3: Update the record in the PDS
      let cid: string | undefined;
      try {
        const updateResponse = await agent.api.com.atproto.repo.putRecord({
          repo: did,
          collection,
          rkey,
          record: migrationResult.record,
        });

        cid = updateResponse.data.cid;

        migrationLogger.info('Successfully migrated record', {
          uri,
          cid,
          migratedFields: migrationResult.fields.map((f) => f.field),
        });

        // Request immediate re-indexing as a UX optimization.
        // The firehose is the primary indexing mechanism, but there may be latency.
        // This call ensures the record appears immediately in Chive's index.
        try {
          await authApi.pub.chive.sync.indexRecord({ uri });
        } catch {
          migrationLogger.warn('Immediate re-indexing failed; firehose will handle', { uri });
        }
      } catch (err) {
        migrationLogger.error('Failed to update record in PDS', err as Error, { uri });
        throw new SchemaMigrationError(
          'Failed to update record in your PDS. Please try again.',
          uri,
          'update',
          err instanceof Error ? err : undefined
        );
      }

      return {
        ...migrationResult,
        uri,
        cid,
      };
    },

    onSuccess: (data) => {
      // Invalidate the specific eprint query to refresh data
      queryClient.invalidateQueries({ queryKey: eprintKeys.detail(data.uri) });

      // Invalidate list queries to refresh any lists containing this eprint
      queryClient.invalidateQueries({ queryKey: eprintKeys.all });

      migrationLogger.debug('Invalidated queries after migration', { uri: data.uri });
    },

    onError: (error) => {
      migrationLogger.error('Schema migration failed', error, {
        uri: error.uri,
        phase: error.phase,
      });
    },
  });
}

/**
 * Checks if the current user can migrate a record.
 *
 * @param recordUri - AT-URI of the record
 * @param recordOwnerDid - DID of the record owner (submittedBy or paperDid)
 * @param currentUserDid - DID of the current authenticated user
 * @returns True if the user can migrate the record
 *
 * @remarks
 * A user can migrate a record if:
 * - They are authenticated
 * - They own the record (their DID matches the record's submittedBy or paperDid)
 *
 * @example
 * ```typescript
 * const canMigrate = canUserMigrateRecord(
 *   eprint.uri,
 *   eprint.submittedBy,
 *   currentUser?.did
 * );
 * ```
 */
export function canUserMigrateRecord(
  recordUri: string,
  recordOwnerDid: string,
  currentUserDid: string | undefined
): boolean {
  if (!currentUserDid) {
    return false;
  }

  // Check if the user is the record owner
  // For paper-centric records, this should be the paper DID
  // For traditional records, this is the submitter DID
  const recordDid = extractDid(recordUri);

  return recordDid === currentUserDid || recordOwnerDid === currentUserDid;
}
