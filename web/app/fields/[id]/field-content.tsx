'use client';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Link2, ExternalLink, FolderTree } from 'lucide-react';

import {
  FieldExternalIds,
  FieldExternalIdsSkeleton,
  FieldEprints,
  FieldEprintsSkeleton,
} from '@/components/knowledge-graph';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFieldWithRelations, type RelatedField } from '@/lib/hooks/use-field';

/**
 * Props for the FieldDetailContent component.
 */
export interface FieldDetailContentProps {
  /** Field ID */
  fieldId: string;
}

/**
 * Client-side field detail content.
 *
 * @remarks
 * Fetches and displays field details including hierarchy,
 * relationships, external IDs, and eprints.
 *
 * @param props - Component props
 * @returns React element with field detail content
 */
export function FieldDetailContent({ fieldId }: FieldDetailContentProps) {
  const { data: field, isLoading, error } = useFieldWithRelations(fieldId);

  if (isLoading) {
    return <FieldDetailLoadingSkeleton />;
  }

  if (error) {
    if (error.message.includes('not found') || error.message.includes('404')) {
      notFound();
    }

    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <h2 className="text-lg font-semibold text-destructive">Failed to load field</h2>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (!field) {
    notFound();
  }

  const hasParents = field.parents.length > 0;
  const hasChildren = field.children.length > 0;
  const hasRelated = field.related.length > 0;
  const hasRelationships = hasParents || hasChildren || hasRelated;

  return (
    <div className="space-y-8">
      {/* Breadcrumb - show parent hierarchy */}
      {hasParents && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/fields" className="hover:text-primary">
            Fields
          </Link>
          {field.parents.map((parent) => (
            <span key={parent.id} className="flex items-center gap-2">
              <span>/</span>
              <Link
                href={`/fields/${encodeURIComponent(parent.id)}`}
                className="hover:text-primary"
              >
                {parent.label}
              </Link>
            </span>
          ))}
          <span>/</span>
          <span className="font-medium text-foreground">{field.label}</span>
        </nav>
      )}

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{field.label}</h1>
            {field.description && (
              <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{field.description}</p>
            )}
          </div>
          <FieldStatusBadge status={field.status} />
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {hasParents && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUp className="h-4 w-4" />
              <span>
                {field.parents.length} parent{field.parents.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {hasChildren && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowDown className="h-4 w-4" />
              <span>
                {field.children.length} subfield{field.children.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {hasRelated && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Link2 className="h-4 w-4" />
              <span>{field.related.length} related</span>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main content */}
        <div className="space-y-8">
          {/* Eprints section */}
          <section>
            <h2 className="mb-6 text-2xl font-semibold">Eprints in {field.label}</h2>
            <FieldEprints fieldId={fieldId} layout="list" />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Relationships Card */}
          {hasRelationships && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderTree className="h-5 w-5" />
                  Field Relationships
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Parent fields (broader) */}
                {hasParents && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ArrowUp className="h-3.5 w-3.5" />
                      Parent Fields
                    </h4>
                    <RelatedFieldList fields={field.parents} />
                  </div>
                )}

                {/* Child fields (narrower) */}
                {hasChildren && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ArrowDown className="h-3.5 w-3.5" />
                      Subfields
                    </h4>
                    <RelatedFieldList fields={field.children} />
                  </div>
                )}

                {/* Related fields */}
                {hasRelated && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" />
                      Related Fields
                    </h4>
                    <RelatedFieldList fields={field.related} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* External IDs */}
          {field.externalIds && field.externalIds.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  External Identifiers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FieldExternalIds externalIds={field.externalIds} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * List of related fields.
 */
function RelatedFieldList({ fields }: { fields: RelatedField[] }) {
  return (
    <ul className="space-y-1">
      {fields.map((f) => (
        <li key={f.id}>
          <Link
            href={`/fields/${encodeURIComponent(f.id)}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <FolderTree className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{f.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Status badge for field approval status.
 */
function FieldStatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
  > = {
    proposed: { label: 'Proposed', variant: 'outline' },
    provisional: { label: 'Provisional', variant: 'secondary' },
    established: { label: 'Established', variant: 'default' },
    deprecated: { label: 'Deprecated', variant: 'destructive' },
  };

  const config = variants[status] ?? { label: status, variant: 'outline' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

/**
 * Full loading skeleton for the field detail page.
 */
function FieldDetailLoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>

      {/* Header skeleton */}
      <header className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-6 w-96 animate-pulse rounded bg-muted" />
        <div className="flex gap-6">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <FieldEprintsSkeleton count={5} />
        </div>
        <aside className="space-y-6">
          {/* Relationships skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-8 w-full animate-pulse rounded bg-muted" />
                <div className="h-8 w-full animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
          {/* External IDs skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <FieldExternalIdsSkeleton />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
