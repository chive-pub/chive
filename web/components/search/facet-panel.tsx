'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/utils/format-number';
import type { FacetDimension } from '@/lib/utils/facets';
import type { FacetValue } from '@/lib/api/schema';

/**
 * Props for the FacetPanel component.
 */
export interface FacetPanelProps {
  /** Facet dimension identifier */
  dimension: FacetDimension;
  /** Display title */
  title: string;
  /** Available facet values with counts */
  values: FacetValue[];
  /** Currently selected values */
  selected: string[];
  /** Called when selection changes */
  onSelectionChange: (values: string[]) => void;
  /** Whether the panel is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Whether to show search input */
  searchable?: boolean;
  /** Maximum values to show before "show more" */
  maxVisible?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Single facet dimension panel with value selection.
 *
 * @remarks
 * Client component for displaying and selecting values within
 * a single facet dimension. Supports search filtering and
 * multi-select with checkboxes.
 *
 * @example
 * ```tsx
 * <FacetPanel
 *   dimension="personality"
 *   title="Subject Area"
 *   values={facets.personality}
 *   selected={selections.personality}
 *   onSelectionChange={(vals) => updateFacet('personality', vals)}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the facet panel
 */
export function FacetPanel({
  dimension: _dimension,
  title,
  values,
  selected,
  onSelectionChange,
  collapsible = true,
  defaultCollapsed = false,
  searchable = false,
  maxVisible = 10,
  className,
}: FacetPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Filter values by search term
  const filteredValues = searchTerm
    ? values.filter(
        (v) =>
          v.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.label?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : values;

  // Limit visible values
  const visibleValues = showAll ? filteredValues : filteredValues.slice(0, maxVisible);
  const hasMore = filteredValues.length > maxVisible;

  const handleToggle = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onSelectionChange(selected.filter((v) => v !== value));
      } else {
        onSelectionChange([...selected, value]);
      }
    },
    [selected, onSelectionChange]
  );

  const handleClear = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <button
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3',
          collapsible && 'cursor-pointer hover:bg-accent/50'
        )}
        disabled={!collapsible}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {selected.length}
            </Badge>
          )}
        </div>
        {collapsible && (
          <span className="text-muted-foreground">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        )}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="border-t px-4 py-3">
          {/* Search input */}
          {searchable && values.length > 5 && (
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}

          {/* Value list */}
          <ScrollArea className={cn(showAll && hasMore && 'max-h-64')}>
            <div className="space-y-1">
              {visibleValues.map((facetValue) => (
                <FacetValueItem
                  key={facetValue.value}
                  value={facetValue.value}
                  label={facetValue.label}
                  count={facetValue.count}
                  isSelected={selected.includes(facetValue.value)}
                  onToggle={() => handleToggle(facetValue.value)}
                />
              ))}

              {visibleValues.length === 0 && (
                <p className="py-2 text-center text-sm text-muted-foreground">No matching values</p>
              )}
            </div>
          </ScrollArea>

          {/* Show more/less toggle */}
          {hasMore && !searchTerm && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {showAll ? 'Show less' : `Show ${filteredValues.length - maxVisible} more`}
            </button>
          )}

          {/* Clear selection */}
          {selected.length > 0 && (
            <button
              onClick={handleClear}
              className="mt-2 block text-xs text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Props for the FacetValueItem component.
 */
interface FacetValueItemProps {
  value: string;
  label?: string;
  count: number;
  isSelected: boolean;
  onToggle: () => void;
}

/**
 * Single facet value item with checkbox.
 */
function FacetValueItem({ value, label, count, isSelected, onToggle }: FacetValueItemProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-accent',
        isSelected && 'bg-accent'
      )}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="h-4 w-4 rounded border-input"
        />
        <span className="text-sm">{label ?? value}</span>
      </div>
      <span className="text-xs text-muted-foreground">{formatCompactNumber(count)}</span>
    </label>
  );
}

/**
 * Props for the FacetPanelSkeleton component.
 */
export interface FacetPanelSkeletonProps {
  /** Number of value rows to show */
  rows?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for the FacetPanel component.
 */
export function FacetPanelSkeleton({ rows = 5, className }: FacetPanelSkeletonProps) {
  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </div>
      <div className="border-t px-4 py-3">
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => {
            // Deterministic widths to avoid hydration mismatch
            const widths = [80, 65, 90, 72, 85];
            return (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  <div
                    className="h-4 animate-pulse rounded bg-muted"
                    style={{ width: `${widths[i % widths.length]}px` }}
                  />
                </div>
                <div className="h-3 w-8 animate-pulse rounded bg-muted" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
