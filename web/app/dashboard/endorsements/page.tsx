'use client';

import Link from 'next/link';
import { ThumbsUp, FileText, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/lib/auth';
import {
  useMyEndorsements,
  CONTRIBUTION_TYPE_LABELS,
  type EndorsementWithEprint,
} from '@/lib/hooks/use-endorsement';

/**
 * Formats a contribution type for display.
 */
function formatContribution(type: string): string {
  return CONTRIBUTION_TYPE_LABELS[type] ?? type;
}

/**
 * Formats a date for display.
 */
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Extracts the eprint path from an AT-URI.
 */
function getEprintPath(uri: string): string {
  // AT-URI format: at://did:plc:xxx/collection/rkey
  // URL path requires encoding due to :// in the URI
  return `/eprints/${encodeURIComponent(uri)}`;
}

/**
 * Single endorsement card component.
 */
function EndorsementCard({ endorsement }: { endorsement: EndorsementWithEprint }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              href={getEprintPath(endorsement.eprintUri)}
              className="font-medium hover:underline line-clamp-2"
            >
              {endorsement.eprintTitle ?? 'Untitled eprint'}
            </Link>
          </div>
          <Link
            href={getEprintPath(endorsement.eprintUri)}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {endorsement.contributions.map((type) => (
            <Badge key={type} variant="secondary" className="text-xs">
              {formatContribution(type)}
            </Badge>
          ))}
        </div>
        {endorsement.comment && (
          <p className="text-sm text-muted-foreground line-clamp-2">{endorsement.comment}</p>
        )}
        <p className="text-xs text-muted-foreground">{formatDate(endorsement.createdAt)}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for endorsement list.
 */
function EndorsementListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Empty state when user has no endorsements.
 */
function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed p-12 text-center">
      <ThumbsUp className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">No endorsements yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Endorsements you give to eprints will appear here
      </p>
      <Link
        href="/browse"
        className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <FileText className="h-4 w-4" />
        Browse eprints to endorse
      </Link>
    </div>
  );
}

/**
 * User's endorsements page.
 */
export default function MyEndorsementsPage() {
  const currentUser = useCurrentUser();
  const { data, isLoading, error } = useMyEndorsements(currentUser?.did ?? '', {
    enabled: !!currentUser?.did,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Endorsements</h1>
        <p className="text-muted-foreground">
          Endorsements you have given
          {data?.total !== undefined && data.total > 0 && ` (${data.total})`}
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <EndorsementListSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <h3 className="font-semibold text-destructive">Failed to load endorsements</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      ) : !data?.endorsements?.length ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {data.endorsements.map((endorsement) => (
            <EndorsementCard key={endorsement.uri} endorsement={endorsement} />
          ))}
        </div>
      )}
    </div>
  );
}
