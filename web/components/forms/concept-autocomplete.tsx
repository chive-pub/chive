'use client';

/**
 * Concept autocomplete component.
 *
 * @remarks
 * Searches governance-controlled concepts in the knowledge graph.
 * Used for selecting document formats, publication statuses, platform types,
 * institution types, and other typed values.
 *
 * @example
 * ```tsx
 * <ConceptAutocomplete
 *   category="document-format"
 *   value={selectedConceptUri}
 *   onSelect={(concept) => {
 *     setValue('documentFormat', concept.uri);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useCallback } from 'react';
import { Tags, ExternalLink } from 'lucide-react';

import { AutocompleteInput } from './autocomplete-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Concept categories matching the backend schema.
 */
export type ConceptCategory =
  | 'institution-type'
  | 'paper-type'
  | 'methodology'
  | 'geographic-scope'
  | 'temporal-scope'
  | 'document-format'
  | 'publication-status'
  | 'access-type'
  | 'platform-code'
  | 'platform-data'
  | 'platform-preprint'
  | 'platform-preregistration'
  | 'platform-protocol'
  | 'supplementary-type'
  | 'researcher-type'
  | 'identifier-type'
  | 'presentation-type';

/**
 * Concept status.
 */
export type ConceptStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * Concept suggestion from search results.
 */
export interface ConceptSuggestion {
  /** Concept identifier */
  id: string;
  /** Concept AT-URI */
  uri: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Concept category */
  category: ConceptCategory;
  /** Concept status */
  status: ConceptStatus;
  /** Wikidata identifier */
  wikidataId?: string;
  /** LCSH identifier */
  lcshId?: string;
  /** FAST identifier */
  fastId?: string;
  /** Parent concept URI */
  parentConceptUri?: string;
}

/**
 * Props for ConceptAutocomplete component.
 */
export interface ConceptAutocompleteProps {
  /** Filter to specific category (required) */
  category: ConceptCategory;
  /** Current selected concept URI */
  value?: string;
  /** Called when a concept is selected */
  onSelect: (concept: ConceptSuggestion) => void;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Input ID for accessibility */
  id?: string;
}

// =============================================================================
// API
// =============================================================================

/**
 * Maps category to subkind slug.
 * In the unified model, categories are now subkinds.
 */
const CATEGORY_TO_SUBKIND: Record<ConceptCategory, string> = {
  'institution-type': 'institution-type',
  'paper-type': 'paper-type',
  methodology: 'methodology',
  'geographic-scope': 'geographic-scope',
  'temporal-scope': 'temporal-scope',
  'document-format': 'document-format',
  'publication-status': 'publication-status',
  'access-type': 'access-type',
  'platform-code': 'platform-code',
  'platform-data': 'platform-data',
  'platform-preprint': 'platform-preprint',
  'platform-preregistration': 'platform-preregistration',
  'platform-protocol': 'platform-protocol',
  'supplementary-type': 'supplementary-category',
  'researcher-type': 'researcher-type',
  'identifier-type': 'identifier-type',
  'presentation-type': 'presentation-type',
};

/**
 * Search concepts using unified node API.
 *
 * @remarks
 * Searches the knowledge graph for nodes matching the query with specific subkind.
 *
 * @param query - Search query
 * @param category - Category filter (maps to subkind)
 * @returns Array of concept suggestions
 */
async function searchConcepts(
  query: string,
  category: ConceptCategory
): Promise<ConceptSuggestion[]> {
  if (query.length < 2) return [];

  try {
    // Build URL with parameters - use unified node search
    const subkind = CATEGORY_TO_SUBKIND[category] ?? category;
    const params = new URLSearchParams({
      query,
      subkind,
      kind: 'type',
    });

    const url = `/xrpc/pub.chive.graph.searchNodes?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      // API may not exist yet - return empty
      console.debug('Node search not available yet');
      return [];
    }

    const data = await response.json();
    // Map unified node response to ConceptSuggestion format
    return (data.nodes ?? []).map(
      (node: {
        id: string;
        uri: string;
        label: string;
        description?: string;
        subkind: string;
        status: string;
        externalIds?: Array<{ system: string; identifier: string }>;
      }) => ({
        id: node.id,
        uri: node.uri,
        name: node.label,
        description: node.description,
        category: category,
        status: node.status as ConceptStatus,
        wikidataId: node.externalIds?.find((ext) => ext.system === 'wikidata')?.identifier,
        lcshId: node.externalIds?.find((ext) => ext.system === 'lcsh')?.identifier,
        fastId: node.externalIds?.find((ext) => ext.system === 'fast')?.identifier,
      })
    ) as ConceptSuggestion[];
  } catch (error) {
    // API not implemented yet
    console.debug('Node search failed:', error);
    return [];
  }
}

// =============================================================================
// CATEGORY LABELS
// =============================================================================

const CATEGORY_LABELS: Record<ConceptCategory, string> = {
  'institution-type': 'Institution Type',
  'paper-type': 'Paper Type',
  methodology: 'Methodology',
  'geographic-scope': 'Geographic Scope',
  'temporal-scope': 'Temporal Scope',
  'document-format': 'Document Format',
  'publication-status': 'Publication Status',
  'access-type': 'Access Type',
  'platform-code': 'Code Platform',
  'platform-data': 'Data Repository',
  'platform-preprint': 'Preprint Server',
  'platform-preregistration': 'Preregistration Platform',
  'platform-protocol': 'Protocol Platform',
  'supplementary-type': 'Supplementary Type',
  'researcher-type': 'Researcher Type',
  'identifier-type': 'Identifier Type',
  'presentation-type': 'Presentation Type',
};

/**
 * Category descriptions for empty states.
 */
const CATEGORY_DESCRIPTIONS: Record<ConceptCategory, string> = {
  'institution-type': 'university, research institute, laboratory, etc.',
  'paper-type': 'article, preprint, review, book chapter, etc.',
  methodology: 'qualitative, quantitative, mixed methods, etc.',
  'geographic-scope': 'global, regional, national, etc.',
  'temporal-scope': 'contemporary, historical, longitudinal, etc.',
  'document-format': 'PDF, LaTeX, Jupyter notebook, etc.',
  'publication-status': 'preprint, under review, published, etc.',
  'access-type': 'open access, green OA, gold OA, etc.',
  'platform-code': 'GitHub, GitLab, Bitbucket, SourceForge, etc.',
  'platform-data': 'Zenodo, Figshare, Dryad, Dataverse, etc.',
  'platform-preprint': 'arXiv, bioRxiv, medRxiv, SSRN, etc.',
  'platform-preregistration': 'OSF, AsPredicted, AEA Registry, etc.',
  'platform-protocol': 'protocols.io, STAR Methods, Bio-protocol, etc.',
  'supplementary-type': 'dataset, code, video, figure, etc.',
  'researcher-type': 'faculty, postdoc, PhD student, etc.',
  'identifier-type': 'DOI, arXiv ID, PMID, etc.',
  'presentation-type': 'poster, talk, keynote, workshop, etc.',
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Autocomplete input for governance concepts.
 *
 * @param props - Component props
 * @returns Concept autocomplete element
 */
export function ConceptAutocomplete({
  category,
  value,
  onSelect,
  onClear,
  placeholder,
  disabled = false,
  className,
  id,
}: ConceptAutocompleteProps) {
  // Create search function with category filter
  const searchFn = useCallback((query: string) => searchConcepts(query, category), [category]);

  // Generate placeholder based on category
  const defaultPlaceholder = `Search ${CATEGORY_LABELS[category].toLowerCase()}...`;

  const renderItem = useCallback(
    (item: ConceptSuggestion, isSelected: boolean) => (
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={isSelected ? 'font-medium' : ''}>{item.name}</span>
            {item.wikidataId && (
              <a
                href={`https://www.wikidata.org/wiki/${item.wikidataId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
                onClick={(e) => e.stopPropagation()}
                title="View on Wikidata"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1 ml-6">
              {item.description}
            </p>
          )}
        </div>
        {item.status !== 'established' && (
          <span className="text-xs text-amber-600 shrink-0">{item.status}</span>
        )}
      </div>
    ),
    []
  );

  return (
    <AutocompleteInput<ConceptSuggestion>
      id={id}
      placeholder={placeholder ?? defaultPlaceholder}
      groupLabel={CATEGORY_LABELS[category]}
      queryFn={searchFn}
      queryKeyPrefix={`concept-search-${category}`}
      onSelect={onSelect}
      onClear={onClear}
      renderItem={renderItem}
      getItemKey={(item) => item.uri}
      getItemValue={(item) => item.name}
      initialValue=""
      minChars={2}
      debounceMs={300}
      staleTime={60 * 1000} // Concepts are more stable than facets
      emptyMessage={`No ${CATEGORY_LABELS[category].toLowerCase()} concepts found. Examples: ${CATEGORY_DESCRIPTIONS[category]}`}
      disabled={disabled}
      clearable
      className={className}
    />
  );
}
