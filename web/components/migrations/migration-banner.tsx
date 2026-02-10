'use client';

/**
 * Schema migration banner component.
 *
 * @remarks
 * A reusable banner that displays when a record needs schema migration.
 * Shows what will change, allows the user to apply migrations, and
 * handles loading/error states.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
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

import type { MigrationDetectionResult, MigrationResult } from '@/lib/migrations/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Eprint owner information for permission checking.
 */
interface RecordOwnerInfo {
  /** AT-URI of the record */
  uri: string;
  /** DID of the record owner */
  ownerDid: string;
}

/**
 * Props for the MigrationBanner component.
 */
export interface MigrationBannerProps {
  /** Migration detection result */
  detection: MigrationDetectionResult;
  /** Record information for display */
  record: RecordOwnerInfo;
  /** Current user's DID (undefined if not authenticated) */
  currentUserDid?: string;
  /** Whether the user can migrate this record */
  canMigrate: boolean;
  /** Function to apply migrations */
  onMigrate: () => Promise<MigrationResult>;
  /** Whether migration is in progress */
  isPending: boolean;
  /** Whether migration succeeded */
  isSuccess: boolean;
  /** Error from migration attempt */
  error: Error | null;
  /** Function to reset error state */
  onReset: () => void;
  /** Callback when migration completes successfully */
  onMigrationComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
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
 * @example
 * ```tsx
 * const migration = useMigration('pub.chive.eprint.submission', eprint, eprint.uri);
 *
 * <MigrationBanner
 *   detection={migration.detection}
 *   record={{ uri: eprint.uri, ownerDid: eprint.submittedBy }}
 *   currentUserDid={currentUser?.did}
 *   canMigrate={canUserMigrateRecord(eprint.uri, eprint.submittedBy, currentUser?.did)}
 *   onMigrate={migration.applyMigrations}
 *   isPending={migration.isPending}
 *   isSuccess={migration.isSuccess}
 *   error={migration.error}
 *   onReset={migration.reset}
 *   onMigrationComplete={() => toast.success('Record updated!')}
 * />
 * ```
 */
export function MigrationBanner({
  detection,
  record: _record,
  currentUserDid: _currentUserDid,
  canMigrate,
  onMigrate,
  isPending,
  isSuccess,
  error,
  onReset,
  onMigrationComplete,
  className,
}: MigrationBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Don't render if no migration needed
  if (!detection.needsMigration) {
    return null;
  }

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  // Don't render if user cannot migrate (not authenticated or not owner)
  if (!canMigrate) {
    return null;
  }

  // Handle migration
  const handleMigrate = async () => {
    try {
      await onMigrate();
      onMigrationComplete?.();
    } catch {
      // Error handled by mutation
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true);
    onReset();
  };

  // Handle retry
  const handleRetry = () => {
    onReset();
    handleMigrate();
  };

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
        <AlertTitle className="pr-8 text-green-800 dark:text-green-200">Record Updated</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          Your record has been updated to the latest format. The changes will be synced shortly.
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-6 w-6 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
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

  // Get unique change labels
  const changeLabels = [...new Set(detection.migrations.map((m) => m.changeLabel))];

  // Default state (migration available)
  return (
    <Alert
      className={cn(
        'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
        className
      )}
    >
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="pr-8 text-amber-800 dark:text-amber-200">
        Format Update Available
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <div className="flex flex-col gap-3">
          <p>
            Your record uses an older format. Update for better search, rich text support, and
            improved compatibility.
          </p>

          {changeLabels.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">Fields to update:</span> {changeLabels.join(', ')}
            </p>
          )}

          {/* Expandable details */}
          {detection.migrations.length > 0 && (
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
                  {detection.migrations.map((m) => (
                    <li key={m.migration.id}>{m.migration.description}</li>
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
          </div>
        </div>
      </AlertDescription>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 h-6 w-6 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </Alert>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

/**
 * Skeleton loading state for the migration banner.
 *
 * @remarks
 * Use when loading record data asynchronously.
 */
export function MigrationBannerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-24 animate-pulse rounded-lg border border-muted bg-muted/50', className)}
    />
  );
}
