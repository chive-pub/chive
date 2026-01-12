import { Eye, Download, ThumbsUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/utils/format-number';
import type { EprintMetrics as EprintMetricsType } from '@/lib/api/schema';

/**
 * Props for the EprintMetrics component.
 */
export interface EprintMetricsProps {
  /** Metrics data */
  metrics?: EprintMetricsType;
  /** Display size */
  size?: 'sm' | 'default' | 'lg';
  /** Whether to show all metrics or just primary ones */
  showAll?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays eprint engagement metrics (views, downloads, endorsements).
 *
 * @remarks
 * Server component that renders formatted metric counts with icons.
 * Uses compact number formatting for large values.
 *
 * @example
 * ```tsx
 * <EprintMetrics
 *   metrics={{ views: 1234, downloads: 567, endorsements: 42 }}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the metrics
 */
export function EprintMetrics({
  metrics,
  size = 'default',
  showAll = false,
  className,
}: EprintMetricsProps) {
  if (!metrics) {
    return null;
  }

  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
  const gap = size === 'sm' ? 'gap-2' : size === 'lg' ? 'gap-4' : 'gap-3';

  return (
    <div className={cn('flex items-center text-muted-foreground', gap, textSize, className)}>
      <MetricItem
        icon={<Eye className={iconSize} />}
        value={metrics.views}
        label="views"
        size={size}
      />
      <MetricItem
        icon={<Download className={iconSize} />}
        value={metrics.downloads}
        label="downloads"
        size={size}
      />
      {(showAll || (metrics.endorsements && metrics.endorsements > 0)) && (
        <MetricItem
          icon={<ThumbsUp className={iconSize} />}
          value={metrics.endorsements ?? 0}
          label="endorsements"
          size={size}
        />
      )}
    </div>
  );
}

interface MetricItemProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  size?: 'sm' | 'default' | 'lg';
}

function MetricItem({ icon, value, label, size = 'default' }: MetricItemProps) {
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1';

  return (
    <div className={cn('flex items-center', gap)} title={`${value.toLocaleString()} ${label}`}>
      {icon}
      <span>{formatCompactNumber(value)}</span>
    </div>
  );
}

/**
 * Props for the MetricCard component.
 */
export interface MetricCardProps {
  /** Metric label */
  label: string;
  /** Metric value */
  value: number;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a single metric as a card with label and value.
 *
 * @example
 * ```tsx
 * <MetricCard label="Total Views" value={12345} icon={<Eye />} />
 * ```
 */
export function MetricCard({ label, value, icon, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border bg-card p-4 text-center',
        className
      )}
    >
      {icon && <div className="mb-2 text-muted-foreground">{icon}</div>}
      <span className="text-2xl font-bold">{formatCompactNumber(value)}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
