'use client';

import { ExternalLink, Download, Eye, Archive, Lock, Unlock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ResourceCard, type ResourceStat } from '@/components/links/resource-card';
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

  // Card variant. The same shape as every other link on the page: the record
  // leads, the service names itself beside it, and what Zenodo knows about the
  // deposit -- type, access, version, views, downloads -- reads as facts under
  // it rather than as a row of unlabelled badges.
  const stats: ResourceStat[] = [
    { label: record.resourceType },
    { icon: record.accessRight === 'open' ? Unlock : Lock, label: record.accessRight },
  ];
  if (record.version) stats.push({ label: `v${record.version}` });
  if (record.stats) {
    stats.push({ icon: Eye, label: `${record.stats.views.toLocaleString()} views` });
    stats.push({ icon: Download, label: `${record.stats.downloads.toLocaleString()} downloads` });
  }

  return (
    <ResourceCard
      className={className}
      icon={Archive}
      iconColor="text-white"
      iconBg="bg-[#024C79]"
      title={record.doi}
      badge="Zenodo"
      description={record.title}
      stats={stats}
      href={record.url}
    />
  );
}
