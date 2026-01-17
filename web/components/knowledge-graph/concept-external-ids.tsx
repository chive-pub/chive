import { ExternalLink, Globe, BookOpen, Database, Beaker, Palette } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Concept external ID sources.
 */
export type ConceptIdSource = 'wikidata' | 'lcsh' | 'fast' | 'mesh' | 'aat' | 'getty';

/**
 * Concept external ID.
 */
export interface ConceptExternalId {
  source: ConceptIdSource;
  id: string;
  url?: string;
}

/**
 * Props for the ConceptExternalIds component.
 */
export interface ConceptExternalIdsProps {
  /** Array of external IDs */
  externalIds: ConceptExternalId[];
  /** Display variant */
  variant?: 'list' | 'badges' | 'compact';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays external identifiers for a concept.
 *
 * @remarks
 * Server component showing links to Wikidata, LCSH, FAST, MeSH,
 * and AAT (Art & Architecture Thesaurus) identifiers.
 *
 * @example
 * ```tsx
 * <ConceptExternalIds externalIds={concept.externalIds} />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the external IDs
 */
export function ConceptExternalIds({
  externalIds,
  variant = 'list',
  className,
}: ConceptExternalIdsProps) {
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
  externalId: ConceptExternalId;
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
  externalIds: ConceptExternalId[];
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
  externalIds: ConceptExternalId[];
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
function getSourceConfig(source: ConceptIdSource): {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
} {
  const configs: Record<
    ConceptIdSource,
    { icon: React.ReactNode; label: string; color: string; bgColor: string }
  > = {
    wikidata: {
      icon: <Globe className="h-4 w-4" />,
      label: 'Wikidata',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    lcsh: {
      icon: <BookOpen className="h-4 w-4" />,
      label: 'LCSH',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    fast: {
      icon: <Database className="h-4 w-4" />,
      label: 'FAST',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    mesh: {
      icon: <Beaker className="h-4 w-4" />,
      label: 'MeSH',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    aat: {
      icon: <Palette className="h-4 w-4" />,
      label: 'AAT',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    },
    getty: {
      icon: <Palette className="h-4 w-4" />,
      label: 'Getty',
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
    },
  };

  return configs[source];
}

/**
 * Gets default URL for an external ID.
 */
function getDefaultUrl(externalId: ConceptExternalId): string {
  const urlPatterns: Record<ConceptIdSource, string> = {
    wikidata: `https://www.wikidata.org/wiki/${externalId.id}`,
    lcsh: `https://id.loc.gov/authorities/subjects/${externalId.id}`,
    fast: `https://id.worldcat.org/fast/${externalId.id}`,
    mesh: `https://meshb.nlm.nih.gov/record/ui?ui=${externalId.id}`,
    aat: `https://vocab.getty.edu/aat/${externalId.id}`,
    getty: `https://vocab.getty.edu/page/${externalId.id}`,
  };

  return urlPatterns[externalId.source];
}

/**
 * Props for the ConceptExternalIdsSkeleton component.
 */
export interface ConceptExternalIdsSkeletonProps {
  /** Number of items */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for ConceptExternalIds.
 */
export function ConceptExternalIdsSkeleton({
  count = 3,
  className,
}: ConceptExternalIdsSkeletonProps) {
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
