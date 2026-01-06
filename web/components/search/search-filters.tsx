'use client';

import { useState, useCallback } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Calendar, User, Tag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FieldRef } from '@/lib/api/schema';

/**
 * Search filter values.
 */
export interface SearchFilters {
  field?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
  keywords?: string[];
}

/**
 * Props for the SearchFiltersPanel component.
 */
export interface SearchFiltersPanelProps {
  /** Current filter values */
  filters: SearchFilters;
  /** Called when filters change */
  onFiltersChange: (filters: SearchFilters) => void;
  /** Available fields for filtering */
  availableFields?: FieldRef[];
  /** Whether the panel is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Filter panel for search refinement.
 *
 * @remarks
 * Client component that manages search filters for fields, authors,
 * date ranges, and keywords. Integrates with URL params for shareable URLs.
 *
 * @example
 * ```tsx
 * <SearchFiltersPanel
 *   filters={currentFilters}
 *   onFiltersChange={(f) => updateFilters(f)}
 *   availableFields={fields}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element with filter controls
 */
export function SearchFiltersPanel({
  filters,
  onFiltersChange,
  availableFields = [],
  collapsible = true,
  defaultCollapsed = false,
  className,
}: SearchFiltersPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const updateFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const clearFilter = useCallback(
    (key: keyof SearchFilters) => {
      const newFilters = { ...filters };
      delete newFilters[key];
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange]
  );

  const clearAllFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)
  );

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3',
          collapsible && 'cursor-pointer'
        )}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              Active
            </Badge>
          )}
        </div>
        {collapsible && (
          <Button variant="ghost" size="icon" className="h-6 w-6">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Filter controls */}
      {!isCollapsed && (
        <div className="space-y-4 border-t px-4 py-4">
          {/* Field filter */}
          {availableFields.length > 0 && (
            <FilterSection
              label="Field"
              icon={<Tag className="h-4 w-4" />}
              hasValue={!!filters.field}
              onClear={() => clearFilter('field')}
            >
              <select
                value={filters.field ?? ''}
                onChange={(e) => updateFilter('field', e.target.value || undefined)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">All fields</option>
                {availableFields.map((field) => (
                  <option key={field.uri} value={field.uri}>
                    {field.name}
                  </option>
                ))}
              </select>
            </FilterSection>
          )}

          {/* Author filter */}
          <FilterSection
            label="Author"
            icon={<User className="h-4 w-4" />}
            hasValue={!!filters.author}
            onClear={() => clearFilter('author')}
          >
            <Input
              id="filter-author"
              type="text"
              placeholder="Author name or DID..."
              aria-label="Author name or DID"
              value={filters.author ?? ''}
              onChange={(e) => updateFilter('author', e.target.value || undefined)}
              className="h-9"
            />
          </FilterSection>

          {/* Date range filter */}
          <FilterSection
            label="Date range"
            icon={<Calendar className="h-4 w-4" />}
            hasValue={!!filters.dateFrom || !!filters.dateTo}
            onClear={() => {
              clearFilter('dateFrom');
              clearFilter('dateTo');
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="filter-date-from" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="filter-date-from"
                  type="date"
                  value={filters.dateFrom ?? ''}
                  onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
                  className="h-9"
                />
              </div>
              <div>
                <Label htmlFor="filter-date-to" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input
                  id="filter-date-to"
                  type="date"
                  value={filters.dateTo ?? ''}
                  onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
                  className="h-9"
                />
              </div>
            </div>
          </FilterSection>

          {/* Clear all button */}
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="w-full" onClick={clearAllFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear all filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Props for the FilterSection component.
 */
interface FilterSectionProps {
  label: string;
  icon: React.ReactNode;
  hasValue: boolean;
  onClear: () => void;
  children: React.ReactNode;
}

/**
 * Single filter section with label and clear button.
 */
function FilterSection({ label, icon, hasValue, onClear, children }: FilterSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm">
          {icon}
          {label}
        </Label>
        {hasValue && (
          <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Props for the ActiveFilters component.
 */
export interface ActiveFiltersProps {
  /** Current filter values */
  filters: SearchFilters;
  /** Called to remove a filter */
  onRemoveFilter: (key: keyof SearchFilters) => void;
  /** Called to clear all filters */
  onClearAll?: () => void;
  /** Field lookup for display names */
  fieldNames?: Record<string, string>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays active filters as removable chips.
 *
 * @example
 * ```tsx
 * <ActiveFilters
 *   filters={currentFilters}
 *   onRemoveFilter={(key) => removeFilter(key)}
 *   onClearAll={() => clearAllFilters()}
 * />
 * ```
 */
export function ActiveFilters({
  filters,
  onRemoveFilter,
  onClearAll,
  fieldNames = {},
  className,
}: ActiveFiltersProps) {
  const filterEntries = Object.entries(filters).filter(
    ([_, value]) =>
      value !== undefined && value !== '' && (Array.isArray(value) ? value.length > 0 : true)
  );

  if (filterEntries.length === 0) {
    return null;
  }

  const formatFilterValue = (key: string, value: unknown): string => {
    if (key === 'field' && typeof value === 'string') {
      return fieldNames[value] ?? value;
    }
    if (key === 'dateFrom' || key === 'dateTo') {
      return new Date(value as string).toLocaleDateString();
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  };

  const formatFilterLabel = (key: string): string => {
    const labels: Record<string, string> = {
      field: 'Field',
      author: 'Author',
      dateFrom: 'From',
      dateTo: 'To',
      keywords: 'Keywords',
    };
    return labels[key] ?? key;
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">Filters:</span>
      {filterEntries.map(([key, value]) => (
        <Badge key={key} variant="secondary" className="gap-1 pr-1">
          <span className="text-xs text-muted-foreground">{formatFilterLabel(key)}:</span>
          <span>{formatFilterValue(key, value)}</span>
          <button
            onClick={() => onRemoveFilter(key as keyof SearchFilters)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove {formatFilterLabel(key)} filter</span>
          </button>
        </Badge>
      ))}
      {onClearAll && filterEntries.length > 1 && (
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
