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

import { ExternalLink, Link as LinkIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
}

const EXTERNAL_ID_CONFIGS: ExternalIdConfig[] = [
  {
    key: 'arxivId',
    label: 'arXiv',
    buildUrl: (id) => `https://arxiv.org/abs/${id}`,
  },
  {
    key: 'pmid',
    label: 'PubMed',
    buildUrl: (id) => `https://pubmed.ncbi.nlm.nih.gov/${id}`,
  },
  {
    key: 'pmcid',
    label: 'PubMed Central',
    buildUrl: (id) => `https://www.ncbi.nlm.nih.gov/pmc/articles/${id}`,
  },
  {
    key: 'ssrnId',
    label: 'SSRN',
    buildUrl: (id) => `https://ssrn.com/abstract=${id}`,
  },
  {
    key: 'osf',
    label: 'OSF',
    buildUrl: (id) => `https://osf.io/${id}`,
  },
  {
    key: 'zenodoDoi',
    label: 'Zenodo',
    buildUrl: (doi) => `https://doi.org/${doi}`,
  },
  {
    key: 'openAlexId',
    label: 'OpenAlex',
    buildUrl: (id) => `https://openalex.org/works/${id}`,
  },
  {
    key: 'semanticScholarId',
    label: 'Semantic Scholar',
    buildUrl: (id) => `https://api.semanticscholar.org/CorpusID:${id}`,
  },
  {
    key: 'coreSid',
    label: 'CORE',
    buildUrl: (id) => `https://core.ac.uk/outputs/${id}`,
  },
  {
    key: 'magId',
    label: 'Microsoft Academic (legacy)',
    buildUrl: () => null,
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single external identifier row.
 */
function ExternalIdRow({
  label,
  value,
  url,
}: {
  label: string;
  value: string;
  url: string | null;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card min-h-[44px]">
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <span className="text-sm font-medium shrink-0">{label}</span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1 min-w-0 min-h-[44px] sm:min-h-0"
          >
            <span className="truncate font-mono">{value}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <span className="text-sm text-muted-foreground font-mono truncate">{value}</span>
        )}
      </div>
    </div>
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
          return <ExternalIdRow key={config.key} label={config.label} value={value} url={url} />;
        })}
      </CardContent>
    </Card>
  );
}
