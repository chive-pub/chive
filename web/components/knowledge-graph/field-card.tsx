import Link from 'next/link';
import { FolderTree, FileText, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/utils/format-number';
import type { FieldSummary } from '@/lib/api/schema';

/**
 * Props for the FieldCard component.
 */
export interface FieldCardProps {
  /** Field data */
  field: FieldSummary;
  /** Display variant */
  variant?: 'default' | 'compact' | 'featured';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a field as a summary card.
 */
export function FieldCard({ field, variant = 'default', className }: FieldCardProps) {
  const fieldUrl = `/fields/${encodeURIComponent(field.id)}`;

  if (variant === 'compact') {
    return <CompactFieldCard field={field} className={className} />;
  }

  if (variant === 'featured') {
    return <FeaturedFieldCard field={field} className={className} />;
  }

  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link
            href={fieldUrl}
            className="flex items-center gap-2 font-semibold hover:text-primary hover:underline"
          >
            <FolderTree className="h-4 w-4 text-muted-foreground" />
            {field.label}
          </Link>
          <FieldStatusBadge status={field.status} />
        </div>
      </CardHeader>
      <CardContent>
        {field.description && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{field.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1" title={`${field.eprintCount ?? 0} eprints`}>
            <FileText className="h-4 w-4" />
            <span>{formatCompactNumber(field.eprintCount ?? 0)}</span>
          </div>
          {(field.childCount ?? 0) > 0 && (
            <div className="flex items-center gap-1" title={`${field.childCount} subfields`}>
              <FolderTree className="h-4 w-4" />
              <span>{field.childCount} subfields</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact variant of the field card.
 */
function CompactFieldCard({ field, className }: { field: FieldSummary; className?: string }) {
  const fieldUrl = `/fields/${encodeURIComponent(field.id)}`;

  return (
    <Link
      href={fieldUrl}
      className={cn(
        'flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <FolderTree className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{field.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {formatCompactNumber(field.eprintCount ?? 0)} eprints
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

/**
 * Featured variant of the field card.
 */
function FeaturedFieldCard({ field, className }: { field: FieldSummary; className?: string }) {
  const fieldUrl = `/fields/${encodeURIComponent(field.id)}`;

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader>
        <Link
          href={fieldUrl}
          className="flex items-center gap-2 text-xl font-semibold hover:text-primary hover:underline"
        >
          <FolderTree className="h-5 w-5" />
          {field.label}
        </Link>
        <FieldStatusBadge status={field.status} />
      </CardHeader>
      <CardContent>
        {field.description && <p className="mb-4 text-muted-foreground">{field.description}</p>}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{formatCompactNumber(field.eprintCount ?? 0)}</div>
            <div className="text-sm text-muted-foreground">Eprints</div>
          </div>
          {field.childCount !== undefined && (
            <div className="text-center">
              <div className="text-2xl font-bold">{field.childCount}</div>
              <div className="text-sm text-muted-foreground">Subfields</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Props for the FieldStatusBadge component.
 */
interface FieldStatusBadgeProps {
  status: string;
}

/**
 * Badge showing field approval status.
 */
function FieldStatusBadge({ status }: FieldStatusBadgeProps) {
  const variants: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
  > = {
    proposed: { label: 'Proposed', variant: 'outline' },
    provisional: { label: 'Provisional', variant: 'secondary' },
    established: { label: 'Established', variant: 'default' },
    deprecated: { label: 'Deprecated', variant: 'destructive' },
  };

  const { label, variant } = variants[status] ?? { label: status, variant: 'secondary' as const };

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
}

/**
 * Props for the FieldCardSkeleton component.
 */
export interface FieldCardSkeletonProps {
  /** Display variant */
  variant?: 'default' | 'compact';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the FieldCard component.
 */
export function FieldCardSkeleton({ variant = 'default', className }: FieldCardSkeletonProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-between rounded-lg border p-3', className)}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded bg-muted" />
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
