'use client';

import { ExternalLink, Check, X, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SoftwareHeritageIntegration } from '@/lib/hooks/use-integrations';

export interface SoftwareHeritageBadgeProps {
  data: SoftwareHeritageIntegration;
  variant?: 'badge' | 'card';
  className?: string;
}

/**
 * Displays Software Heritage archival status as a badge or card.
 *
 * @remarks
 * Shows whether the repository is archived in Software Heritage,
 * with link to browse the archive.
 */
export function SoftwareHeritageBadge({
  data,
  variant = 'badge',
  className,
}: SoftwareHeritageBadgeProps) {
  const url =
    data.browseUrl ??
    `https://archive.softwareheritage.org/browse/origin/directory/?origin_url=${encodeURIComponent(data.originUrl)}`;

  if (variant === 'badge') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('inline-flex items-center gap-1.5 no-underline', className)}
      >
        <Badge
          variant="outline"
          className={cn(
            'gap-1.5',
            data.archived
              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/50 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-700 border-amber-500/50 dark:text-amber-400'
          )}
        >
          {data.archived ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          SWH {data.archived ? 'Archived' : 'Not Archived'}
          <ExternalLink className="h-3 w-3 opacity-70" />
        </Badge>
      </a>
    );
  }

  // Card variant
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50 no-underline',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-white',
              data.archived ? 'bg-emerald-600' : 'bg-amber-600'
            )}
          >
            {data.archived ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </div>
          <div>
            <div className="text-sm font-medium">Software Heritage</div>
            <div className="text-xs text-muted-foreground">
              {data.archived ? 'Archived' : 'Not yet archived'}
            </div>
          </div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>

      <p className="text-xs text-muted-foreground line-clamp-1 font-mono">{data.originUrl}</p>

      {data.archived && data.lastVisit && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Last visit: {new Date(data.lastVisit).toLocaleDateString()}
          </Badge>
          {data.lastSnapshotSwhid && (
            <Badge variant="secondary" className="text-xs font-mono truncate max-w-[200px]">
              {data.lastSnapshotSwhid.slice(0, 30)}...
            </Badge>
          )}
        </div>
      )}
    </a>
  );
}
