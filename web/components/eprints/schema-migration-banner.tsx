'use client';

/**
 * Schema migration banner component for eprint records.
 *
 * @remarks
 * Displays a dismissable banner when an eprint record uses deprecated formats.
 * Provides a one-click "Update to Latest Format" button that triggers the
 * schema migration flow.
 *
 * This component wraps the generic migration system for eprint-specific use
 * cases, supporting both the old API (schemaHints from API responses) and
 * the new registry-based migration detection.
 *
 * @packageDocumentation
 */

import { useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useMigration,
  canUserMigrateRecord,
  migrationRegistry,
  registerEprintMigrations,
  type MigrationDetectionResult,
} from '@/lib/migrations';

// Register eprint migrations on module load
registerEprintMigrations();

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Collection NSID for eprint submissions.
 */
const EPRINT_COLLECTION = 'pub.chive.eprint.submission';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Schema hints from the API response.
 *
 * @remarks
 * These hints are included in the `_schemaHints` field of API responses
 * when a record uses deprecated formats.
 */
export interface ApiSchemaHints {
  /** Schema version string (e.g., "0.1.0") */
  schemaVersion?: string;
  /** List of field names using deprecated formats */
  deprecatedFields?: readonly string[];
  /** Whether a migration is available */
  migrationAvailable?: boolean;
  /** URL to migration documentation */
  migrationUrl?: string;
}

/**
 * Eprint data needed for permission checking and migration.
 */
interface EprintOwnerInfo {
  /** AT-URI of the eprint */
  uri: string;
  /** DID of the human who submitted this eprint */
  submittedBy: string;
  /** DID of the paper account (if paper-centric) */
  paperDid?: string;
}

/**
 * Props for the SchemaMigrationBanner component.
 */
export interface SchemaMigrationBannerProps {
  /** Schema hints from the API response (optional, used if record not provided) */
  schemaHints?: ApiSchemaHints;
  /** Eprint owner information for permission checking */
  eprint: EprintOwnerInfo;
  /** The actual eprint record for registry-based detection (optional) */
  record?: unknown;
  /** Current user's DID (undefined if not authenticated) */
  currentUserDid?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when migration completes successfully */
  onMigrationComplete?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Banner component for schema migration notifications.
 *
 * @param props - Component props
 * @returns React element or null if no migration needed
 *
 * @remarks
 * Supports two modes of operation:
 * 1. API hints mode: Uses `schemaHints` from API response (backward compatible)
 * 2. Registry mode: Uses `record` with the migration registry for detection
 *
 * When `record` is provided, the registry-based detection takes precedence.
 *
 * @example
 * ```tsx
 * // Using API hints (backward compatible)
 * <SchemaMigrationBanner
 *   schemaHints={eprint._schemaHints}
 *   eprint={{ uri: eprint.uri, submittedBy: eprint.submittedBy }}
 *   currentUserDid={currentUser?.did}
 * />
 *
 * // Using registry-based detection
 * <SchemaMigrationBanner
 *   record={eprint}
 *   eprint={{ uri: eprint.uri, submittedBy: eprint.submittedBy }}
 *   currentUserDid={currentUser?.did}
 * />
 * ```
 */
export function SchemaMigrationBanner({
  schemaHints,
  eprint,
  record,
  currentUserDid,
  className,
  onMigrationComplete,
}: SchemaMigrationBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Detect migrations using registry if record is provided
  const registryDetection = useMemo((): MigrationDetectionResult => {
    if (record) {
      return migrationRegistry.detectMigrations(EPRINT_COLLECTION, record);
    }
    return { needsMigration: false, migrations: [], affectedFields: [] };
  }, [record]);

  // Use registry-based hook for applying migrations
  const migration = useMigration(EPRINT_COLLECTION, record ?? {}, eprint.uri);

  // Determine if migration is needed (registry takes precedence)
  const needsMigration = record
    ? registryDetection.needsMigration
    : (schemaHints?.migrationAvailable ?? false);

  // Don't render if no migration available
  if (!needsMigration) {
    return null;
  }

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  // Check if current user can migrate
  const ownerDid = eprint.paperDid ?? eprint.submittedBy;
  const canMigrate = canUserMigrateRecord(eprint.uri, ownerDid, currentUserDid);

  // Don't render if user cannot migrate
  if (!canMigrate) {
    return null;
  }

  // Handle migration
  const handleMigrate = async () => {
    try {
      await migration.applyMigrations();
      onMigrationComplete?.();
    } catch {
      // Error handled by mutation
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true);
    migration.reset();
  };

  // Handle retry
  const handleRetry = () => {
    migration.reset();
    handleMigrate();
  };

  // Get display information
  const deprecatedFieldsDisplay = record
    ? formatMigrationLabels(registryDetection)
    : formatDeprecatedFields(schemaHints?.deprecatedFields);

  const migrationDescriptions = registryDetection.migrations.map((m) => m.migration.description);

  // State from the migration hook
  const isPending = migration.isPending;
  const isSuccess = migration.isSuccess;
  const error = migration.error;

  // Success state
  if (isSuccess) {
    return (
      <Alert
        className={cn(
          'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
          className
        )}
      >
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-200">Record Updated</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          Your record has been updated to the latest format. The changes will be synced shortly.
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </Alert>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Update Failed</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{error.message}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Default state (migration available)
  return (
    <Alert
      className={cn(
        'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
        className
      )}
    >
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Format Update Available
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <div className="flex flex-col gap-3">
          <p>
            Your record uses an older format. Update for better search, rich text support, and
            improved compatibility.
          </p>

          {deprecatedFieldsDisplay && (
            <p className="text-sm">
              <span className="font-medium">Fields to update:</span> {deprecatedFieldsDisplay}
            </p>
          )}

          {/* Expandable details (only when using registry-based detection) */}
          {migrationDescriptions.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-sm text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Show details
                  </>
                )}
              </Button>

              {showDetails && (
                <ul className="mt-2 list-inside list-disc text-sm">
                  {migrationDescriptions.map((desc, idx) => (
                    <li key={idx}>{desc}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleMigrate}
              disabled={isPending}
              size="sm"
              className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Update Now
                </>
              )}
            </Button>

            {schemaHints?.migrationUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={schemaHints.migrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  Learn More
                </a>
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </Alert>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Formats deprecated field names for display.
 *
 * @param fields - Array of field names
 * @returns Formatted string for display
 *
 * @remarks
 * Maps internal field names to user-friendly labels:
 * - `title` or `titleRich` -> "Title formatting"
 * - `abstract` -> "Abstract format"
 * - `license` -> "License reference"
 * - `reviewBody` or `body` -> "Review body format" (for future use)
 */
function formatDeprecatedFields(fields?: readonly string[]): string | null {
  if (!fields || fields.length === 0) {
    return null;
  }

  const fieldLabels: Record<string, string> = {
    title: 'Title formatting',
    titleRich: 'Title formatting',
    abstract: 'Abstract format',
    license: 'License reference',
    reviewBody: 'Review body format',
    body: 'Review body format',
  };

  return fields.map((field) => fieldLabels[field] ?? field).join(', ');
}

/**
 * Formats migration labels from registry detection.
 *
 * @param detection - Migration detection result
 * @returns Formatted string for display
 */
function formatMigrationLabels(detection: MigrationDetectionResult): string | null {
  const labels = detection.migrations.map((m) => m.changeLabel);
  const uniqueLabels = [...new Set(labels)];

  if (uniqueLabels.length === 0) {
    return null;
  }

  return uniqueLabels.join(', ');
}

/**
 * Skeleton loading state for the migration banner.
 *
 * @remarks
 * Use this when loading schema hints asynchronously.
 */
export function SchemaMigrationBannerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-24 animate-pulse rounded-lg border border-muted bg-muted/50', className)}
    />
  );
}
