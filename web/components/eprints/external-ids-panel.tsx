'use client';

/**
 * External identifiers panel for eprint pages.
 *
 * @remarks
 * Displays persistent identifiers (arXiv, PubMed, SSRN, etc.) as clickable
 * links to external services.
 *
 * @packageDocumentation
 */

import { Link as LinkIcon, BookText, FlaskConical, Landmark, Microscope } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResourceCard } from '@/components/links/resource-card';
import { Badge } from '@/components/ui/badge';
import { summarizeUrl } from '@/lib/atproto/at-uri-links';
import type { EprintExternalIds } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface ExternalIdsPanelProps {
  /** External identifiers object */
  externalIds?: EprintExternalIds;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// PLATFORM CONFIG
// =============================================================================

interface ExternalIdConfig {
  /** Property key on the ExternalIds object */
  key: keyof EprintExternalIds;
  /** Human-readable platform name */
  label: string;
  /** Returns the full URL for the identifier, or null if display-only */
  buildUrl: (id: string) => string | null;
  /** Service icon, so a reader recognizes the row before reading it */
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind text colour for the icon */
  color: string;
  /** Tailwind background for the icon tile */
  bgColor: string;
}

const EXTERNAL_ID_CONFIGS: ExternalIdConfig[] = [
  {
    key: 'arxivId',
    label: 'arXiv',
    buildUrl: (id) => `https://arxiv.org/abs/${id}`,
    icon: BookText,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
  },
  {
    key: 'pmid',
    label: 'PubMed',
    buildUrl: (id) => `https://pubmed.ncbi.nlm.nih.gov/${id}`,
    icon: Microscope,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  {
    key: 'pmcid',
    label: 'PubMed Central',
    buildUrl: (id) => `https://www.ncbi.nlm.nih.gov/pmc/articles/${id}`,
    icon: Microscope,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
  {
    key: 'ssrnId',
    label: 'SSRN',
    buildUrl: (id) => `https://ssrn.com/abstract=${id}`,
    icon: Landmark,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
  },
  {
    key: 'osf',
    label: 'OSF',
    buildUrl: (id) => `https://osf.io/${id}`,
    icon: FlaskConical,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950',
  },
  {
    key: 'zenodoDoi',
    label: 'Zenodo',
    buildUrl: (doi) => `https://doi.org/${doi}`,
    icon: Landmark,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50 dark:bg-sky-950',
  },
  {
    key: 'openAlexId',
    label: 'OpenAlex',
    buildUrl: (id) => `https://openalex.org/works/${id}`,
    icon: BookText,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950',
  },
  {
    key: 'semanticScholarId',
    label: 'Semantic Scholar',
    buildUrl: (id) => `https://api.semanticscholar.org/CorpusID:${id}`,
    icon: BookText,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 dark:bg-violet-950',
  },
  {
    key: 'coreSid',
    label: 'CORE',
    buildUrl: (id) => `https://core.ac.uk/outputs/${id}`,
    icon: BookText,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 dark:bg-teal-950',
  },
  {
    key: 'magId',
    label: 'Microsoft Academic (legacy)',
    buildUrl: () => null,
    icon: BookText,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900',
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * One external identifier, rendered as the page's standard link card.
 *
 * @remarks
 * The identifier leads, because that is the part a reader is looking for --
 * the same reason the repository card leads with `owner/repo` rather than with
 * "GitHub". The service name sits beside it as a badge, and the address it
 * resolves to sits under it, so the row says where it goes before it is
 * clicked.
 */
function ExternalIdRow({
  config,
  value,
  url,
}: {
  config: ExternalIdConfig;
  value: string;
  url: string | null;
}) {
  return (
    <ResourceCard
      icon={config.icon}
      iconColor={config.color}
      iconBg={config.bgColor}
      title={value}
      badge={config.label}
      subtitle={url ? summarizeUrl(url) : 'No public address'}
      {...(url ? { href: url } : {})}
    />
  );
}

/**
 * External identifiers panel component.
 *
 * Displays a card listing all external persistent identifiers associated
 * with an eprint, with clickable links to external services.
 *
 * @param props - Component props
 * @returns External IDs panel element, or null if no IDs have values
 */
export function ExternalIdsPanel({ externalIds, className }: ExternalIdsPanelProps) {
  if (!externalIds) {
    return null;
  }

  // Collect only configs where the ID has a value
  const presentIds = EXTERNAL_ID_CONFIGS.filter((config) => {
    const value = externalIds[config.key];
    return value !== undefined && value !== null && value !== '';
  });

  if (presentIds.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          External Identifiers
          <Badge variant="secondary" className="ml-1">
            {presentIds.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {presentIds.map((config) => {
          const value = externalIds[config.key] as string;
          const url = config.buildUrl(value);
          return <ExternalIdRow key={config.key} config={config} value={value} url={url} />;
        })}
      </CardContent>
    </Card>
  );
}
