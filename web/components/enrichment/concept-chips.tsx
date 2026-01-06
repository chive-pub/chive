'use client';

import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EnrichmentConcept } from '@/lib/api/schema';

export interface ConceptChipsProps {
  concepts: EnrichmentConcept[];
  /** Maximum number of concepts to display */
  limit?: number;
  className?: string;
}

/**
 * Builds a Wikidata URL from a QID.
 */
function buildWikidataUrl(wikidataId: string): string {
  // Ensure the ID starts with Q
  const qid = wikidataId.startsWith('Q') ? wikidataId : `Q${wikidataId}`;
  return `https://www.wikidata.org/wiki/${qid}`;
}

/**
 * Displays Semantic Scholar concepts with Wikidata links.
 *
 * @remarks
 * Concepts are linked to Wikidata entities when available.
 * Shows concept relevance score in tooltip.
 *
 * @example
 * ```tsx
 * <ConceptChips concepts={enrichment.concepts} limit={8} />
 * ```
 */
export function ConceptChips({ concepts, limit = 8, className }: ConceptChipsProps) {
  const displayedConcepts = concepts.slice(0, limit);
  const remainingCount = concepts.length - limit;

  if (concepts.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
      <TooltipProvider>
        {displayedConcepts.map((concept) => (
          <ConceptBadge key={concept.id} concept={concept} />
        ))}
        {remainingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{remainingCount} more
          </Badge>
        )}
      </TooltipProvider>
    </div>
  );
}

/**
 * Individual concept badge with optional Wikidata link.
 */
function ConceptBadge({ concept }: { concept: EnrichmentConcept }) {
  const hasWikidata = !!concept.wikidataId;
  const url = hasWikidata ? buildWikidataUrl(concept.wikidataId!) : null;
  const scorePercent = concept.score ? Math.round(concept.score * 100) : null;

  const badge = (
    <Badge
      variant="outline"
      className={`text-xs ${hasWikidata ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'} transition-colors`}
    >
      {concept.displayName}
      {hasWikidata && <ExternalLink className="h-2.5 w-2.5 ml-1" />}
    </Badge>
  );

  const content = url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {badge}
    </a>
  ) : (
    badge
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs">
          <p className="font-medium">{concept.displayName}</p>
          {scorePercent !== null && (
            <p className="text-muted-foreground">Relevance: {scorePercent}%</p>
          )}
          {hasWikidata && (
            <p className="text-muted-foreground font-mono text-[10px]">{concept.wikidataId}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
