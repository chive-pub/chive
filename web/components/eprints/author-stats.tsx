import { FileText, Eye, Download, ThumbsUp, Award } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/utils/format-number';
import type { AuthorMetrics } from '@/lib/api/schema';

/**
 * Props for the AuthorStats component.
 */
export interface AuthorStatsProps {
  /** Author metrics data */
  metrics: AuthorMetrics;
  /** Display variant */
  variant?: 'cards' | 'inline';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays author statistics and metrics.
 *
 * @remarks
 * Server component that renders author metrics in either
 * card grid or inline format.
 *
 * @example
 * ```tsx
 * <AuthorStats metrics={authorMetrics} variant="cards" />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the author stats
 */
export function AuthorStats({ metrics, variant = 'cards', className }: AuthorStatsProps) {
  if (variant === 'inline') {
    return <AuthorStatsInline metrics={metrics} className={className} />;
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      <StatCard
        icon={<FileText className="h-5 w-5" />}
        label="Eprints"
        value={metrics.totalEprints}
        description="Published eprints"
      />
      <StatCard
        icon={<Eye className="h-5 w-5" />}
        label="Views"
        value={metrics.totalViews}
        description="Total views"
      />
      <StatCard
        icon={<Download className="h-5 w-5" />}
        label="Downloads"
        value={metrics.totalDownloads}
        description="Total downloads"
      />
      <StatCard
        icon={<ThumbsUp className="h-5 w-5" />}
        label="Endorsements"
        value={metrics.totalEndorsements}
        description="Total endorsements"
      />
      {metrics.hIndex !== undefined && (
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="h-index"
          value={metrics.hIndex}
          description="Citation impact"
        />
      )}
    </div>
  );
}

/**
 * Props for the StatCard component.
 */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  description?: string;
}

/**
 * Single stat card component.
 */
function StatCard({ icon, label, value, description: _description }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{formatCompactNumber(value)}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Props for the AuthorStatsInline component.
 */
interface AuthorStatsInlineProps {
  metrics: AuthorMetrics;
  className?: string;
}

/**
 * Inline variant of author stats.
 */
function AuthorStatsInline({ metrics, className }: AuthorStatsInlineProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4 text-sm', className)}>
      <InlineStat
        icon={<FileText className="h-4 w-4" />}
        value={metrics.totalEprints}
        label="eprints"
      />
      <InlineStat icon={<Eye className="h-4 w-4" />} value={metrics.totalViews} label="views" />
      <InlineStat
        icon={<Download className="h-4 w-4" />}
        value={metrics.totalDownloads}
        label="downloads"
      />
      <InlineStat
        icon={<ThumbsUp className="h-4 w-4" />}
        value={metrics.totalEndorsements}
        label="endorsements"
      />
      {metrics.hIndex !== undefined && (
        <InlineStat icon={<Award className="h-4 w-4" />} value={metrics.hIndex} label="h-index" />
      )}
    </div>
  );
}

/**
 * Single inline stat item.
 */
function InlineStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-1 text-muted-foreground"
      title={`${value.toLocaleString()} ${label}`}
    >
      {icon}
      <span className="font-medium text-foreground">{formatCompactNumber(value)}</span>
      <span>{label}</span>
    </div>
  );
}

/**
 * Props for the AuthorStatsSkeleton component.
 */
export interface AuthorStatsSkeletonProps {
  /** Display variant */
  variant?: 'cards' | 'inline';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the AuthorStats component.
 */
export function AuthorStatsSkeleton({ variant = 'cards', className }: AuthorStatsSkeletonProps) {
  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap items-center gap-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-5 w-24 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
            <div>
              <div className="h-7 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
