'use client';

import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DynamicFacetFilters, FacetDefinition } from '@/lib/hooks/use-faceted-search';

/**
 * Props for the FacetChip component.
 */
export interface FacetChipProps {
  /** Facet slug */
  facetSlug: string;
  /** Facet display label */
  facetLabel: string;
  /** Selected value */
  value: string;
  /** Display label for value (if different from value) */
  valueLabel?: string;
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
 * @example
 * ```tsx
 * <FacetChip
 *   facetSlug="methodology"
 *   facetLabel="Methodology"
 *   value="meta-analysis"
 *   valueLabel="Meta-analysis"
 *   onRemove={() => removeFacet('methodology', 'meta-analysis')}
 * />
 * ```
 */
export function FacetChip({
  facetSlug: _facetSlug,
  facetLabel,
  value,
  valueLabel,
  onRemove,
  removable = true,
  size = 'default',
  className,
}: FacetChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 border-current text-foreground',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1',
        className
      )}
    >
      <span className="text-xs opacity-70">{facetLabel}:</span>
      <span>{valueLabel ?? value}</span>
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-current/10"
          aria-label={`Remove ${valueLabel ?? value} filter`}
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
  /** Facet definitions from the API */
  facets: FacetDefinition[];
  /** Current filter selections keyed by facet slug */
  filters: DynamicFacetFilters;
  /** Called when a facet should be removed */
  onRemove?: (facetSlug: string, value: string) => void;
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
 *   facets={searchResponse.facets}
 *   filters={{ methodology: ['meta-analysis'], 'time-period': ['21st-century'] }}
 *   onRemove={(slug, val) => removeFacet(slug, val)}
 *   onClearAll={() => clearAllFacets()}
 * />
 * ```
 */
export function FacetChipList({
  facets,
  filters,
  onRemove,
  onClearAll,
  maxVisible = 10,
  className,
}: FacetChipListProps) {
  // Build chip data from filters
  const allChips: { facetSlug: string; facetLabel: string; value: string; valueLabel?: string }[] =
    [];

  // Create a map from slug to facet definition for quick lookup
  const facetMap = new Map(facets.map((f) => [f.slug, f]));

  for (const [facetSlug, values] of Object.entries(filters)) {
    if (values && values.length > 0) {
      const facet = facetMap.get(facetSlug);
      const facetLabel = facet?.label ?? facetSlug;

      for (const value of values) {
        // Try to find the value label from the facet values
        const valueData = facet?.values.find((v) => v.value === value);
        allChips.push({
          facetSlug,
          facetLabel,
          value,
          valueLabel: valueData?.label,
        });
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
      {visibleChips.map(({ facetSlug, facetLabel, value, valueLabel }) => (
        <FacetChip
          key={`${facetSlug}-${value}`}
          facetSlug={facetSlug}
          facetLabel={facetLabel}
          value={value}
          valueLabel={valueLabel}
          onRemove={onRemove ? () => onRemove(facetSlug, value) : undefined}
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
