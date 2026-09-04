'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, Quote, BookMarked, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useCitations } from '@/lib/hooks/use-discovery';
import { paperLabelParts, papersByUri, type CitedPaper } from '@/lib/citations/paper-label';
import type { CitationRelationship } from '@/lib/api/schema';

/**
 * Props for CitationSummary component.
 */
export interface CitationSummaryProps {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** Initial collapsed state */
  defaultOpen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Collapsible citation network summary.
 *
 * @remarks
 * Shows citation counts and top citing/cited papers.
 * Full interactive graph visualization deferred to future iteration.
 *
 * @example
 * ```tsx
 * <CitationSummary eprintUri="at://did:plc:abc/pub.chive.eprint/123" />
 * ```
 */
export function CitationSummary({
  eprintUri,
  defaultOpen = false,
  className,
}: CitationSummaryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { data, isLoading, isError } = useCitations(eprintUri, {
    enabled: defaultOpen || isOpen, // Fetch immediately when defaultOpen
  });

  if (isError) {
    return null; // Silently fail - citations are optional enrichment
  }

  const content = (
    <div className="space-y-4">
      {isLoading ? (
        <CitationListSkeleton />
      ) : data && data.citations.length > 0 ? (
        <>
          {/* Citing papers */}
          <CitationSection
            title="Cited by"
            icon={<BookMarked className="h-4 w-4" />}
            citations={data.citations.filter((c) => c.citedUri === eprintUri)}
            total={data.counts.citedByCount}
            papers={data.papers}
            eprintUri={eprintUri}
            direction="citing"
          />

          {/* Referenced papers */}
          <CitationSection
            title="References"
            icon={<Quote className="h-4 w-4" />}
            citations={data.citations.filter((c) => c.citingUri === eprintUri)}
            total={data.counts.referencesCount}
            papers={data.papers}
            eprintUri={eprintUri}
            direction="cited"
          />

          {/* Every citation is listed above, so this is a route to the
              dedicated view rather than to anything withheld here. The URI is
              one encoded segment after `/eprints/citations/`, because a Next.js
              catch-all has to be the last part of a route. */}
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/eprints/citations/${encodeURIComponent(eprintUri)}`}>
              Open the citation network
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-4">
          No citation data available yet.
        </p>
      )}
    </div>
  );

  // When defaultOpen, render expanded without collapsible wrapper
  if (defaultOpen) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Quote className="h-5 w-5" />
            Citation Network
            {!isLoading && data && (
              <span className="text-sm font-normal text-muted-foreground">
                {data.counts.citedByCount} citations &middot; {data.counts.referencesCount}{' '}
                references
                {data.counts.influentialCitedByCount > 0 && (
                  <span className="ml-1">
                    <Star className="inline h-3 w-3" /> {data.counts.influentialCitedByCount}{' '}
                    influential
                  </span>
                )}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="flex w-full items-center justify-between p-6 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <Quote className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">Citation Network</div>
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : data ? (
                <div className="text-sm text-muted-foreground">
                  {data.counts.citedByCount} citations &middot; {data.counts.referencesCount}{' '}
                  references
                  {data.counts.influentialCitedByCount > 0 && (
                    <span className="ml-1">
                      <Star className="inline h-3 w-3" /> {data.counts.influentialCitedByCount}{' '}
                      influential
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">View citation data</div>
              )}
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t px-4 py-4">{content}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface CitationSectionProps {
  title: string;
  icon: React.ReactNode;
  citations: CitationRelationship[];
  /** How many exist, as opposed to how many were fetched for this list. */
  total?: number;
  /** The papers the response named, for labelling each row. */
  papers?: readonly CitedPaper[];
  eprintUri: string;
  direction: 'citing' | 'cited';
}

function CitationSection({
  title,
  icon,
  citations,
  total,
  papers,
  direction,
}: CitationSectionProps) {
  const byUri = papersByUri(papers);
  if (citations.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {/* The true count, not how many were fetched. The list is capped at
            five, so showing its length beside a header reading "11 references"
            said two different things about the same paper. */}
        {title} ({total ?? citations.length})
      </div>
      <ul className="space-y-2">
        {citations.map((citation) => {
          const targetUri = direction === 'citing' ? citation.citingUri : citation.citedUri;
          return (
            <li key={`${citation.citingUri}-${citation.citedUri}`}>
              <Link
                href={`/eprints/${encodeURIComponent(targetUri)}`}
                className="group flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="group-hover:underline">
                    <PaperCitation paper={byUri.get(targetUri)} fallback={targetUri} />
                  </span>
                  {citation.isInfluential && (
                    <Star className="ml-1 inline h-3 w-3 text-amber-500" />
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Names a cited paper in a list row.
 *
 * @remarks
 * The graph next door draws the same citation as a plain string, so the shared
 * formatting lives in `paper-label`. What a list row can do that a graph node
 * cannot is set the title apart from the byline, which is the whole reason this
 * renders the two halves rather than calling `paperLabel`.
 *
 * A paper the response did not name falls back to its URI, which is not a title
 * and so is not italicised.
 */
function PaperCitation({ paper, fallback }: { paper: CitedPaper | undefined; fallback: string }) {
  if (!paper) {
    return <>{fallback}</>;
  }

  const { byline, title } = paperLabelParts(paper);

  return (
    <>
      {byline ? <>{byline}. </> : null}
      <em>{title}</em>
    </>
  );
}

function CitationListSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="mb-2 h-4 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div>
        <Skeleton className="mb-2 h-4 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for CitationSummary.
 */
export function CitationSummarySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5" />
        <div>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  );
}
