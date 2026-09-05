'use client';

import { ExternalLink, Database, FlaskConical, FolderOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ResourceCard, type ResourceStat } from '@/components/links/resource-card';
import { summarizeUrl } from '@/lib/atproto/at-uri-links';
import { cn } from '@/lib/utils';
import type { DatasetIntegration } from '@/lib/hooks/use-integrations';

export interface DatasetLinksProps {
  datasets: DatasetIntegration[];
  className?: string;
}

/**
 * Get icon component for dataset type.
 */
function getDatasetIcon(type: DatasetIntegration['type']) {
  switch (type) {
    case 'figshare':
      return Database;
    case 'dryad':
      return FlaskConical;
    case 'osf':
      return FolderOpen;
    default:
      return Database;
  }
}

/**
 * Get display name for dataset type.
 */
function getDatasetName(type: DatasetIntegration['type']): string {
  switch (type) {
    case 'figshare':
      return 'Figshare';
    case 'dryad':
      return 'Dryad';
    case 'osf':
      return 'OSF';
    default:
      return type;
  }
}

/**
 * Get brand color for dataset type.
 */
function getDatasetColor(type: DatasetIntegration['type']): string {
  switch (type) {
    case 'figshare':
      return 'bg-[#5C0D36] text-white';
    case 'dryad':
      return 'bg-[#3B8E3B] text-white';
    case 'osf':
      return 'bg-[#2C5F8F] text-white';
    default:
      return 'bg-muted';
  }
}

export interface DatasetLinkItemProps {
  dataset: DatasetIntegration;
  variant?: 'badge' | 'card';
  className?: string;
}

/**
 * Displays a single dataset link as a badge or card.
 */
export function DatasetLinkItem({ dataset, variant = 'badge', className }: DatasetLinkItemProps) {
  const Icon = getDatasetIcon(dataset.type);
  const name = getDatasetName(dataset.type);
  const color = getDatasetColor(dataset.type);

  if (variant === 'badge') {
    return (
      <a
        href={dataset.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('inline-flex items-center gap-1.5 no-underline', className)}
      >
        <Badge variant="outline" className={cn('gap-1.5 border-current/50', color)}>
          <Icon className="h-3 w-3" />
          {name}
          <ExternalLink className="h-3 w-3 opacity-70" />
        </Badge>
      </a>
    );
  }

  // Card variant, in the page's standard shape: the deposit's own title leads,
  // the repository names itself beside it, and the DOI and address read as
  // facts under it rather than as two anonymous grey lines.
  const stats: ResourceStat[] = [];
  if (dataset.doi) stats.push({ label: `DOI: ${dataset.doi}` });

  return (
    <ResourceCard
      className={className}
      icon={Icon}
      iconColor="text-white"
      iconBg={color}
      title={dataset.title || name}
      badge={name}
      subtitle={dataset.url ? summarizeUrl(dataset.url) : undefined}
      stats={stats}
      href={dataset.url}
    />
  );
}

/**
 * Displays a list of dataset links.
 *
 * @remarks
 * Shows links to Figshare, Dryad, OSF, and other dataset repositories.
 * Can display as badges or cards.
 */
export function DatasetLinks({ datasets, className }: DatasetLinksProps) {
  if (!datasets || datasets.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {datasets.map((dataset, index) => (
        <DatasetLinkItem key={`${dataset.type}-${index}`} dataset={dataset} variant="badge" />
      ))}
    </div>
  );
}
