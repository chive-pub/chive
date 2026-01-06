'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, History, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/format-date';
import type { PreprintVersion } from '@/lib/api/schema';

/**
 * Props for the PreprintVersionSelector component.
 */
export interface PreprintVersionSelectorProps {
  /** Array of version data */
  versions: PreprintVersion[];
  /** Currently selected version number */
  currentVersion: number;
  /** Callback when a version is selected */
  onVersionChange: (version: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Dropdown selector for switching between preprint versions.
 *
 * @remarks
 * Client component that handles interactive version switching.
 * Displays version number, date, and optional changelog.
 *
 * @example
 * ```tsx
 * <PreprintVersionSelector
 *   versions={preprint.versions}
 *   currentVersion={3}
 *   onVersionChange={(v) => setVersion(v)}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the version selector
 */
export function PreprintVersionSelector({
  versions,
  currentVersion,
  onVersionChange,
  className,
}: PreprintVersionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
  const latestVersion = sortedVersions[0]?.version ?? 1;
  const isLatest = currentVersion === latestVersion;

  const handleSelect = useCallback(
    (version: number) => {
      onVersionChange(version);
      setIsOpen(false);
    },
    [onVersionChange]
  );

  if (versions.length <= 1) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <FileText className="h-4 w-4" />
        <span>Version 1</span>
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2', className)}>
          <History className="h-4 w-4" />
          <span>Version {currentVersion}</span>
          {!isLatest && (
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Not latest
            </span>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {sortedVersions.map((version, index) => (
          <DropdownMenuItem
            key={version.cid}
            onClick={() => handleSelect(version.version)}
            className={cn(
              'flex flex-col items-start gap-1 py-2',
              version.version === currentVersion && 'bg-accent'
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-medium">
                Version {version.version}
                {version.version === latestVersion && (
                  <span className="ml-2 text-xs text-muted-foreground">(latest)</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(version.createdAt, { relative: true })}
              </span>
            </div>
            {version.changelog && (
              <p className="text-xs text-muted-foreground line-clamp-2">{version.changelog}</p>
            )}
            {index < sortedVersions.length - 1 && <DropdownMenuSeparator className="mt-2" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Props for the PreprintVersionTimeline component.
 */
export interface PreprintVersionTimelineProps {
  /** Array of version data */
  versions: PreprintVersion[];
  /** Currently selected version number */
  currentVersion?: number;
  /** Callback when a version is clicked */
  onVersionClick?: (version: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Visual timeline display of preprint versions.
 *
 * @remarks
 * Displays versions in chronological order with changelogs.
 * Useful for showing the full history on a detail page.
 *
 * @example
 * ```tsx
 * <PreprintVersionTimeline
 *   versions={preprint.versions}
 *   currentVersion={3}
 *   onVersionClick={(v) => navigateToVersion(v)}
 * />
 * ```
 */
export function PreprintVersionTimeline({
  versions,
  currentVersion,
  onVersionClick,
  className,
}: PreprintVersionTimelineProps) {
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  if (versions.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4" />
        Version History
      </h3>

      <div className="relative space-y-4 pl-6">
        {/* Timeline line */}
        <div className="absolute left-2 top-0 h-full w-px bg-border" />

        {sortedVersions.map((version, index) => {
          const isSelected = version.version === currentVersion;
          const isLatest = index === 0;

          return (
            <div key={version.cid} className="relative">
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute -left-4 top-1 h-3 w-3 rounded-full border-2',
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/50 bg-background'
                )}
              />

              <div
                className={cn(
                  'rounded-lg border p-3',
                  isSelected && 'border-primary bg-primary/5',
                  onVersionClick && 'cursor-pointer hover:bg-accent/50'
                )}
                onClick={() => onVersionClick?.(version.version)}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('font-medium', isSelected && 'text-primary')}>
                    Version {version.version}
                    {isLatest && (
                      <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                        Latest
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(version.createdAt)}
                  </span>
                </div>

                {version.changelog && (
                  <p className="mt-2 text-sm text-muted-foreground">{version.changelog}</p>
                )}

                <div className="mt-2 font-mono text-xs text-muted-foreground/70">
                  CID: {version.cid.slice(0, 12)}...
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Props for the VersionBadge component.
 */
export interface VersionBadgeProps {
  /** Version number */
  version: number;
  /** Whether this is the latest version */
  isLatest?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Simple badge displaying version number.
 *
 * @example
 * ```tsx
 * <VersionBadge version={3} isLatest />
 * ```
 */
export function VersionBadge({ version, isLatest = false, className }: VersionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isLatest ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted',
        className
      )}
    >
      <FileText className="h-3 w-3" />v{version}
      {isLatest && <span className="sr-only">(latest)</span>}
    </span>
  );
}
