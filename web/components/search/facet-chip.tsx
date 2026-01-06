'use client';

import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FacetDimension } from '@/lib/utils/facets';
import { getDimensionLabel, getDimensionColor } from '@/lib/utils/facets';

/**
 * Props for the FacetChip component.
 */
export interface FacetChipProps {
  /** Facet dimension type */
  dimension: FacetDimension;
  /** Selected value */
  value: string;
  /** Display label (if different from value) */
  label?: string;
  /** Called when chip should be removed */
  onRemove?: () => void;
  /** Whether the chip is removable */
  removable?: boolean;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a selected facet value as a removable chip.
 *
 * @remarks
 * Client component that shows a facet selection with dimension
 * label and color coding. Supports removal interaction.
 *
 * @example
 * ```tsx
 * <FacetChip
 *   dimension="personality"
 *   value="physics"
 *   label="Physics"
 *   onRemove={() => removeFacet('personality', 'physics')}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the facet chip
 */
export function FacetChip({
  dimension,
  value,
  label,
  onRemove,
  removable = true,
  size = 'default',
  className,
}: FacetChipProps) {
  const color = getDimensionColor(dimension);
  const dimensionLabel = getDimensionLabel(dimension);

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 border-current',
        color,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1',
        className
      )}
    >
      <span className="text-xs opacity-70">{dimensionLabel}:</span>
      <span>{label ?? value}</span>
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-current/10"
          aria-label={`Remove ${label ?? value} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

/**
 * Props for the FacetChipList component.
 */
export interface FacetChipListProps {
  /** Map of dimension to selected values */
  selections: Partial<Record<FacetDimension, string[]>>;
  /** Map of value to label for display */
  labels?: Record<string, string>;
  /** Called when a facet should be removed */
  onRemove?: (dimension: FacetDimension, value: string) => void;
  /** Called when all facets should be cleared */
  onClearAll?: () => void;
  /** Maximum chips to show before collapsing */
  maxVisible?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a list of selected facet chips.
 *
 * @example
 * ```tsx
 * <FacetChipList
 *   selections={{ personality: ['physics'], matter: ['quantum'] }}
 *   onRemove={(dim, val) => removeFacet(dim, val)}
 *   onClearAll={() => clearAllFacets()}
 * />
 * ```
 */
export function FacetChipList({
  selections,
  labels = {},
  onRemove,
  onClearAll,
  maxVisible = 10,
  className,
}: FacetChipListProps) {
  const allChips: { dimension: FacetDimension; value: string }[] = [];

  for (const [dimension, values] of Object.entries(selections)) {
    if (values && values.length > 0) {
      for (const value of values) {
        allChips.push({ dimension: dimension as FacetDimension, value });
      }
    }
  }

  if (allChips.length === 0) {
    return null;
  }

  const visibleChips = allChips.slice(0, maxVisible);
  const hiddenCount = allChips.length - maxVisible;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {visibleChips.map(({ dimension, value }) => (
        <FacetChip
          key={`${dimension}-${value}`}
          dimension={dimension}
          value={value}
          label={labels[value]}
          onRemove={onRemove ? () => onRemove(dimension, value) : undefined}
          size="sm"
        />
      ))}

      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          +{hiddenCount} more
        </Badge>
      )}

      {onClearAll && allChips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
