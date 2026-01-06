'use client';

import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type ExternalIdSource = 'semantic-scholar' | 'openalex';

export interface ExternalIdBadgeProps {
  source: ExternalIdSource;
  id: string;
  className?: string;
}

const SOURCE_CONFIG: Record<
  ExternalIdSource,
  {
    label: string;
    shortLabel: string;
    buildUrl: (id: string) => string;
    color: string;
  }
> = {
  'semantic-scholar': {
    label: 'Semantic Scholar',
    shortLabel: 'S2',
    buildUrl: (id) => `https://www.semanticscholar.org/paper/${id}`,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  openalex: {
    label: 'OpenAlex',
    shortLabel: 'OA',
    buildUrl: (id) => `https://openalex.org/works/${id}`,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
};

/**
 * Badge linking to external academic databases.
 *
 * @remarks
 * Displays a compact badge that links to Semantic Scholar or OpenAlex.
 * Shows abbreviated source name with tooltip showing full ID.
 *
 * @example
 * ```tsx
 * <ExternalIdBadge source="semantic-scholar" id="abc123..." />
 * <ExternalIdBadge source="openalex" id="W1234567" />
 * ```
 */
export function ExternalIdBadge({ source, id, className }: ExternalIdBadgeProps) {
  const config = SOURCE_CONFIG[source];
  const url = config.buildUrl(id);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 ${className ?? ''}`}
          >
            <Badge variant="secondary" className={`text-xs ${config.color}`}>
              {config.shortLabel}
              <ExternalLink className="h-3 w-3 ml-0.5" />
            </Badge>
          </a>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            View on {config.label}
            <br />
            <span className="text-muted-foreground font-mono text-[10px]">{id}</span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
