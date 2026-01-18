'use client';

/**
 * Facet selection step for eprint submission.
 *
 * @remarks
 * Step 6 of the submission wizard. Handles:
 * - PMEST/FAST faceted classification selection
 * - Document type (form-genre) selection
 * - Methodology (energy) selection
 * - Geographic scope (space) selection
 * - Time period (time) selection
 *
 * @packageDocumentation
 */

import { useCallback, useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Layers, Plus, X, ChevronDown, ChevronRight, Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FacetAutocomplete, type FacetSuggestion } from '@/components/forms/facet-autocomplete';
import type { FacetDimension } from '@/lib/api/schema';
import type { EprintFormValues } from './submission-wizard';

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
 * Internal facet value representation.
 */
interface FacetFormValue {
  type: FacetDimension;
  value: string;
  label?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * PMEST dimension metadata.
 */
const PMEST_DIMENSIONS: Array<{
  id: FacetDimension;
  label: string;
  description: string;
  examples: string;
}> = [
  {
    id: 'form-genre',
    label: 'Document Type',
    description: 'What type of document is this?',
    examples: 'Research article, review, preprint, thesis, conference paper',
  },
  {
    id: 'energy',
    label: 'Methodology',
    description: 'What research methods or approaches were used?',
    examples: 'Qualitative research, machine learning, meta-analysis, RCT',
  },
  {
    id: 'space',
    label: 'Geographic Scope',
    description: 'What geographic regions does this research focus on?',
    examples: 'Global, Europe, Southeast Asia, sub-Saharan Africa',
  },
  {
    id: 'time',
    label: 'Time Period',
    description: 'What time periods does this research cover?',
    examples: '21st century, Industrial Revolution, Cold War era',
  },
];

/**
 * Entity facet dimensions (less commonly used for paper classification).
 */
const ENTITY_DIMENSIONS: Array<{
  id: FacetDimension;
  label: string;
  description: string;
  examples: string;
}> = [
  {
    id: 'person',
    label: 'Person',
    description: 'Named individuals that are the subject of this research',
    examples: 'Historical figures, case study subjects',
  },
  {
    id: 'organization',
    label: 'Organization',
    description: 'Institutions or organizations that are the subject of this research',
    examples: 'Companies, government bodies, research institutions',
  },
  {
    id: 'event',
    label: 'Event',
    description: 'Named events that are the subject of this research',
    examples: 'Conferences, historical events, disasters',
  },
  {
    id: 'work',
    label: 'Work',
    description: 'Named works that are the subject of this research',
    examples: 'Books, films, artworks, datasets',
  },
];

// =============================================================================
// DIMENSION SECTION COMPONENT
// =============================================================================

interface DimensionSectionProps {
  dimension: {
    id: FacetDimension;
    label: string;
    description: string;
    examples: string;
  };
  values: FacetFormValue[];
  onAdd: (facet: FacetSuggestion) => void;
  onRemove: (value: string) => void;
  defaultOpen?: boolean;
}

function DimensionSection({
  dimension,
  values,
  onAdd,
  onRemove,
  defaultOpen = false,
}: DimensionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const dimensionValues = values.filter((v) => v.type === dimension.id);

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
            <span className="font-medium text-sm">{dimension.label}</span>
            {dimensionValues.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {dimensionValues.length}
              </Badge>
            )}
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3">
        <p className="text-sm text-muted-foreground">{dimension.description}</p>
        <p className="text-xs text-muted-foreground italic">Examples: {dimension.examples}</p>

        {/* Selected values */}
        {dimensionValues.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dimensionValues.map((facet) => (
              <Badge key={facet.value} variant="secondary" className="gap-1 py-1 px-2">
                {facet.label || facet.value}
                <button
                  type="button"
                  onClick={() => onRemove(facet.value)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add facet autocomplete */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="sr-only">Add {dimension.label}</Label>
            <FacetAutocomplete
              dimension={dimension.id}
              onSelect={onAdd}
              placeholder={`Search ${dimension.label.toLowerCase()}...`}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
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
  const watchedFacets = form.watch('facets');
  const facets = useMemo(() => watchedFacets ?? [], [watchedFacets]);

  const [showEntityFacets, setShowEntityFacets] = useState(false);

  // Handle facet addition
  const handleFacetAdd = useCallback(
    (suggestion: FacetSuggestion) => {
      // Check for duplicates
      if (facets.some((f) => f.value === suggestion.id)) {
        return;
      }

      const newFacet: FacetFormValue = {
        type: suggestion.dimension,
        value: suggestion.id,
        label: suggestion.label,
      };

      form.setValue('facets', [...facets, newFacet], {
        shouldValidate: true,
      });
    },
    [form, facets]
  );

  // Handle facet removal
  const handleFacetRemove = useCallback(
    (value: string) => {
      const updated = facets.filter((f) => f.value !== value);
      form.setValue('facets', updated, { shouldValidate: true });
    },
    [form, facets]
  );

  // Count facets by dimension
  const facetsByDimension = useMemo(() => {
    const counts: Partial<Record<FacetDimension, number>> = {};
    for (const facet of facets) {
      counts[facet.type] = (counts[facet.type] || 0) + 1;
    }
    return counts;
  }, [facets]);

  const totalPmestFacets =
    (facetsByDimension['form-genre'] || 0) +
    (facetsByDimension['energy'] || 0) +
    (facetsByDimension['space'] || 0) +
    (facetsByDimension['time'] || 0);

  return (
    <div className={cn('space-y-6', className)} data-testid="facets-step">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Faceted Classification
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add optional facets to improve discoverability. These categorize your work by document
          type, methodology, geographic scope, and time period.
        </p>
      </div>

      {/* PMEST Dimensions (main) */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Classification Dimensions</h4>
        {PMEST_DIMENSIONS.map((dimension) => (
          <DimensionSection
            key={dimension.id}
            dimension={dimension}
            values={facets}
            onAdd={handleFacetAdd}
            onRemove={handleFacetRemove}
            defaultOpen={dimension.id === 'form-genre'}
          />
        ))}
      </div>

      {/* Entity Facets (collapsible) */}
      <Collapsible open={showEntityFacets} onOpenChange={setShowEntityFacets}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between" type="button">
            <span className="text-sm">Entity Facets (Advanced)</span>
            {showEntityFacets ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Use these if your research specifically studies named persons, organizations, events, or
            works.
          </p>
          {ENTITY_DIMENSIONS.map((dimension) => (
            <DimensionSection
              key={dimension.id}
              dimension={dimension}
              values={facets}
              onAdd={handleFacetAdd}
              onRemove={handleFacetRemove}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Summary */}
      {facets.length > 0 && (
        <div className="rounded-lg border border-muted bg-muted/30 p-4">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Selected Facets ({facets.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {facets.map((facet) => (
              <Badge key={facet.value} variant="outline" className="gap-1">
                <span className="text-xs text-muted-foreground">{facet.type}:</span>
                {facet.label || facet.value}
                <button
                  type="button"
                  onClick={() => handleFacetRemove(facet.value)}
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
          <li>Document Type helps readers understand what kind of work this is</li>
          <li>Methodology facets help researchers find similar approaches</li>
          <li>Geographic and temporal facets are useful for area studies research</li>
          <li>All facets are optional - add only what&apos;s relevant</li>
        </ul>
      </section>

      {form.formState.errors.facets && (
        <p className="text-sm text-destructive">{form.formState.errors.facets.message}</p>
      )}
    </div>
  );
}
