'use client';

/**
 * Facet selection step for eprint submission.
 *
 * @remarks
 * Step 6 of the submission wizard. Fetches available facets dynamically
 * from the knowledge graph and allows users to select values.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Info, Layers, X, ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useFacetCounts,
  type FacetDefinition,
  type FacetValue,
} from '@/lib/hooks/use-faceted-search';
import type { EprintFormValues } from './submission-wizard';
import { mergeFieldsIntoFacets } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepFacets component.
 */
export interface StepFacetsProps {
  /** React Hook Form instance */
  form: UseFormReturn<EprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Selected facet value for form state.
 */
interface SelectedFacet {
  /** Facet slug (dimension identifier) */
  slug: string;
  /** Selected value */
  value: string;
  /** Display label */
  label?: string;
}

// =============================================================================
// FACET SELECTOR COMPONENT
// =============================================================================

interface FacetSelectorProps {
  facet: FacetDefinition;
  selectedValues: string[];
  onSelect: (value: string, label?: string) => void;
  onRemove: (value: string) => void;
  defaultOpen?: boolean;
}

function FacetSelector({
  facet,
  selectedValues,
  onSelect,
  onRemove,
  defaultOpen = false,
}: FacetSelectorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter values based on search query
  const filteredValues = useMemo(() => {
    if (!searchQuery) return facet.values;
    const query = searchQuery.toLowerCase();
    return facet.values.filter(
      (v) => v.value.toLowerCase().includes(query) || v.label?.toLowerCase().includes(query)
    );
  }, [facet.values, searchQuery]);

  // Get selected value objects for display
  const selectedValueObjects = useMemo(() => {
    return selectedValues
      .map((v) => facet.values.find((fv) => fv.value === v))
      .filter((v): v is FacetValue => v !== undefined);
  }, [selectedValues, facet.values]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto hover:bg-muted/50"
          type="button"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="font-medium text-sm">{facet.label}</span>
            {selectedValues.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedValues.length}
              </Badge>
            )}
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3">
        {facet.description && <p className="text-sm text-muted-foreground">{facet.description}</p>}

        {/* Selected values */}
        {selectedValueObjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedValueObjects.map((v) => (
              <Badge key={v.value} variant="secondary" className="gap-1 py-1 px-2">
                {v.label || v.value}
                <button
                  type="button"
                  onClick={() => onRemove(v.value)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Value selector */}
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start" type="button">
              <span className="text-muted-foreground">Add {facet.label.toLowerCase()}...</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={`Search ${facet.label.toLowerCase()}...`}
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {filteredValues.slice(0, 20).map((v) => {
                    const isSelected = selectedValues.includes(v.value);
                    return (
                      <CommandItem
                        key={v.value}
                        value={v.value}
                        disabled={isSelected}
                        onSelect={() => {
                          if (!isSelected) {
                            onSelect(v.value, v.label);
                            setSearchOpen(false);
                            setSearchQuery('');
                          }
                        }}
                        className={cn(isSelected && 'opacity-50')}
                      >
                        <span>{v.label || v.value}</span>
                        {v.count > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground">{v.count}</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function FacetsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Facet selection step component.
 *
 * @param props - Component props
 * @returns Facet selection step element
 */
export function StepFacets({ form, className }: StepFacetsProps) {
  // Fetch available facets from knowledge graph
  const { data: facets, isLoading, error } = useFacetCounts();

  const watchedFacets = form.watch('facets');
  const watchedFieldNodes = form.watch('fieldNodes');
  const selectedFacets = useMemo<SelectedFacet[]>(
    () => (watchedFacets as SelectedFacet[] | undefined) ?? [],
    [watchedFacets]
  );

  // Auto-populate personality facets from selected field nodes
  useEffect(() => {
    const fieldNodes = watchedFieldNodes ?? [];
    if (fieldNodes.length === 0) return;

    const merged = mergeFieldsIntoFacets(selectedFacets, fieldNodes);
    if (merged.length !== selectedFacets.length) {
      form.setValue('facets', merged, { shouldValidate: true });
    }
  }, [watchedFieldNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get selected values for a specific facet
  const getSelectedValues = useCallback(
    (slug: string): string[] => {
      return selectedFacets.filter((f) => f.slug === slug).map((f) => f.value);
    },
    [selectedFacets]
  );

  // Handle facet value selection
  const handleSelect = useCallback(
    (slug: string, value: string, label?: string) => {
      // Check for duplicates
      if (selectedFacets.some((f) => f.slug === slug && f.value === value)) {
        return;
      }

      const newFacet: SelectedFacet = { slug, value, label };
      form.setValue('facets', [...selectedFacets, newFacet], {
        shouldValidate: true,
      });
    },
    [form, selectedFacets]
  );

  // Handle facet value removal
  const handleRemove = useCallback(
    (slug: string, value: string) => {
      const updated = selectedFacets.filter((f) => !(f.slug === slug && f.value === value));
      form.setValue('facets', updated, { shouldValidate: true });
    },
    [form, selectedFacets]
  );

  return (
    <div className={cn('space-y-6', className)} data-testid="facets-step">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Faceted Classification
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add optional facets to improve discoverability. Select from available classification
          dimensions.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && <FacetsSkeleton />}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load facets. You can continue without selecting facets.
        </div>
      )}

      {/* Facet selectors */}
      {facets && facets.length > 0 && (
        <div className="space-y-3">
          {facets.map((facet, index) => (
            <FacetSelector
              key={facet.slug}
              facet={facet}
              selectedValues={getSelectedValues(facet.slug)}
              onSelect={(value, label) => handleSelect(facet.slug, value, label)}
              onRemove={(value) => handleRemove(facet.slug, value)}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {facets && facets.length === 0 && !isLoading && (
        <div className="rounded-lg border border-muted bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          No facets available. You can continue without selecting facets.
        </div>
      )}

      {/* Summary */}
      {selectedFacets.length > 0 && (
        <div className="rounded-lg border border-muted bg-muted/30 p-4">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Selected Facets ({selectedFacets.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedFacets.map((facet) => (
              <Badge key={`${facet.slug}-${facet.value}`} variant="outline" className="gap-1">
                <span className="text-xs text-muted-foreground">{facet.slug}:</span>
                {facet.label || facet.value}
                <button
                  type="button"
                  onClick={() => handleRemove(facet.slug, facet.value)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">Classification Tips</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-inside list-disc">
          <li>Facets help readers discover your work through filtering</li>
          <li>Select values that accurately describe your research</li>
          <li>All facets are optional - add only what&apos;s relevant</li>
        </ul>
      </section>

      {form.formState.errors.facets && (
        <p className="text-sm text-destructive">{form.formState.errors.facets.message}</p>
      )}
    </div>
  );
}
