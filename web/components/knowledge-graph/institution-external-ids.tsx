import { ExternalLink, Globe, Building2, Hash, Database } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Institution external ID sources.
 */
export type InstitutionIdSource = 'ror' | 'wikidata' | 'isni' | 'grid' | 'fundref';

/**
 * Institution external ID.
 */
export interface InstitutionExternalId {
  source: InstitutionIdSource;
  id: string;
  url?: string;
}

/**
 * Props for the InstitutionExternalIds component.
 */
export interface InstitutionExternalIdsProps {
  /** Array of external IDs */
  externalIds: InstitutionExternalId[];
  /** Display variant */
  variant?: 'list' | 'badges' | 'compact';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays external identifiers for an institution.
 *
 * @remarks
 * Server component showing links to ROR, Wikidata, ISNI, GRID,
 * and FundRef identifiers.
 *
 * @example
 * ```tsx
 * <InstitutionExternalIds externalIds={institution.externalIds} />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the external IDs
 */
export function InstitutionExternalIds({
  externalIds,
  variant = 'list',
  className,
}: InstitutionExternalIdsProps) {
  if (!externalIds || externalIds.length === 0) {
    return null;
  }

  if (variant === 'badges') {
    return <ExternalIdBadges externalIds={externalIds} className={className} />;
  }

  if (variant === 'compact') {
    return <ExternalIdCompact externalIds={externalIds} className={className} />;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        External Identifiers
      </h4>
      <ul className="space-y-2">
        {externalIds.map((extId) => (
          <ExternalIdItem key={`${extId.source}-${extId.id}`} externalId={extId} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Props for the ExternalIdItem component.
 */
interface ExternalIdItemProps {
  externalId: InstitutionExternalId;
}

/**
 * Single external ID item.
 */
function ExternalIdItem({ externalId }: ExternalIdItemProps) {
  const { icon, label, color } = getSourceConfig(externalId.source);
  const url = externalId.url ?? getDefaultUrl(externalId);

  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent', color)}
      >
        {icon}
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted-foreground">{externalId.id}</span>
        <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
      </a>
    </li>
  );
}

/**
 * Compact inline display of external IDs.
 */
function ExternalIdCompact({
  externalIds,
  className,
}: {
  externalIds: InstitutionExternalId[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {externalIds.map((extId) => {
        const { icon, label } = getSourceConfig(extId.source);
        const url = extId.url ?? getDefaultUrl(extId);

        return (
          <a
            key={`${extId.source}-${extId.id}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title={`${label}: ${extId.id}`}
          >
            {icon}
            <span>{label}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        );
      })}
    </div>
  );
}

/**
 * Badge display of external IDs.
 */
function ExternalIdBadges({
  externalIds,
  className,
}: {
  externalIds: InstitutionExternalId[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {externalIds.map((extId) => {
        const { icon, label, bgColor } = getSourceConfig(extId.source);
        const url = extId.url ?? getDefaultUrl(extId);

        return (
          <a
            key={`${extId.source}-${extId.id}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              bgColor
            )}
          >
            {icon}
            <span>{label}</span>
          </a>
        );
      })}
    </div>
  );
}

/**
 * Configuration for external ID sources.
 */
function getSourceConfig(source: InstitutionIdSource): {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
} {
  const configs: Record<
    InstitutionIdSource,
    { icon: React.ReactNode; label: string; color: string; bgColor: string }
  > = {
    ror: {
      icon: <Building2 className="h-4 w-4" />,
      label: 'ROR',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    },
    wikidata: {
      icon: <Globe className="h-4 w-4" />,
      label: 'Wikidata',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    isni: {
      icon: <Hash className="h-4 w-4" />,
      label: 'ISNI',
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    },
    grid: {
      icon: <Database className="h-4 w-4" />,
      label: 'GRID',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    },
    fundref: {
      icon: <Building2 className="h-4 w-4" />,
      label: 'FundRef',
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    },
  };

  return configs[source];
}

/**
 * Gets default URL for an external ID.
 */
function getDefaultUrl(externalId: InstitutionExternalId): string {
  const urlPatterns: Record<InstitutionIdSource, string> = {
    ror: `https://ror.org/${externalId.id}`,
    wikidata: `https://www.wikidata.org/wiki/${externalId.id}`,
    isni: `https://isni.org/isni/${externalId.id.replace(/\s/g, '')}`,
    grid: `https://grid.ac/institutes/${externalId.id}`,
    fundref: `https://doi.org/${externalId.id}`,
  };

  return urlPatterns[externalId.source];
}

/**
 * Props for the InstitutionExternalIdsSkeleton component.
 */
export interface InstitutionExternalIdsSkeletonProps {
  /** Number of items */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for InstitutionExternalIds.
 */
export function InstitutionExternalIdsSkeleton({
  count = 3,
  className,
}: InstitutionExternalIdsSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
