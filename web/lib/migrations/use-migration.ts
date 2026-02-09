/**
 * Migration hook for React components.
 *
 * @remarks
 * Provides a React hook for detecting and applying schema migrations
 * to user PDS records.
 *
 * @packageDocumentation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';

import { getCurrentAgent } from '@/lib/auth/oauth-client';
import { authApi } from '@/lib/api/client';
import { logger } from '@/lib/observability';
import { eprintKeys } from '@/lib/hooks/use-eprint';

import type {
  UseMigrationOptions,
  UseMigrationReturn,
  MigrationDetectionResult,
  MigrationResult,
} from './types';
import { migrationRegistry } from './registry';

// =============================================================================
// LOGGER
// =============================================================================

const migrationLogger = logger.child({ component: 'schema-migration' });

// =============================================================================
// AT-URI PARSING UTILITIES
// =============================================================================

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
 * @param uri - AT-URI
 * @returns Collection NSID (e.g., pub.chive.eprint.submission)
 */
function extractCollection(uri: string): string {
  const parts = uri.replace('at://', '').split('/');
  if (parts.length < 2) {
    throw new Error(`Invalid AT-URI: ${uri}`);
  }
  return parts[1] ?? '';
}

/**
 * Extracts the rkey from an AT-URI.
 *
 * @param uri - AT-URI
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

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Error thrown during schema migration operations.
 */
export class MigrationError extends Error {
  readonly code = 'MIGRATION_ERROR';
  readonly uri: string;
  readonly phase: 'fetch' | 'transform' | 'update';
  readonly migrationsApplied: number;

  constructor(
    message: string,
    uri: string,
    phase: 'fetch' | 'transform' | 'update',
    migrationsApplied: number = 0,
    cause?: Error
  ) {
    super(message);
    this.name = 'MigrationError';
    this.uri = uri;
    this.phase = phase;
    this.migrationsApplied = migrationsApplied;
    this.cause = cause;
  }
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for detecting and applying schema migrations.
 *
 * @param collection - the collection NSID
 * @param record - the record to check for migrations
 * @param uri - the AT-URI of the record (required for applying migrations)
 * @param options - hook options
 * @returns migration state and actions
 *
 * @remarks
 * This hook:
 * 1. Detects if the record needs any schema migrations
 * 2. Provides information about what will change
 * 3. Allows applying all migrations with a single call
 * 4. Handles the PDS update automatically
 *
 * @example
 * ```tsx
 * function EprintViewer({ eprint }: { eprint: Eprint }) {
 *   const {
 *     needsMigration,
 *     detection,
 *     applyMigrations,
 *     isPending,
 *     error,
 *   } = useMigration(
 *     'pub.chive.eprint.submission',
 *     eprint,
 *     eprint.uri
 *   );
 *
 *   if (needsMigration) {
 *     return (
 *       <MigrationBanner
 *         detection={detection}
 *         onMigrate={applyMigrations}
 *         isPending={isPending}
 *         error={error}
 *       />
 *     );
 *   }
 *
 *   return <EprintContent eprint={eprint} />;
 * }
 * ```
 */
export function useMigration(
  collection: string,
  record: unknown,
  uri: string,
  options: UseMigrationOptions = {}
): UseMigrationReturn {
  const { onSuccess, onError, invalidateQueries = true } = options;

  const queryClient = useQueryClient();

  // Detect migrations
  const detection: MigrationDetectionResult = useMemo(() => {
    if (!record) {
      return {
        needsMigration: false,
        migrations: [],
        affectedFields: [],
      };
    }
    return migrationRegistry.detectMigrations(collection, record);
  }, [collection, record]);

  // Mutation for applying migrations
  const mutation = useMutation<MigrationResult, MigrationError>({
    mutationFn: async () => {
      const agent = getCurrentAgent();

      if (!agent) {
        throw new MigrationError(
          'Not authenticated. Please sign in to migrate records.',
          uri,
          'fetch'
        );
      }

      const did = extractDid(uri);
      const coll = extractCollection(uri);
      const rkey = extractRkey(uri);

      migrationLogger.info('Starting schema migration', {
        uri,
        did,
        collection: coll,
        rkey,
        migrationCount: detection.migrations.length,
      });

      // Step 1: Fetch current record from PDS
      let currentRecord: unknown;
      try {
        const response = await agent.api.com.atproto.repo.getRecord({
          repo: did,
          collection: coll,
          rkey,
        });

        if (!response.data.value) {
          throw new Error('Record not found');
        }

        currentRecord = response.data.value;

        migrationLogger.debug('Fetched current record', { uri });
      } catch (err) {
        migrationLogger.error('Failed to fetch record for migration', err as Error, { uri });
        throw new MigrationError(
          'Failed to fetch record from PDS. The record may have been deleted or you may not have access.',
          uri,
          'fetch',
          0,
          err instanceof Error ? err : undefined
        );
      }

      // Step 2: Apply migrations
      let result: MigrationResult;
      try {
        result = migrationRegistry.applyMigrations(coll, currentRecord);

        if (!result.success || !result.record) {
          throw new Error(result.error ?? 'Migration failed');
        }

        migrationLogger.debug('Applied migrations', {
          uri,
          migrationsApplied: result.migrationsApplied,
          finalVersion: result.finalVersion,
        });
      } catch (err) {
        migrationLogger.error('Failed to apply migrations', err as Error, { uri });
        throw new MigrationError(
          'Failed to transform record to current schema format.',
          uri,
          'transform',
          0,
          err instanceof Error ? err : undefined
        );
      }

      // Step 3: Update record in PDS
      try {
        await agent.api.com.atproto.repo.putRecord({
          repo: did,
          collection: coll,
          rkey,
          record: result.record as Record<string, unknown>,
        });

        migrationLogger.info('Successfully migrated record', {
          uri,
          migrationsApplied: result.migrationsApplied,
          finalVersion: result.finalVersion,
        });

        // Request immediate re-indexing so the backend index reflects the
        // migrated record. The firehose will also pick it up, but this
        // avoids the latency gap that causes the migration banner to reappear.
        try {
          await authApi.pub.chive.sync.indexRecord({ uri });
        } catch {
          migrationLogger.warn('Immediate re-indexing failed; firehose will handle', { uri });
        }
      } catch (err) {
        migrationLogger.error('Failed to update record in PDS', err as Error, { uri });
        throw new MigrationError(
          'Failed to update record in your PDS. Please try again.',
          uri,
          'update',
          result.migrationsApplied,
          err instanceof Error ? err : undefined
        );
      }

      return result;
    },

    onSuccess: (data) => {
      if (invalidateQueries) {
        // Invalidate the specific record query
        queryClient.invalidateQueries({ queryKey: eprintKeys.detail(uri) });

        // Invalidate list queries
        queryClient.invalidateQueries({ queryKey: eprintKeys.all });
      }

      migrationLogger.debug('Invalidated queries after migration', { uri });

      onSuccess?.(data);
    },

    onError: (error) => {
      migrationLogger.error('Schema migration failed', error, {
        uri: error.uri,
        phase: error.phase,
        migrationsApplied: error.migrationsApplied,
      });

      onError?.(error);
    },
  });

  const applyMigrations = useCallback(() => {
    return mutation.mutateAsync();
  }, [mutation]);

  return {
    detection,
    needsMigration: detection.needsMigration,
    applyMigrations,
    isPending: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// =============================================================================
// PERMISSION CHECK UTILITY
// =============================================================================

/**
 * Checks if a user can migrate a record.
 *
 * @param recordUri - AT-URI of the record
 * @param recordOwnerDid - DID of the record owner
 * @param currentUserDid - DID of the current user
 * @returns true if the user can migrate the record
 *
 * @remarks
 * A user can migrate a record if they are authenticated and own the record.
 */
export function canUserMigrateRecord(
  recordUri: string,
  recordOwnerDid: string,
  currentUserDid: string | undefined
): boolean {
  if (!currentUserDid) {
    return false;
  }

  const recordDid = extractDid(recordUri);
  return recordDid === currentUserDid || recordOwnerDid === currentUserDid;
}
