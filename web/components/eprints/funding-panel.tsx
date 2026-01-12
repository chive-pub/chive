'use client';

/**
 * Funding sources panel for eprint pages.
 *
 * @remarks
 * Displays funding acknowledgments with funder names and grant numbers.
 *
 * @packageDocumentation
 */

import { DollarSign, Building2, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Funding source information.
 */
export interface FundingSource {
  /** Funder name */
  funderName: string;
  /** CrossRef Funder Registry DOI */
  funderDoi?: string;
  /** ROR identifier */
  funderRor?: string;
  /** Grant number */
  grantNumber?: string;
  /** Grant title */
  grantTitle?: string;
  /** Grant URL */
  grantUrl?: string;
}

/**
 * Props for FundingPanel component.
 */
export interface FundingPanelProps {
  /** List of funding sources */
  funding: FundingSource[];
  /** Display variant */
  variant?: 'card' | 'list' | 'inline';
  /** Additional class names */
  className?: string;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single funding source item.
 */
function FundingSourceItem({ source }: { source: FundingSource }) {
  const funderUrl = source.funderDoi
    ? `https://doi.org/${source.funderDoi}`
    : source.funderRor
      ? `https://ror.org/${source.funderRor}`
      : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="shrink-0 mt-0.5 text-green-600">
        <DollarSign className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {funderUrl ? (
            <a
              href={funderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline flex items-center gap-1"
            >
              {source.funderName}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="font-medium">{source.funderName}</span>
          )}
        </div>
        {source.grantNumber && (
          <p className="text-sm text-muted-foreground mt-1">
            Grant: <span className="font-mono">{source.grantNumber}</span>
          </p>
        )}
        {source.grantTitle && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{source.grantTitle}</p>
        )}
      </div>
      {source.grantUrl && (
        <a
          href={source.grantUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="sr-only">View grant</span>
        </a>
      )}
    </div>
  );
}

/**
 * Funding sources panel component.
 *
 * @param props - Component props
 * @returns Funding panel element
 */
export function FundingPanel({ funding, variant = 'card', className }: FundingPanelProps) {
  if (funding.length === 0) {
    return null;
  }

  // Inline variant - compact badges
  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {funding.map((source, index) => (
          <Badge key={index} variant="outline" className="gap-1">
            <DollarSign className="h-3 w-3" />
            {source.funderName}
            {source.grantNumber && (
              <span className="font-mono text-xs">({source.grantNumber})</span>
            )}
          </Badge>
        ))}
      </div>
    );
  }

  // List variant - simple list without card wrapper
  if (variant === 'list') {
    return (
      <div className={cn('space-y-2', className)}>
        <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          Funding ({funding.length})
        </h4>
        <div className="space-y-2">
          {funding.map((source, index) => (
            <FundingSourceItem key={index} source={source} />
          ))}
        </div>
      </div>
    );
  }

  // Card variant - full card display
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Funding
          <Badge variant="secondary" className="ml-1">
            {funding.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {funding.map((source, index) => (
          <FundingSourceItem key={index} source={source} />
        ))}
      </CardContent>
    </Card>
  );
}
