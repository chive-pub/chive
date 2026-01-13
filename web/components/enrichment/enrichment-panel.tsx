'use client';

import { Sparkles, BookOpen, Quote, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnrichment } from '@/lib/hooks/use-discovery';

import { ExternalIdBadge } from './external-id-badge';
import { TopicChips } from './topic-chips';
import { ConceptChips } from './concept-chips';

export interface EnrichmentPanelProps {
  eprintUri: string;
  className?: string;
}

/**
 * Skeleton loader for enrichment panel.
 */
export function EnrichmentPanelSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          External Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1.5 flex-wrap">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Displays enrichment data from Semantic Scholar and OpenAlex.
 *
 * @remarks
 * Shows external IDs, citation metrics, topics (OpenAlex), and concepts (S2).
 * Gracefully handles missing data - hides sections without data.
 *
 * @example
 * ```tsx
 * <EnrichmentPanel eprintUri="at://did:plc:abc/pub.chive.eprint/123" />
 * ```
 */
export function EnrichmentPanel({ eprintUri, className }: EnrichmentPanelProps) {
  const { data, isLoading, isError } = useEnrichment(eprintUri);

  if (isLoading) {
    return <EnrichmentPanelSkeleton className={className} />;
  }

  if (isError || !data?.available || !data.enrichment) {
    return null;
  }

  const enrichment = data.enrichment;
  const hasExternalIds = enrichment.semanticScholarId || enrichment.openAlexId;
  const hasCitations =
    enrichment.citationCount !== undefined || enrichment.referencesCount !== undefined;
  const hasTopics = enrichment.topics && enrichment.topics.length > 0;
  const hasConcepts = enrichment.concepts && enrichment.concepts.length > 0;

  // Don't render if no data
  if (!hasExternalIds && !hasCitations && !hasTopics && !hasConcepts) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          External Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* External IDs */}
        {hasExternalIds && (
          <div className="flex flex-wrap gap-2">
            {enrichment.semanticScholarId && (
              <ExternalIdBadge source="semantic-scholar" id={enrichment.semanticScholarId} />
            )}
            {enrichment.openAlexId && (
              <ExternalIdBadge source="openalex" id={enrichment.openAlexId} />
            )}
          </div>
        )}

        {/* Citation Metrics */}
        {hasCitations && (
          <div className="flex flex-wrap gap-4 text-sm">
            {enrichment.citationCount !== undefined && (
              <div className="flex items-center gap-1.5">
                <Quote className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{enrichment.citationCount.toLocaleString()}</span>
                <span className="text-muted-foreground">citations</span>
                {enrichment.influentialCitationCount !== undefined &&
                  enrichment.influentialCitationCount > 0 && (
                    <span className="text-muted-foreground">
                      ({enrichment.influentialCitationCount} influential)
                    </span>
                  )}
              </div>
            )}
            {enrichment.referencesCount !== undefined && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{enrichment.referencesCount.toLocaleString()}</span>
                <span className="text-muted-foreground">references</span>
              </div>
            )}
          </div>
        )}

        {/* Topics from OpenAlex */}
        {hasTopics && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Topics</span>
            </div>
            <TopicChips topics={enrichment.topics!} limit={5} />
          </div>
        )}

        {/* Concepts from Semantic Scholar */}
        {hasConcepts && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Concepts</span>
            </div>
            <ConceptChips concepts={enrichment.concepts!} limit={8} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
