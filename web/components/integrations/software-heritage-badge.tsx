'use client';

import { ExternalLink, Check, X, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ResourceCard, type ResourceStat } from '@/components/links/resource-card';
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

  // Card variant, in the page's standard shape. What is archived, and when it
  // was last seen, are the two things a reader wants from this card.
  const stats: ResourceStat[] = [
    { icon: data.archived ? Check : Clock, label: data.archived ? 'Archived' : 'Not yet archived' },
  ];
  if (data.archived && data.lastVisit) {
    stats.push({ label: `Last visit ${new Date(data.lastVisit).toLocaleDateString()}` });
  }
  if (data.archived && data.lastSnapshotSwhid) {
    stats.push({ label: `${data.lastSnapshotSwhid.slice(0, 24)}…`, title: data.lastSnapshotSwhid });
  }

  return (
    <ResourceCard
      className={className}
      icon={data.archived ? Check : X}
      iconColor="text-white"
      iconBg={data.archived ? 'bg-emerald-600' : 'bg-amber-600'}
      title="Software Heritage"
      badge="Archive"
      subtitle={data.originUrl}
      subtitleMono
      stats={stats}
      href={url}
    />
  );
}
