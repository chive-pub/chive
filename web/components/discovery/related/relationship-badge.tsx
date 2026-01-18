'use client';

import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Users, Sparkles, BookOpen, Link2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type RelationshipType =
  | 'cites'
  | 'cited-by'
  | 'co-cited'
  | 'bibliographic-coupling'
  | 'semantically-similar'
  | 'same-author'
  | 'same-topic';

/**
 * Props for RelationshipBadge component.
 */
export interface RelationshipBadgeProps {
  /** Type of relationship between papers */
  type: RelationshipType;
  /** Optional score to display */
  score?: number;
  /** Additional CSS classes */
  className?: string;
}

const relationshipConfig: Record<
  RelationshipType,
  { label: string; description: string; icon: React.ElementType; color: string }
> = {
  cites: {
    label: 'Cites',
    description: 'This paper cites the current eprint',
    icon: ArrowUpRight,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  'cited-by': {
    label: 'Cited by',
    description: 'This paper is cited by the current eprint',
    icon: ArrowDownRight,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  'co-cited': {
    label: 'Co-cited',
    description: 'Frequently cited together with this eprint',
    icon: Link2,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  'bibliographic-coupling': {
    label: 'Bib. coupled',
    description: 'Shares common references',
    icon: Link2,
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  'semantically-similar': {
    label: 'Similar',
    description: 'Semantically similar content',
    icon: Sparkles,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  'same-author': {
    label: 'Same author',
    description: 'By the same author(s)',
    icon: Users,
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  },
  'same-topic': {
    label: 'Same topic',
    description: 'Shares similar topics/concepts',
    icon: BookOpen,
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
};

/**
 * Badge showing the relationship type between papers.
 *
 * @example
 * ```tsx
 * <RelationshipBadge type="cites" />
 * <RelationshipBadge type="semantically-similar" score={0.85} />
 * ```
 */
export function RelationshipBadge({ type, score, className }: RelationshipBadgeProps) {
  const config = relationshipConfig[type];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              config.color,
              className
            )}
          >
            <Icon className="h-3 w-3" />
            {config.label}
            {score !== undefined && (
              <span className="ml-0.5 opacity-75">{Math.round(score * 100)}%</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Props for RelationshipBadgeList component.
 */
export interface RelationshipBadgeListProps {
  /** Relationships to display */
  relationships: Array<{ type: RelationshipType; score?: number }>;
  /** Maximum badges to show before collapsing */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * List of relationship badges with optional collapse.
 */
export function RelationshipBadgeList({
  relationships,
  max = 3,
  className,
}: RelationshipBadgeListProps) {
  const visible = relationships.slice(0, max);
  const hidden = relationships.length - max;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map((rel, i) => (
        <RelationshipBadge key={`${rel.type}-${i}`} type={rel.type} score={rel.score} />
      ))}
      {hidden > 0 && <span className="text-xs text-muted-foreground">+{hidden} more</span>}
    </div>
  );
}
