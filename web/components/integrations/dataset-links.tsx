'use client';

import { ExternalLink, Database, FlaskConical, FolderOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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

  // Card variant
  return (
    <a
      href={dataset.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 no-underline',
        className
      )}
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-md shrink-0', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">{name}</div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground truncate">{dataset.title}</p>
        {dataset.doi && (
          <span className="text-xs text-muted-foreground font-mono">{dataset.doi}</span>
        )}
      </div>
    </a>
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
