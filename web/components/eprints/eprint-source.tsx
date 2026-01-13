import { ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/format-date';
import type { EprintSource as EprintSourceType } from '@/lib/api/schema';

/**
 * Props for the EprintSource component.
 */
export interface EprintSourceProps {
  /** Source data including PDS endpoint and verification status */
  source: EprintSourceType;
  /** Display variant */
  variant?: 'inline' | 'card';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays ATProto source information for transparency.
 *
 * @remarks
 * Server component that shows where the eprint data originates from.
 * This is critical for ATProto compliance - users must be able to verify
 * data at its source in the user's Personal Data Server (PDS).
 *
 * Shows:
 * - PDS endpoint URL
 * - Link to original record
 * - Staleness indicator if data may be out of date
 * - Last verification timestamp
 *
 * @example
 * ```tsx
 * <EprintSource
 *   source={{
 *     pdsEndpoint: 'https://pds.example.com',
 *     recordUrl: 'at://did:plc:abc/pub.chive.eprint.submission/123',
 *     stale: false,
 *   }}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the source information
 */
export function EprintSource({ source, variant = 'inline', className }: EprintSourceProps) {
  if (variant === 'card') {
    return <EprintSourceCard source={source} className={className} />;
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      {source.stale ? (
        <AlertTriangle className="h-3 w-3 text-yellow-500" />
      ) : (
        <CheckCircle className="h-3 w-3 text-green-500" />
      )}
      <span>
        Source:{' '}
        <a
          href={source.recordUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground hover:underline"
        >
          {formatPdsEndpoint(source.pdsEndpoint)}
          <ExternalLink className="ml-1 inline h-3 w-3" />
        </a>
      </span>
      {source.stale && <span className="text-yellow-600">(may be outdated)</span>}
    </div>
  );
}

/**
 * Card variant of the EprintSource component.
 */
function EprintSourceCard({ source, className }: EprintSourceProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/50 p-4',
        source.stale && 'border-yellow-500/50',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium">
            {source.stale ? (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            Data Source
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            This eprint is stored in the author&apos;s Personal Data Server (PDS).
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">PDS Endpoint</span>
          <a
            href={source.pdsEndpoint}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono text-xs hover:text-primary hover:underline"
          >
            {formatPdsEndpoint(source.pdsEndpoint)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Original Record</span>
          <a
            href={source.recordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs hover:text-primary hover:underline"
          >
            View at source
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {source.lastVerifiedAt && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last Verified</span>
            <span className="text-xs">{formatDate(source.lastVerifiedAt, { relative: true })}</span>
          </div>
        )}

        {source.stale && (
          <div className="mt-2 rounded bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
            This data may be outdated. The source PDS may have newer information.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Formats a PDS endpoint URL for display.
 */
function formatPdsEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}
