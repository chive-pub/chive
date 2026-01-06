'use client';

import { notFound } from 'next/navigation';

import {
  FieldBreadcrumb,
  FieldBreadcrumbSkeleton,
  FieldChildren,
  FieldRelationships,
  FieldRelationshipsSkeleton,
  FieldExternalIds,
  FieldExternalIdsSkeleton,
  FieldPreprints,
  FieldPreprintsSkeleton,
} from '@/components/knowledge-graph';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useField } from '@/lib/hooks/use-field';
import { formatCompactNumber } from '@/lib/utils/format-number';

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
 * relationships, external IDs, and preprints.
 *
 * @param props - Component props
 * @returns React element with field detail content
 */
export function FieldDetailContent({ fieldId }: FieldDetailContentProps) {
  const {
    data: field,
    isLoading,
    error,
  } = useField(fieldId, {
    includeRelationships: true,
    includeChildren: true,
    includeAncestors: true,
  });

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

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <FieldBreadcrumb field={field} />

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{field.name}</h1>
            {field.description && (
              <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{field.description}</p>
            )}
          </div>
          <FieldStatusBadge status={field.status} />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          {field.preprintCount !== undefined && (
            <div>
              <span className="font-semibold">{formatCompactNumber(field.preprintCount)}</span>{' '}
              <span className="text-muted-foreground">preprints</span>
            </div>
          )}
          {field.children && field.children.length > 0 && (
            <div>
              <span className="font-semibold">{field.children.length}</span>{' '}
              <span className="text-muted-foreground">subfields</span>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="space-y-8">
          {/* Preprints section */}
          <section>
            <h2 className="mb-6 text-2xl font-semibold">Preprints</h2>
            <FieldPreprints fieldId={fieldId} layout="list" />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Subfields */}
          {field.children && field.children.length > 0 && (
            <FieldChildren fields={field.children} maxVisible={10} />
          )}

          <Separator />

          {/* Relationships */}
          {field.relationships && field.relationships.length > 0 && (
            <>
              <FieldRelationships relationships={field.relationships} />
              <Separator />
            </>
          )}

          {/* External IDs */}
          {field.externalIds && field.externalIds.length > 0 && (
            <FieldExternalIds externalIds={field.externalIds} />
          )}
        </aside>
      </div>
    </div>
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
    under_review: { label: 'Under Review', variant: 'secondary' },
    approved: { label: 'Approved', variant: 'default' },
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
      <FieldBreadcrumbSkeleton />

      {/* Header skeleton */}
      <header className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-6 w-96 animate-pulse rounded bg-muted" />
        <div className="flex gap-6">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <FieldPreprintsSkeleton count={5} />
        </div>
        <aside className="space-y-6">
          <FieldRelationshipsSkeleton />
          <Separator />
          <FieldExternalIdsSkeleton />
        </aside>
      </div>
    </div>
  );
}
