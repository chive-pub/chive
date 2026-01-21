'use client';

import { Lightbulb, Quote, BookOpen, Users, TrendingUp, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { RecommendationExplanation } from '@/lib/api/schema';

/**
 * Props for RecommendationBadge component.
 */
export interface RecommendationBadgeProps {
  /** Explanation data from the recommendation */
  explanation: RecommendationExplanation;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Known recommendation types.
 */
type KnownRecommendationType =
  | 'semantic'
  | 'citation'
  | 'concept'
  | 'collaborator'
  | 'fields'
  | 'trending';

/**
 * Type guard for known recommendation types.
 */
function isKnownType(type: string): type is KnownRecommendationType {
  return type in typeIcons;
}

/**
 * Icon mapping for recommendation types.
 */
const typeIcons: Record<KnownRecommendationType, typeof Sparkles> = {
  semantic: Sparkles,
  citation: Quote,
  concept: BookOpen,
  collaborator: Users,
  fields: Lightbulb,
  trending: TrendingUp,
};

/**
 * Label mapping for recommendation types.
 */
const typeLabels: Record<KnownRecommendationType, string> = {
  semantic: 'Similar content',
  citation: 'Citation overlap',
  concept: 'Related concepts',
  collaborator: 'From collaborator',
  fields: 'In your field',
  trending: 'Trending',
};

/**
 * Color mapping for recommendation types.
 */
const typeColors: Record<KnownRecommendationType, string> = {
  semantic: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  citation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  concept: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  collaborator: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  fields: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  trending: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

/**
 * Default values for unknown recommendation types.
 */
const defaultIcon = Lightbulb;
const defaultLabel = 'Recommended';
const defaultColor = 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';

/**
 * Displays a badge indicating why a paper was recommended.
 *
 * @remarks
 * Shows a compact badge with icon and label. Optionally displays
 * a tooltip with detailed explanation on hover.
 *
 * @example
 * ```tsx
 * <RecommendationBadge
 *   explanation={{
 *     type: 'semantic',
 *     text: 'Semantically similar to your recent work on formal semantics',
 *     weight: 0.85,
 *   }}
 *   showTooltip
 * />
 * ```
 */
export function RecommendationBadge({
  explanation,
  size = 'default',
  showTooltip = true,
  className,
}: RecommendationBadgeProps) {
  const type = explanation.type;
  const Icon = isKnownType(type) ? typeIcons[type] : defaultIcon;
  const label = isKnownType(type) ? typeLabels[type] : defaultLabel;
  const colorClass = isKnownType(type) ? typeColors[type] : defaultColor;

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1 border-0 font-normal',
        colorClass,
        size === 'sm' && 'px-1.5 py-0.5 text-xs',
        className
      )}
    >
      <Icon className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      <span className="truncate">{label}</span>
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{explanation.text}</p>
          {explanation.data?.similarPaperTitle && (
            <p className="mt-1 text-xs text-muted-foreground">
              Similar to: {explanation.data.similarPaperTitle}
            </p>
          )}
          {explanation.data?.sharedCitations !== undefined &&
            explanation.data.sharedCitations > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {explanation.data.sharedCitations} shared citations
              </p>
            )}
          {explanation.data?.matchingConcepts && explanation.data.matchingConcepts.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Topics: {explanation.data.matchingConcepts.slice(0, 3).join(', ')}
              {explanation.data.matchingConcepts.length > 3 && '...'}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Displays multiple recommendation badges in a row.
 */
export interface RecommendationBadgeListProps {
  /** List of explanations to display */
  explanations: RecommendationExplanation[];
  /** Maximum number of badges to show */
  max?: number;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a list of recommendation badges.
 *
 * @example
 * ```tsx
 * <RecommendationBadgeList
 *   explanations={[
 *     { type: 'semantic', text: '...', weight: 0.8 },
 *     { type: 'fields', text: '...', weight: 0.6 },
 *   ]}
 *   max={2}
 * />
 * ```
 */
export function RecommendationBadgeList({
  explanations,
  max = 3,
  size = 'default',
  className,
}: RecommendationBadgeListProps) {
  const displayExplanations = explanations.slice(0, max);
  const remaining = explanations.length - max;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayExplanations.map((explanation, index) => (
        <RecommendationBadge key={index} explanation={explanation} size={size} />
      ))}
      {remaining > 0 && (
        <Badge
          variant="outline"
          className={cn('font-normal', size === 'sm' && 'px-1.5 py-0.5 text-xs')}
        >
          +{remaining}
        </Badge>
      )}
    </div>
  );
}
