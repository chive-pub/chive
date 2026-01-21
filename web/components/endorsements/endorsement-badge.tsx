'use client';

/**
 * EndorsementBadge component for displaying endorsement counts by contribution type.
 *
 * @remarks
 * Displays a compact badge showing the count of endorsements for a specific
 * contribution type. Supports 15 fine-grained types derived from CRediT taxonomy.
 *
 * @example
 * ```tsx
 * <EndorsementBadge type="methodological" count={12} />
 * <EndorsementBadge type="empirical" count={8} showLabel />
 * ```
 *
 * @packageDocumentation
 */

import {
  FlaskConical,
  LineChart,
  Lightbulb,
  Database,
  Brain,
  Wrench,
  Table,
  Copy,
  RefreshCw,
  Layers,
  Network,
  GraduationCap,
  BarChart3,
  Globe,
  Stethoscope,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ContributionType, EndorsementSummary } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the EndorsementBadge component.
 */
export interface EndorsementBadgeProps {
  /** Contribution type */
  type: ContributionType;

  /** Number of endorsements */
  count: number;

  /** Whether to show the label text */
  showLabel?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Whether this is clickable (shows hover state) */
  interactive?: boolean;

  /** Click handler */
  onClick?: () => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

interface ContributionConfig {
  icon: LucideIcon;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
}

/**
 * Configuration for each contribution type.
 *
 * @remarks
 * Uses `Record<string, ContributionConfig>` to allow safe indexing with
 * open union types from the lexicon (`ContributionType | (string & {})`).
 */
const CONTRIBUTION_CONFIG: Record<string, ContributionConfig> = {
  // Core Research
  methodological: {
    icon: FlaskConical,
    label: 'Methodological',
    description: 'Novel methods, techniques, approaches',
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50',
  },
  analytical: {
    icon: LineChart,
    label: 'Analytical',
    description: 'Statistical, computational analysis',
    colorClass: 'text-purple-600 dark:text-purple-400',
    bgClass: 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50',
  },
  theoretical: {
    icon: Lightbulb,
    label: 'Theoretical',
    description: 'Theoretical framework, theory development',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50',
  },
  empirical: {
    icon: Database,
    label: 'Empirical',
    description: 'Data collection, experiments, fieldwork',
    colorClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50',
  },
  conceptual: {
    icon: Brain,
    label: 'Conceptual',
    description: 'Novel ideas, hypotheses, problem framing',
    colorClass: 'text-pink-600 dark:text-pink-400',
    bgClass: 'bg-pink-100 hover:bg-pink-200 dark:bg-pink-900/30 dark:hover:bg-pink-900/50',
  },

  // Technical
  technical: {
    icon: Wrench,
    label: 'Technical',
    description: 'Software, tools, infrastructure',
    colorClass: 'text-slate-600 dark:text-slate-400',
    bgClass: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/30 dark:hover:bg-slate-900/50',
  },
  data: {
    icon: Table,
    label: 'Data',
    description: 'Dataset creation, curation, availability',
    colorClass: 'text-cyan-600 dark:text-cyan-400',
    bgClass: 'bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50',
  },

  // Validation
  replication: {
    icon: Copy,
    label: 'Replication',
    description: 'Successful replication of prior work',
    colorClass: 'text-teal-600 dark:text-teal-400',
    bgClass: 'bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/30 dark:hover:bg-teal-900/50',
  },
  reproducibility: {
    icon: RefreshCw,
    label: 'Reproducibility',
    description: 'Reproducible workflow, open materials',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass:
      'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50',
  },

  // Synthesis
  synthesis: {
    icon: Layers,
    label: 'Synthesis',
    description: 'Literature review, meta-analysis',
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    bgClass: 'bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50',
  },
  interdisciplinary: {
    icon: Network,
    label: 'Interdisciplinary',
    description: 'Cross-disciplinary integration',
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-900/50',
  },

  // Communication
  pedagogical: {
    icon: GraduationCap,
    label: 'Pedagogical',
    description: 'Educational value, clarity',
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50',
  },
  visualization: {
    icon: BarChart3,
    label: 'Visualization',
    description: 'Figures, graphics, data presentation',
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50',
  },

  // Impact
  'societal-impact': {
    icon: Globe,
    label: 'Societal Impact',
    description: 'Real-world applications, policy',
    colorClass: 'text-sky-600 dark:text-sky-400',
    bgClass: 'bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/30 dark:hover:bg-sky-900/50',
  },
  clinical: {
    icon: Stethoscope,
    label: 'Clinical',
    description: 'Clinical relevance (medical/health)',
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50',
  },
};

/**
 * Default configuration for unknown contribution types.
 */
const DEFAULT_CONTRIBUTION_CONFIG: ContributionConfig = {
  icon: CircleDot,
  label: 'Other',
  description: 'Additional contribution type',
  colorClass: 'text-gray-600 dark:text-gray-400',
  bgClass: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-900/30 dark:hover:bg-gray-900/50',
};

/**
 * Gets the configuration for a contribution type with fallback for unknown types.
 */
function getContributionConfig(type: string): ContributionConfig {
  return (
    CONTRIBUTION_CONFIG[type] ?? {
      ...DEFAULT_CONTRIBUTION_CONFIG,
      label: type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' '),
    }
  );
}

/**
 * Size configurations.
 */
const SIZE_CONFIG = {
  sm: {
    badge: 'h-5 px-1.5 text-xs gap-1',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'h-6 px-2 text-sm gap-1.5',
    icon: 'h-3.5 w-3.5',
  },
  lg: {
    badge: 'h-8 px-3 text-base gap-2',
    icon: 'h-4 w-4',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays an endorsement count badge for a specific contribution type.
 *
 * @param props - Component props
 * @returns Endorsement badge element
 */
export function EndorsementBadge({
  type,
  count,
  showLabel = false,
  size = 'md',
  interactive = false,
  onClick,
  className,
}: EndorsementBadgeProps) {
  const config = getContributionConfig(type);
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        'inline-flex items-center font-medium',
        sizeConfig.badge,
        config.bgClass,
        config.colorClass,
        interactive && 'cursor-pointer transition-colors',
        className
      )}
      onClick={interactive ? onClick : undefined}
      data-testid={`endorsement-badge-${type}`}
    >
      <Icon className={sizeConfig.icon} aria-hidden="true" />
      <span className="tabular-nums">{count}</span>
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );

  // Wrap in tooltip if not showing label
  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * Structural type for endorsement summary that accepts both getSummary
 * and listForEprint response shapes (which differ in $type discriminators).
 *
 * @remarks
 * The `byType` property is typed as `object` to accept any object type,
 * including the generated `EndorsementCountByType` interfaces which have
 * different `$type` discriminator values but share the same runtime shape.
 */
export interface EndorsementSummaryInput {
  /** Total endorsement count */
  total: number;
  /** Unique endorser count */
  endorserCount: number;
  /** Counts by contribution type (open object with optional counts) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  byType: { $type?: string } | Record<string, any>;
}

/**
 * Displays endorsement badges based on summary data.
 */
export interface EndorsementBadgeGroupProps {
  /** Endorsement summary with counts by type */
  summary: EndorsementSummaryInput;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Whether to show labels */
  showLabels?: boolean;

  /** Maximum number of badges to show (others collapsed) */
  maxBadges?: number;

  /** Whether badges are interactive */
  interactive?: boolean;

  /** Click handler (receives type) */
  onBadgeClick?: (type: ContributionType) => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a group of endorsement badges from summary data.
 *
 * @param props - Component props
 * @returns Badge group element
 */
export function EndorsementBadgeGroup({
  summary,
  size = 'md',
  showLabels = false,
  maxBadges = 6,
  interactive = false,
  onBadgeClick,
  className,
}: EndorsementBadgeGroupProps) {
  // Get non-zero contribution types, sorted by count descending
  // Filter for numeric values > 0 (excludes $type and other non-numeric properties)
  const contributionEntries = Object.entries(summary.byType || {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .sort(([, a], [, b]) => b - a) as [ContributionType, number][];

  // Don't render if no endorsements
  if (contributionEntries.length === 0) {
    return null;
  }

  const visibleEntries = contributionEntries.slice(0, maxBadges);
  const hiddenCount = contributionEntries.length - maxBadges;
  const hiddenTotal = contributionEntries
    .slice(maxBadges)
    .reduce((sum, [, count]) => sum + count, 0);

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      data-testid="endorsement-badge-group"
    >
      {visibleEntries.map(([type, count]) => (
        <EndorsementBadge
          key={type}
          type={type}
          count={count}
          size={size}
          showLabel={showLabels}
          interactive={interactive}
          onClick={() => onBadgeClick?.(type)}
        />
      ))}
      {hiddenCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={cn(
                  'inline-flex items-center font-medium bg-muted text-muted-foreground',
                  SIZE_CONFIG[size].badge
                )}
              >
                +{hiddenCount} more
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{hiddenTotal} additional endorsements</p>
              <p className="text-xs text-muted-foreground">in {hiddenCount} other categories</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

/**
 * Displays a compact summary of total endorsements.
 */
export interface EndorsementSummaryBadgeProps {
  /** Total endorsement count */
  total: number;

  /** Number of unique endorsers */
  endorserCount: number;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a compact badge showing total endorsements and endorsers.
 */
export function EndorsementSummaryBadge({
  total,
  endorserCount,
  size = 'md',
  className,
}: EndorsementSummaryBadgeProps) {
  if (total === 0) return null;

  const sizeConfig = SIZE_CONFIG[size];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              'inline-flex items-center font-medium bg-primary/10 text-primary',
              sizeConfig.badge,
              className
            )}
            data-testid="endorsement-summary-badge"
          >
            <span className="tabular-nums">{total}</span>
            <span>endorsements</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{total} endorsements</p>
          <p className="text-xs text-muted-foreground">
            from {endorserCount} {endorserCount === 1 ? 'endorser' : 'endorsers'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Skeleton loading state for EndorsementBadge.
 */
export function EndorsementBadgeSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={cn('animate-pulse rounded-full bg-muted', sizeConfig.badge, 'w-12')}
      data-testid="endorsement-badge-skeleton"
    />
  );
}

/**
 * Re-export contribution config and helper for external use.
 */
export { CONTRIBUTION_CONFIG, getContributionConfig };
