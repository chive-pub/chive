'use client';

/**
 * Version history component for eprints.
 *
 * @remarks
 * Displays a timeline of version changes with expandable details.
 * Uses the changelog data from the ATProto AppView index.
 *
 * @packageDocumentation
 */

import { AlertCircle, Clock, FileText, History } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChangelogView } from '@/lib/api/generated/types/pub/chive/eprint/listChangelogs';
import { useEprintChangelogs, formatVersion } from '@/lib/hooks/use-eprint-mutations';
import { formatDate } from '@/lib/utils/format-date';

/**
 * Props for the VersionHistory component.
 */
export interface VersionHistoryProps {
  /** AT Protocol URI of the eprint */
  eprintUri: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Human-readable labels for changelog categories.
 */
const CATEGORY_LABELS: Record<string, string> = {
  methodology: 'Methodology',
  results: 'Results',
  analysis: 'Analysis',
  discussion: 'Discussion',
  conclusions: 'Conclusions',
  data: 'Data',
  figures: 'Figures',
  tables: 'Tables',
  references: 'References',
  'supplementary-materials': 'Supplementary Materials',
  corrections: 'Corrections',
  formatting: 'Formatting',
  'language-editing': 'Language Editing',
  acknowledgments: 'Acknowledgments',
  authorship: 'Authorship',
  other: 'Other',
};

/**
 * Human-readable labels for change types.
 */
const CHANGE_TYPE_LABELS: Record<string, string> = {
  added: 'Added',
  changed: 'Changed',
  removed: 'Removed',
  fixed: 'Fixed',
  deprecated: 'Deprecated',
};

/**
 * Badge variant for each change type.
 */
const CHANGE_TYPE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  added: 'default',
  changed: 'secondary',
  removed: 'destructive',
  fixed: 'outline',
  deprecated: 'outline',
};

/**
 * Displays an eprint's version history with expandable changelog details.
 *
 * @param props - Component props
 * @param props.eprintUri - AT Protocol URI of the eprint
 * @param props.className - Additional CSS classes
 * @returns React element displaying the version history timeline
 *
 * @example
 * ```tsx
 * <VersionHistory eprintUri="at://did:plc:abc/pub.chive.eprint.submission/123" />
 * ```
 */
export function VersionHistory({ eprintUri, className }: VersionHistoryProps) {
  const { data, isLoading, error } = useEprintChangelogs(eprintUri);

  if (isLoading) {
    return <VersionHistorySkeleton className={className} />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading version history</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data || data.changelogs.length === 0) {
    return <VersionHistoryEmpty className={className} />;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Version History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-2">
          {data.changelogs.map((changelog, index) => (
            <VersionEntry key={changelog.uri} changelog={changelog} isLatest={index === 0} />
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

/**
 * Props for the VersionEntry component.
 */
interface VersionEntryProps {
  /** Changelog data for this version */
  changelog: ChangelogView;
  /** Whether this is the latest version */
  isLatest: boolean;
}

/**
 * Individual version entry in the timeline.
 *
 * @param props - Component props
 * @returns React element for a single version entry
 */
function VersionEntry({ changelog, isLatest }: VersionEntryProps) {
  const versionString = formatVersion(changelog.version);
  const previousVersionString = changelog.previousVersion
    ? formatVersion(changelog.previousVersion)
    : null;

  return (
    <AccordionItem
      value={changelog.uri}
      className="rounded-lg border bg-card"
      data-testid="version-entry"
    >
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex w-full items-center justify-between pr-2">
          <div className="flex items-center gap-3">
            <span className="font-mono font-semibold" data-testid="version-number">
              v{versionString}
            </span>
            {isLatest && (
              <Badge variant="default" className="text-xs">
                Latest
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span data-testid="version-date">{formatDate(changelog.createdAt)}</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4">
          {/* Summary */}
          {changelog.summary && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm" data-testid="version-summary">
                {changelog.summary}
              </p>
            </div>
          )}

          {/* Previous version indicator */}
          {previousVersionString && (
            <p className="text-xs text-muted-foreground">Updated from v{previousVersionString}</p>
          )}

          {/* Sections */}
          {changelog.sections.length > 0 && (
            <div className="space-y-3">
              {changelog.sections.map((section, sectionIndex) => (
                <div
                  key={`${section.category}-${sectionIndex}`}
                  className="space-y-2"
                  data-testid="changelog-section"
                >
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {CATEGORY_LABELS[section.category] ?? section.category}
                  </h4>
                  <ul className="space-y-2 pl-4">
                    {section.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="flex items-start gap-2 text-sm"
                        data-testid="changelog-item"
                      >
                        {item.changeType && (
                          <Badge
                            variant={CHANGE_TYPE_VARIANTS[item.changeType] ?? 'outline'}
                            className="mt-0.5 shrink-0 text-xs"
                          >
                            {CHANGE_TYPE_LABELS[item.changeType] ?? item.changeType}
                          </Badge>
                        )}
                        <div className="flex-1">
                          <span>{item.description}</span>
                          {item.location && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({item.location})
                            </span>
                          )}
                          {item.reviewReference && (
                            <span className="ml-1 text-xs italic text-muted-foreground">
                              [Re: {item.reviewReference}]
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Reviewer response */}
          {changelog.reviewerResponse && (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
              <h4 className="mb-1 text-sm font-medium text-blue-800 dark:text-blue-200">
                Response to Peer Review
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {changelog.reviewerResponse}
              </p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Props for skeleton and empty components.
 */
interface VersionHistoryStateProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the version history component.
 *
 * @param props - Component props
 * @returns React element displaying the loading skeleton
 */
export function VersionHistorySkeleton({ className }: VersionHistoryStateProps) {
  return (
    <Card className={className} data-testid="version-history-skeleton">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-16" />
                {i === 1 && <Skeleton className="h-5 w-12" />}
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Empty state for the version history component.
 *
 * @param props - Component props
 * @returns React element displaying the empty state
 */
export function VersionHistoryEmpty({ className }: VersionHistoryStateProps) {
  return (
    <Card className={className} data-testid="version-history-empty">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Version History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No version history available for this eprint.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Version changelogs will appear here when the eprint is updated.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
