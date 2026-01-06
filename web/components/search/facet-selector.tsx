'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FacetPanel, FacetPanelSkeleton } from './facet-panel';
import { FacetChipList } from './facet-chip';
import { cn } from '@/lib/utils';
import {
  type FacetDimension,
  type FacetFilters,
  PMEST_DIMENSIONS,
  FAST_DIMENSIONS,
  ALL_FACETS,
  filtersToSearchParams,
  searchParamsToFilters,
  countActiveFilters,
} from '@/lib/utils/facets';
import type { FacetedSearchResponse } from '@/lib/api/schema';

/**
 * Props for the FacetSelector component.
 */
export interface FacetSelectorProps {
  /** Faceted search response with counts */
  facets?: FacetedSearchResponse['facets'];
  /** Current filter selections */
  filters: FacetFilters;
  /** Called when filters change */
  onFiltersChange: (filters: FacetFilters) => void;
  /** Whether facets are loading */
  isLoading?: boolean;
  /** Display mode */
  mode?: 'tabs' | 'accordion' | 'sidebar';
  /** Additional CSS classes */
  className?: string;
}

/**
 * 10-dimensional facet selector component.
 *
 * @remarks
 * Client component that provides a full interface for selecting
 * facets across all PMEST and FAST dimensions. Supports multiple
 * display modes for different layouts.
 *
 * @example
 * ```tsx
 * <FacetSelector
 *   facets={searchResponse.facets}
 *   filters={currentFilters}
 *   onFiltersChange={(f) => updateFilters(f)}
 *   mode="tabs"
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element with facet selection interface
 */
export function FacetSelector({
  facets,
  filters,
  onFiltersChange,
  isLoading = false,
  mode = 'tabs',
  className,
}: FacetSelectorProps) {
  const [activeTab, setActiveTab] = useState<'pmest' | 'fast'>('pmest');

  const handleDimensionChange = useCallback(
    (dimension: FacetDimension, values: string[]) => {
      const newFilters = { ...filters };
      if (dimension === 'form-genre') {
        newFilters.formGenre = values;
      } else {
        newFilters[dimension as keyof FacetFilters] = values;
      }
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange]
  );

  const handleRemoveFacet = useCallback(
    (dimension: FacetDimension, value: string) => {
      const key = dimension === 'form-genre' ? 'formGenre' : (dimension as keyof FacetFilters);
      const currentValues = filters[key] ?? [];
      handleDimensionChange(
        dimension,
        currentValues.filter((v) => v !== value)
      );
    },
    [filters, handleDimensionChange]
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const activeFilterCount = countActiveFilters(filters);

  if (mode === 'sidebar') {
    return (
      <FacetSidebar
        facets={facets}
        filters={filters}
        onDimensionChange={handleDimensionChange}
        onRemoveFacet={handleRemoveFacet}
        onClearAll={handleClearAll}
        isLoading={isLoading}
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Active filters */}
      {activeFilterCount > 0 && (
        <FacetChipList
          selections={filtersToChipSelections(filters)}
          onRemove={handleRemoveFacet}
          onClearAll={handleClearAll}
        />
      )}

      {/* Tab navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pmest' | 'fast')}>
        <TabsList className="w-full">
          <TabsTrigger value="pmest" className="flex-1">
            PMEST
            <PMESTActiveCount filters={filters} />
          </TabsTrigger>
          <TabsTrigger value="fast" className="flex-1">
            FAST
            <FASTActiveCount filters={filters} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pmest" className="mt-4 space-y-4">
          {isLoading ? (
            <FacetPanelsSkeleton dimensions={PMEST_DIMENSIONS} />
          ) : (
            PMEST_DIMENSIONS.map((dimension) => (
              <FacetPanel
                key={dimension}
                dimension={dimension}
                title={ALL_FACETS[dimension].label}
                values={facets?.[dimension] ?? []}
                selected={filters[dimension] ?? []}
                onSelectionChange={(values) => handleDimensionChange(dimension, values)}
                searchable
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="fast" className="mt-4 space-y-4">
          {isLoading ? (
            <FacetPanelsSkeleton dimensions={FAST_DIMENSIONS} />
          ) : (
            FAST_DIMENSIONS.map((dimension) => (
              <FacetPanel
                key={dimension}
                dimension={dimension}
                title={ALL_FACETS[dimension].label}
                values={
                  dimension === 'form-genre'
                    ? (facets?.formGenre ?? [])
                    : (facets?.[dimension as keyof typeof facets] ?? [])
                }
                selected={
                  dimension === 'form-genre'
                    ? (filters.formGenre ?? [])
                    : (filters[dimension as keyof FacetFilters] ?? [])
                }
                onSelectionChange={(values) => handleDimensionChange(dimension, values)}
                searchable
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Props for the FacetSidebar component.
 */
interface FacetSidebarProps {
  facets?: FacetedSearchResponse['facets'];
  filters: FacetFilters;
  onDimensionChange: (dimension: FacetDimension, values: string[]) => void;
  onRemoveFacet: (dimension: FacetDimension, value: string) => void;
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
  onDimensionChange,
  onRemoveFacet,
  onClearAll,
  isLoading,
  className,
}: FacetSidebarProps) {
  const activeFilterCount = countActiveFilters(filters);

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
            selections={filtersToChipSelections(filters)}
            onRemove={onRemoveFacet}
            maxVisible={6}
          />
        </div>
      )}

      {/* PMEST section */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          PMEST Facets
        </h3>
        {isLoading ? (
          <FacetPanelsSkeleton dimensions={PMEST_DIMENSIONS} />
        ) : (
          <div className="space-y-2">
            {PMEST_DIMENSIONS.map((dimension) => (
              <FacetPanel
                key={dimension}
                dimension={dimension}
                title={ALL_FACETS[dimension].label}
                values={facets?.[dimension] ?? []}
                selected={filters[dimension] ?? []}
                onSelectionChange={(values) => onDimensionChange(dimension, values)}
                collapsible
                defaultCollapsed
                maxVisible={5}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAST section */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          FAST Facets
        </h3>
        {isLoading ? (
          <FacetPanelsSkeleton dimensions={FAST_DIMENSIONS} />
        ) : (
          <div className="space-y-2">
            {FAST_DIMENSIONS.map((dimension) => (
              <FacetPanel
                key={dimension}
                dimension={dimension}
                title={ALL_FACETS[dimension].label}
                values={
                  dimension === 'form-genre'
                    ? (facets?.formGenre ?? [])
                    : (facets?.[dimension as keyof typeof facets] ?? [])
                }
                selected={
                  dimension === 'form-genre'
                    ? (filters.formGenre ?? [])
                    : (filters[dimension as keyof FacetFilters] ?? [])
                }
                onSelectionChange={(values) => onDimensionChange(dimension, values)}
                collapsible
                defaultCollapsed
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
 * Shows count of active PMEST filters.
 */
function PMESTActiveCount({ filters }: { filters: FacetFilters }) {
  const count = PMEST_DIMENSIONS.reduce((sum, dim) => sum + (filters[dim]?.length ?? 0), 0);
  if (count === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
      {count}
    </span>
  );
}

/**
 * Shows count of active FAST filters.
 */
function FASTActiveCount({ filters }: { filters: FacetFilters }) {
  const fastKeys: (keyof FacetFilters)[] = ['person', 'organization', 'event', 'work', 'formGenre'];
  const count = fastKeys.reduce((sum, key) => sum + (filters[key]?.length ?? 0), 0);
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
function FacetPanelsSkeleton({ dimensions }: { dimensions: readonly FacetDimension[] }) {
  return (
    <div className="space-y-4">
      {dimensions.map((dim) => (
        <FacetPanelSkeleton key={dim} rows={5} />
      ))}
    </div>
  );
}

/**
 * Converts FacetFilters to the format expected by FacetChipList.
 */
function filtersToChipSelections(filters: FacetFilters): Partial<Record<FacetDimension, string[]>> {
  return {
    personality: filters.personality,
    matter: filters.matter,
    energy: filters.energy,
    space: filters.space,
    time: filters.time,
    person: filters.person,
    organization: filters.organization,
    event: filters.event,
    work: filters.work,
    'form-genre': filters.formGenre,
  };
}

/**
 * Props for the FacetSelectorWithUrl component.
 */
export interface FacetSelectorWithUrlProps extends Omit<
  FacetSelectorProps,
  'filters' | 'onFiltersChange'
> {
  /** Base path for navigation */
  basePath?: string;
}

/**
 * Facet selector that syncs with URL search params.
 *
 * @example
 * ```tsx
 * <FacetSelectorWithUrl
 *   facets={searchResponse.facets}
 *   basePath="/browse"
 * />
 * ```
 */
export function FacetSelectorWithUrl({
  basePath = '/browse',
  ...props
}: FacetSelectorWithUrlProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() => searchParamsToFilters(searchParams), [searchParams]);

  const handleFiltersChange = useCallback(
    (newFilters: FacetFilters) => {
      const params = filtersToSearchParams(newFilters);
      const queryString = params.toString();
      router.push(queryString ? `${basePath}?${queryString}` : basePath, { scroll: false });
    },
    [router, basePath]
  );

  return <FacetSelector filters={filters} onFiltersChange={handleFiltersChange} {...props} />;
}
