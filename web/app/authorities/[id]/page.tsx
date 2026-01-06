'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  User,
  Building,
  Lightbulb,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';

import {
  useAuthority,
  useAuthorityReconciliations,
  AUTHORITY_TYPE_LABELS,
  AUTHORITY_STATUS_LABELS,
  EXTERNAL_SYSTEM_LABELS,
  type AuthorityType,
  type AuthorityStatus,
} from '@/lib/hooks/use-authority';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

/**
 * Authority detail page.
 *
 * @remarks
 * Shows full authority record with external links and reconciliation evidence.
 */
export default function AuthorityDetailPage() {
  const params = useParams();
  const authorityId = params.id as string;

  const { data: authority, isLoading, error } = useAuthority(authorityId);
  const { data: reconciliations, isLoading: reconLoading } =
    useAuthorityReconciliations(authorityId);

  const getTypeIcon = (type: AuthorityType) => {
    switch (type) {
      case 'person':
        return User;
      case 'organization':
        return Building;
      case 'concept':
        return Lightbulb;
      case 'place':
        return MapPin;
      default:
        return User;
    }
  };

  const getStatusColor = (status: AuthorityStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'proposed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'deprecated':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
  };

  const getReconciliationStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return CheckCircle;
      case 'disputed':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  if (isLoading) {
    return <AuthorityDetailSkeleton />;
  }

  if (error || !authority) {
    return (
      <div className="container py-8 space-y-6">
        <Link
          href="/authorities"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to authorities
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Authority record not found</p>
        </div>
      </div>
    );
  }

  const TypeIcon = getTypeIcon(authority.type);

  return (
    <div className="container py-8 space-y-6">
      {/* Back link */}
      <Link
        href="/authorities"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to authorities
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-muted">
          <TypeIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{AUTHORITY_TYPE_LABELS[authority.type]}</Badge>
            <Badge className={getStatusColor(authority.status)}>
              {AUTHORITY_STATUS_LABELS[authority.status]}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">{authority.name}</h1>
          <p className="text-muted-foreground mt-1">
            {authority.linkedPreprints ?? 0} preprints • Created{' '}
            {new Date(authority.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {authority.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{authority.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Alternate Names */}
          {(authority.alternateNames ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Alternate Names</CardTitle>
                <CardDescription>Alternative names, synonyms, and abbreviations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(authority.alternateNames ?? []).map((form: string, i: number) => (
                    <Badge key={i} variant="secondary">
                      {form}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reconciliations */}
          <Card>
            <CardHeader>
              <CardTitle>Reconciliation Evidence</CardTitle>
              <CardDescription>How this record was matched to external sources</CardDescription>
            </CardHeader>
            <CardContent>
              {reconLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : reconciliations && reconciliations.length > 0 ? (
                <div className="space-y-4">
                  {reconciliations.map((recon) => {
                    const StatusIcon = getReconciliationStatusIcon(recon.status);
                    return (
                      <div key={recon.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {EXTERNAL_SYSTEM_LABELS[recon.externalSource] ??
                                  recon.externalSource}
                              </span>
                            </div>
                            <a
                              href={recon.externalUrl ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {recon.externalId}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <StatusIcon className="h-4 w-4" />
                            <span className="capitalize">{recon.status}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No reconciliation evidence available
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* External Sources */}
          <Card>
            <CardHeader>
              <CardTitle>External Sources</CardTitle>
            </CardHeader>
            <CardContent>
              {(authority.externalIds ?? []).length > 0 ? (
                <div className="space-y-3">
                  {(authority.externalIds ?? []).map(
                    (extId: { source: string; id: string; url?: string }, i: number) => (
                      <a
                        key={i}
                        href={extId.url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 rounded hover:bg-muted transition-colors"
                      >
                        <div>
                          <div className="font-medium text-sm">
                            {EXTERNAL_SYSTEM_LABELS[extId.source] ?? extId.source}
                          </div>
                          <div className="text-xs text-muted-foreground">{extId.id}</div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No external sources linked
                </p>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{AUTHORITY_TYPE_LABELS[authority.type]}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{AUTHORITY_STATUS_LABELS[authority.status]}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usage</span>
                <span>{authority.linkedPreprints ?? 0} preprints</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(authority.createdAt).toLocaleDateString()}</span>
              </div>
              {authority.updatedAt && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{new Date(authority.updatedAt).toLocaleDateString()}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton.
 */
function AuthorityDetailSkeleton() {
  return (
    <div className="container py-8 space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
