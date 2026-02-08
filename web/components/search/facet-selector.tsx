'use client';

import { useCallback } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FacetPanel, FacetPanelSkeleton } from './facet-panel';
import { FacetChipList } from './facet-chip';
import { cn } from '@/lib/utils';
import {
  type DynamicFacetFilters,
  type FacetDefinition,
  countTotalFilters,
} from '@/lib/hooks/use-faceted-search';

/**
 * Props for the FacetSelector component.
 */
export interface FacetSelectorProps {
  /** Facet definitions from the API */
  facets?: FacetDefinition[];
  /** Current filter selections keyed by facet slug */
  filters: DynamicFacetFilters;
  /** Called when filters change */
  onFiltersChange: (filters: DynamicFacetFilters) => void;
  /** Whether facets are loading */
  isLoading?: boolean;
  /** Display mode */
  mode?: 'tabs' | 'accordion' | 'sidebar';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Dynamic facet selector component.
 *
 * @remarks
 * Client component that provides a full interface for selecting
 * facets fetched dynamically from the knowledge graph.
 *
 * @example
 * ```tsx
 * <FacetSelector
 *   facets={searchResponse.facets}
 *   filters={currentFilters}
 *   onFiltersChange={(f) => updateFilters(f)}
 *   mode="sidebar"
 * />
 * ```
 */
export function FacetSelector({
  facets = [],
  filters,
  onFiltersChange,
  isLoading = false,
  mode = 'tabs',
  className,
}: FacetSelectorProps) {
  const handleFacetChange = useCallback(
    (facetSlug: string, values: string[]) => {
      if (values.length === 0) {
        // Remove the facet key entirely when no values selected
        const { [facetSlug]: _, ...rest } = filters;
        onFiltersChange(rest);
      } else {
        onFiltersChange({
          ...filters,
          [facetSlug]: values,
        });
      }
    },
    [filters, onFiltersChange]
  );

  const handleRemoveFacet = useCallback(
    (facetSlug: string, value: string) => {
      const currentValues = filters[facetSlug] ?? [];
      const newValues = currentValues.filter((v) => v !== value);
      handleFacetChange(facetSlug, newValues);
    },
    [filters, handleFacetChange]
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const activeFilterCount = countTotalFilters(filters);

  if (mode === 'sidebar') {
    return (
      <FacetSidebar
        facets={facets}
        filters={filters}
        onFacetChange={handleFacetChange}
        onRemoveFacet={handleRemoveFacet}
        onClearAll={handleClearAll}
        isLoading={isLoading}
        className={className}
      />
    );
  }

  // Tabs mode - show facets in two groups based on index
  const firstHalf = facets.slice(0, Math.ceil(facets.length / 2));
  const secondHalf = facets.slice(Math.ceil(facets.length / 2));

  return (
    <div className={cn('space-y-4', className)}>
      {/* Active filters */}
      {activeFilterCount > 0 && (
        <FacetChipList
          facets={facets}
          filters={filters}
          onRemove={handleRemoveFacet}
          onClearAll={handleClearAll}
        />
      )}

      {/* Tab navigation */}
      <Tabs defaultValue="group1">
        <TabsList className="w-full">
          <TabsTrigger value="group1" className="flex-1">
            Facets
            <ActiveCount filters={filters} facets={firstHalf} />
          </TabsTrigger>
          {secondHalf.length > 0 && (
            <TabsTrigger value="group2" className="flex-1">
              More
              <ActiveCount filters={filters} facets={secondHalf} />
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="group1" className="mt-4 space-y-4">
          {isLoading ? (
            <FacetPanelsSkeleton count={5} />
          ) : (
            firstHalf.map((facet) => (
              <FacetPanel
                key={facet.slug}
                dimension={facet.slug}
                title={facet.label}
                values={facet.values}
                selected={filters[facet.slug] ?? []}
                onSelectionChange={(values) => handleFacetChange(facet.slug, values)}
                searchable
              />
            ))
          )}
        </TabsContent>

        {secondHalf.length > 0 && (
          <TabsContent value="group2" className="mt-4 space-y-4">
            {isLoading ? (
              <FacetPanelsSkeleton count={5} />
            ) : (
              secondHalf.map((facet) => (
                <FacetPanel
                  key={facet.slug}
                  dimension={facet.slug}
                  title={facet.label}
                  values={facet.values}
                  selected={filters[facet.slug] ?? []}
                  onSelectionChange={(values) => handleFacetChange(facet.slug, values)}
                  searchable
                />
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/**
 * Props for the FacetSidebar component.
 */
interface FacetSidebarProps {
  facets: FacetDefinition[];
  filters: DynamicFacetFilters;
  onFacetChange: (facetSlug: string, values: string[]) => void;
  onRemoveFacet: (facetSlug: string, value: string) => void;
  onClearAll: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * Sidebar variant of the facet selector.
 */
function FacetSidebar({
  facets,
  filters,
  onFacetChange,
  onRemoveFacet,
  onClearAll,
  isLoading,
  className,
}: FacetSidebarProps) {
  const activeFilterCount = countTotalFilters(filters);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Active filters header */}
      {activeFilterCount > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">Active Filters ({activeFilterCount})</h3>
            <button
              onClick={onClearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
          <FacetChipList
            facets={facets}
            filters={filters}
            onRemove={onRemoveFacet}
            maxVisible={6}
          />
        </div>
      )}

      {/* Facet panels */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Filter by
        </h3>
        {isLoading ? (
          <FacetPanelsSkeleton count={5} />
        ) : (
          <div className="space-y-2">
            {facets.map((facet) => (
              <FacetPanel
                key={facet.slug}
                dimension={facet.slug}
                title={facet.label}
                values={facet.values}
                selected={filters[facet.slug] ?? []}
                onSelectionChange={(values) => onFacetChange(facet.slug, values)}
                collapsible
                defaultCollapsed
                searchable
                maxVisible={5}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Shows count of active filters for a set of facets.
 */
function ActiveCount({
  filters,
  facets,
}: {
  filters: DynamicFacetFilters;
  facets: FacetDefinition[];
}) {
  const count = facets.reduce((sum, facet) => sum + (filters[facet.slug]?.length ?? 0), 0);
  if (count === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
      {count}
    </span>
  );
}

/**
 * Skeleton for multiple facet panels.
 */
function FacetPanelsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <FacetPanelSkeleton key={i} rows={5} />
      ))}
    </div>
  );
}
