import { ExternalLink, User, Globe, GraduationCap, BookOpen, Database, Hash } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Author external ID sources.
 */
export type AuthorIdSource =
  | 'orcid'
  | 'googleScholar'
  | 'semanticScholar'
  | 'scopus'
  | 'dblp'
  | 'viaf'
  | 'isni'
  | 'openAlex';

/**
 * Author external ID.
 */
export interface AuthorExternalId {
  source: AuthorIdSource;
  id: string;
  url?: string;
}

/**
 * Props for the AuthorExternalIds component.
 */
export interface AuthorExternalIdsProps {
  /** Array of external IDs */
  externalIds: AuthorExternalId[];
  /** Display variant */
  variant?: 'list' | 'badges' | 'compact';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays external identifiers for an author.
 *
 * @remarks
 * Server component showing links to ORCID, Google Scholar, Semantic Scholar,
 * Scopus, DBLP, VIAF, ISNI, and OpenAlex identifiers.
 *
 * @example
 * ```tsx
 * <AuthorExternalIds externalIds={author.externalIds} />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the external IDs
 */
export function AuthorExternalIds({
  externalIds,
  variant = 'list',
  className,
}: AuthorExternalIdsProps) {
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
  externalId: AuthorExternalId;
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
  externalIds: AuthorExternalId[];
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
  externalIds: AuthorExternalId[];
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
function getSourceConfig(source: AuthorIdSource): {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
} {
  const configs: Record<
    AuthorIdSource,
    { icon: React.ReactNode; label: string; color: string; bgColor: string }
  > = {
    orcid: {
      icon: <User className="h-4 w-4" />,
      label: 'ORCID',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    googleScholar: {
      icon: <GraduationCap className="h-4 w-4" />,
      label: 'Google Scholar',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    semanticScholar: {
      icon: <BookOpen className="h-4 w-4" />,
      label: 'Semantic Scholar',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    },
    scopus: {
      icon: <Database className="h-4 w-4" />,
      label: 'Scopus',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    },
    dblp: {
      icon: <BookOpen className="h-4 w-4" />,
      label: 'DBLP',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
    viaf: {
      icon: <Globe className="h-4 w-4" />,
      label: 'VIAF',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    isni: {
      icon: <Hash className="h-4 w-4" />,
      label: 'ISNI',
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    },
    openAlex: {
      icon: <Database className="h-4 w-4" />,
      label: 'OpenAlex',
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    },
  };

  return configs[source];
}

/**
 * Gets default URL for an external ID.
 */
function getDefaultUrl(externalId: AuthorExternalId): string {
  const urlPatterns: Record<AuthorIdSource, string> = {
    orcid: `https://orcid.org/${externalId.id}`,
    googleScholar: `https://scholar.google.com/citations?user=${externalId.id}`,
    semanticScholar: `https://www.semanticscholar.org/author/${externalId.id}`,
    scopus: `https://www.scopus.com/authid/detail.uri?authorId=${externalId.id}`,
    dblp: `https://dblp.org/pid/${externalId.id}`,
    viaf: `https://viaf.org/viaf/${externalId.id}`,
    isni: `https://isni.org/isni/${externalId.id.replace(/\s/g, '')}`,
    openAlex: `https://openalex.org/authors/${externalId.id}`,
  };

  return urlPatterns[externalId.source];
}

/**
 * Props for the AuthorExternalIdsSkeleton component.
 */
export interface AuthorExternalIdsSkeletonProps {
  /** Number of items */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for AuthorExternalIds.
 */
export function AuthorExternalIdsSkeleton({
  count = 3,
  className,
}: AuthorExternalIdsSkeletonProps) {
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
