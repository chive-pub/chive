'use client';

import { ExternalLink, Download, Eye, Archive, Lock, Unlock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ZenodoIntegration } from '@/lib/hooks/use-integrations';

export interface ZenodoBadgeProps {
  record: ZenodoIntegration;
  variant?: 'badge' | 'card';
  className?: string;
}

/**
 * Displays Zenodo record information as a badge or card.
 *
 * @remarks
 * Shows DOI, resource type, access rights, and optional stats.
 * Links to the Zenodo record page.
 */
export function ZenodoBadge({ record, variant = 'badge', className }: ZenodoBadgeProps) {
  const accessIcon =
    record.accessRight === 'open' ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />;

  if (variant === 'badge') {
    return (
      <a
        href={record.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('inline-flex items-center gap-1.5 no-underline', className)}
      >
        <Badge
          variant="outline"
          className="gap-1.5 bg-[#024C79] text-white hover:bg-[#024C79]/90 border-[#024C79]"
        >
          <Archive className="h-3 w-3" />
          DOI
          <ExternalLink className="h-3 w-3 opacity-70" />
        </Badge>
      </a>
    );
  }

  // Card variant
  return (
    <a
      href={record.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50 no-underline',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#024C79] text-white">
            <Archive className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">Zenodo</div>
            <div className="text-xs text-muted-foreground font-mono">{record.doi}</div>
          </div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">{record.title}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {record.resourceType}
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          {accessIcon}
          {record.accessRight}
        </Badge>
        {record.version && (
          <Badge variant="outline" className="text-xs">
            v{record.version}
          </Badge>
        )}
      </div>

      {record.stats && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{record.stats.views.toLocaleString()} views</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            <span>{record.stats.downloads.toLocaleString()} downloads</span>
          </div>
        </div>
      )}
    </a>
  );
}
