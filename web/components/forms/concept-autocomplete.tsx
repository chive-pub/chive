'use client';

/**
 * Concept autocomplete component.
 *
 * @remarks
 * Searches governance-controlled concepts in the knowledge graph.
 * Used for selecting document formats, publication statuses, platform types,
 * institution types, and other typed values.
 *
 * Includes fallback options for common values when the API has no data.
 *
 * @example
 * ```tsx
 * <ConceptAutocomplete
 *   category="platform-code"
 *   value={selectedConceptUri}
 *   onSelect={(concept) => {
 *     setValue('platformUri', concept.uri);
 *   }}
 * />
 * ```
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Tags, Search, Loader2, X, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks/use-eprint-search';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Concept categories matching subkinds in the knowledge graph.
 */
export type ConceptCategory =
  | 'institution-type'
  | 'paper-type'
  | 'document-format'
  | 'publication-status'
  | 'access-type'
  | 'platform-code'
  | 'platform-data'
  | 'platform-preprint'
  | 'platform-preregistration'
  | 'platform-protocol'
  | 'supplementary-type'
  | 'presentation-type'
  | 'license';

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
// CONFIGURATION
// =============================================================================

/**
 * Maps category to subkind slug.
 */
const CATEGORY_TO_SUBKIND: Record<ConceptCategory, string> = {
  'institution-type': 'institution-type',
  'paper-type': 'paper-type',
  'document-format': 'document-format',
  'publication-status': 'publication-status',
  'access-type': 'access-type',
  'platform-code': 'platform-code',
  'platform-data': 'platform-data',
  'platform-preprint': 'platform-preprint',
  'platform-preregistration': 'platform-preregistration',
  'platform-protocol': 'platform-protocol',
  'supplementary-type': 'supplementary-category',
  'presentation-type': 'presentation-type',
  license: 'license',
};

const CATEGORY_LABELS: Record<ConceptCategory, string> = {
  'institution-type': 'Institution Type',
  'paper-type': 'Paper Type',
  'document-format': 'Document Format',
  'publication-status': 'Publication Status',
  'access-type': 'Access Type',
  'platform-code': 'Code Platform',
  'platform-data': 'Data Repository',
  'platform-preprint': 'Preprint Server',
  'platform-preregistration': 'Preregistration Platform',
  'platform-protocol': 'Protocol Platform',
  'supplementary-type': 'Supplementary Type',
  'presentation-type': 'Presentation Type',
  license: 'License',
};

/**
 * Fallback options when API has no data.
 */
const FALLBACK_OPTIONS: Partial<Record<ConceptCategory, ConceptSuggestion[]>> = {
  'platform-code': [
    {
      id: 'github',
      uri: '',
      name: 'GitHub',
      description: 'Git hosting platform',
      category: 'platform-code',
      status: 'established',
    },
    {
      id: 'gitlab',
      uri: '',
      name: 'GitLab',
      description: 'DevOps platform with Git',
      category: 'platform-code',
      status: 'established',
    },
    {
      id: 'bitbucket',
      uri: '',
      name: 'Bitbucket',
      description: 'Git repository hosting',
      category: 'platform-code',
      status: 'established',
    },
    {
      id: 'sourceforge',
      uri: '',
      name: 'SourceForge',
      description: 'Open source software hosting',
      category: 'platform-code',
      status: 'established',
    },
    {
      id: 'codeberg',
      uri: '',
      name: 'Codeberg',
      description: 'Non-profit Git hosting',
      category: 'platform-code',
      status: 'established',
    },
    {
      id: 'huggingface',
      uri: '',
      name: 'Hugging Face',
      description: 'ML model and dataset hosting',
      category: 'platform-code',
      status: 'established',
    },
  ],
  'platform-data': [
    {
      id: 'zenodo',
      uri: '',
      name: 'Zenodo',
      description: 'Open research data repository',
      category: 'platform-data',
      status: 'established',
    },
    {
      id: 'figshare',
      uri: '',
      name: 'Figshare',
      description: 'Research data sharing',
      category: 'platform-data',
      status: 'established',
    },
    {
      id: 'dryad',
      uri: '',
      name: 'Dryad',
      description: 'Data repository for research',
      category: 'platform-data',
      status: 'established',
    },
    {
      id: 'dataverse',
      uri: '',
      name: 'Dataverse',
      description: 'Research data repository',
      category: 'platform-data',
      status: 'established',
    },
    {
      id: 'osf',
      uri: '',
      name: 'Open Science Framework',
      description: 'Research project management',
      category: 'platform-data',
      status: 'established',
    },
    {
      id: 'mendeley-data',
      uri: '',
      name: 'Mendeley Data',
      description: 'Research data storage',
      category: 'platform-data',
      status: 'established',
    },
  ],
  'platform-preprint': [
    {
      id: 'arxiv',
      uri: '',
      name: 'arXiv',
      description: 'Physics, math, CS preprints',
      category: 'platform-preprint',
      status: 'established',
    },
    {
      id: 'biorxiv',
      uri: '',
      name: 'bioRxiv',
      description: 'Biology preprints',
      category: 'platform-preprint',
      status: 'established',
    },
    {
      id: 'medrxiv',
      uri: '',
      name: 'medRxiv',
      description: 'Medical preprints',
      category: 'platform-preprint',
      status: 'established',
    },
    {
      id: 'ssrn',
      uri: '',
      name: 'SSRN',
      description: 'Social sciences research',
      category: 'platform-preprint',
      status: 'established',
    },
    {
      id: 'psyarxiv',
      uri: '',
      name: 'PsyArXiv',
      description: 'Psychology preprints',
      category: 'platform-preprint',
      status: 'established',
    },
    {
      id: 'chemrxiv',
      uri: '',
      name: 'ChemRxiv',
      description: 'Chemistry preprints',
      category: 'platform-preprint',
      status: 'established',
    },
    {
      id: 'eartharxiv',
      uri: '',
      name: 'EarthArXiv',
      description: 'Earth sciences preprints',
      category: 'platform-preprint',
      status: 'established',
    },
    {
      id: 'socarxiv',
      uri: '',
      name: 'SocArXiv',
      description: 'Social sciences preprints',
      category: 'platform-preprint',
      status: 'established',
    },
  ],
  'platform-preregistration': [
    {
      id: 'osf-registries',
      uri: '',
      name: 'OSF Registries',
      description: 'Open Science Framework registrations',
      category: 'platform-preregistration',
      status: 'established',
    },
    {
      id: 'aspredicted',
      uri: '',
      name: 'AsPredicted',
      description: 'Study preregistration',
      category: 'platform-preregistration',
      status: 'established',
    },
    {
      id: 'clinicaltrials',
      uri: '',
      name: 'ClinicalTrials.gov',
      description: 'Clinical trial registry',
      category: 'platform-preregistration',
      status: 'established',
    },
    {
      id: 'aea-registry',
      uri: '',
      name: 'AEA RCT Registry',
      description: 'Economics experiments registry',
      category: 'platform-preregistration',
      status: 'established',
    },
    {
      id: 'egap',
      uri: '',
      name: 'EGAP Registry',
      description: 'Social science experiments',
      category: 'platform-preregistration',
      status: 'established',
    },
  ],
  'platform-protocol': [
    {
      id: 'protocols-io',
      uri: '',
      name: 'protocols.io',
      description: 'Research protocols platform',
      category: 'platform-protocol',
      status: 'established',
    },
    {
      id: 'bio-protocol',
      uri: '',
      name: 'Bio-protocol',
      description: 'Life science protocols',
      category: 'platform-protocol',
      status: 'established',
    },
    {
      id: 'star-methods',
      uri: '',
      name: 'STAR Methods',
      description: 'Structured methods reporting',
      category: 'platform-protocol',
      status: 'established',
    },
  ],
  'presentation-type': [
    {
      id: 'poster',
      uri: '',
      name: 'Poster',
      description: 'Poster presentation',
      category: 'presentation-type',
      status: 'established',
    },
    {
      id: 'oral-presentation',
      uri: '',
      name: 'Oral Presentation',
      description: 'Talk or lecture',
      category: 'presentation-type',
      status: 'established',
    },
    {
      id: 'keynote',
      uri: '',
      name: 'Keynote',
      description: 'Featured presentation',
      category: 'presentation-type',
      status: 'established',
    },
    {
      id: 'workshop',
      uri: '',
      name: 'Workshop',
      description: 'Interactive session',
      category: 'presentation-type',
      status: 'established',
    },
    {
      id: 'panel',
      uri: '',
      name: 'Panel Discussion',
      description: 'Group discussion',
      category: 'presentation-type',
      status: 'established',
    },
    {
      id: 'lightning-talk',
      uri: '',
      name: 'Lightning Talk',
      description: 'Brief presentation',
      category: 'presentation-type',
      status: 'established',
    },
  ],
  'supplementary-type': [
    {
      id: 'dataset',
      uri: '',
      name: 'Dataset',
      description: 'Research data files',
      category: 'supplementary-type',
      status: 'established',
    },
    {
      id: 'code',
      uri: '',
      name: 'Code',
      description: 'Source code or scripts',
      category: 'supplementary-type',
      status: 'established',
    },
    {
      id: 'figure',
      uri: '',
      name: 'Figure',
      description: 'Supplementary figure',
      category: 'supplementary-type',
      status: 'established',
    },
    {
      id: 'table',
      uri: '',
      name: 'Table',
      description: 'Supplementary table',
      category: 'supplementary-type',
      status: 'established',
    },
    {
      id: 'video',
      uri: '',
      name: 'Video',
      description: 'Video content',
      category: 'supplementary-type',
      status: 'established',
    },
    {
      id: 'audio',
      uri: '',
      name: 'Audio',
      description: 'Audio content',
      category: 'supplementary-type',
      status: 'established',
    },
    {
      id: 'appendix',
      uri: '',
      name: 'Appendix',
      description: 'Additional text content',
      category: 'supplementary-type',
      status: 'established',
    },
  ],
};

// =============================================================================
// API SEARCH FUNCTION
// =============================================================================

/**
 * Maps category to kind in the knowledge graph.
 */
const CATEGORY_TO_KIND: Partial<Record<ConceptCategory, string>> = {
  license: 'object',
};

/**
 * Maps a node response to a ConceptSuggestion.
 */
function mapNodeToSuggestion(
  node: {
    id: string;
    uri: string;
    label: string;
    description?: string;
    subkind: string;
    status: string;
    externalIds?: Array<{ system: string; identifier: string }>;
  },
  category: ConceptCategory
): ConceptSuggestion {
  return {
    id: node.id,
    uri: node.uri,
    name: node.label,
    description: node.description,
    category: category,
    status: node.status as ConceptStatus,
    wikidataId: node.externalIds?.find((ext) => ext.system === 'wikidata')?.identifier,
    lcshId: node.externalIds?.find((ext) => ext.system === 'lcsh')?.identifier,
    fastId: node.externalIds?.find((ext) => ext.system === 'fast')?.identifier,
  };
}

/**
 * List all concepts of a category using the listNodes endpoint.
 */
async function listConcepts(category: ConceptCategory): Promise<ConceptSuggestion[]> {
  try {
    const subkind = CATEGORY_TO_SUBKIND[category] ?? category;
    const kind = CATEGORY_TO_KIND[category] ?? 'type';
    const params = new URLSearchParams({
      subkind,
      kind,
      limit: '50',
    });

    const url = `/xrpc/pub.chive.graph.listNodes?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.debug('Node list not available yet');
      return [];
    }

    const data = await response.json();
    return (data.nodes ?? []).map((node: Parameters<typeof mapNodeToSuggestion>[0]) =>
      mapNodeToSuggestion(node, category)
    );
  } catch (error) {
    console.debug('Node list failed:', error);
    return [];
  }
}

/**
 * Search concepts using unified node API.
 */
async function searchConcepts(
  query: string,
  category: ConceptCategory
): Promise<ConceptSuggestion[]> {
  // For categories without fallbacks (like license), use listNodes when query is empty
  const hasFallbacks = FALLBACK_OPTIONS[category] !== undefined;

  // If no query and no fallbacks, list all nodes of this category
  if (query.length < 2) {
    if (hasFallbacks) {
      return [];
    }
    // Use listNodes for categories without fallbacks
    return listConcepts(category);
  }

  try {
    const subkind = CATEGORY_TO_SUBKIND[category] ?? category;
    const kind = CATEGORY_TO_KIND[category] ?? 'type';
    const params = new URLSearchParams({
      subkind,
      kind,
      query,
    });

    const url = `/xrpc/pub.chive.graph.searchNodes?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.debug('Node search not available yet');
      return [];
    }

    const data = await response.json();
    return (data.nodes ?? []).map((node: Parameters<typeof mapNodeToSuggestion>[0]) =>
      mapNodeToSuggestion(node, category)
    );
  } catch (error) {
    console.debug('Node search failed:', error);
    return [];
  }
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<ConceptSuggestion | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Get fallback options for this category
  const fallbackOptions = useMemo(() => FALLBACK_OPTIONS[category] ?? [], [category]);
  const hasFallbacks = fallbackOptions.length > 0;

  // Search for concepts
  // For categories without fallbacks (like license), enable search even with empty query
  const {
    data: apiResults = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['concept-search', category, debouncedQuery],
    queryFn: () => searchConcepts(debouncedQuery, category),
    enabled: hasFallbacks ? debouncedQuery.length >= 2 : true,
    staleTime: 60 * 1000,
  });

  // Combine API results with filtered fallbacks
  const suggestions = useMemo(() => {
    const lowerQuery = query.toLowerCase();

    // If we have API results, use them
    if (apiResults.length > 0) {
      // Filter by query if provided
      if (query.length >= 1) {
        return apiResults.filter(
          (s) =>
            s.name.toLowerCase().includes(lowerQuery) || s.id.toLowerCase().includes(lowerQuery)
        );
      }
      return apiResults;
    }

    // Otherwise filter fallback options
    if (!query) {
      return fallbackOptions;
    }

    return fallbackOptions.filter(
      (s) => s.name.toLowerCase().includes(lowerQuery) || s.id.toLowerCase().includes(lowerQuery)
    );
  }, [apiResults, fallbackOptions, query]);

  // Update selected value when external value changes
  // Skip if selectedValue already matches (we just selected it via handleSelect)
  useEffect(() => {
    if (value) {
      // If selectedValue already matches this value, don't overwrite it
      // This preserves the name from handleSelect
      if (selectedValue && (selectedValue.id === value || selectedValue.uri === value)) {
        return;
      }

      // First check fallback options
      const fallbackMatch = fallbackOptions.find((f) => f.uri === value || f.id === value);
      if (fallbackMatch) {
        setSelectedValue(fallbackMatch);
        return;
      }

      // Then check API results
      const apiMatch = apiResults.find((r) => r.uri === value || r.id === value);
      if (apiMatch) {
        setSelectedValue(apiMatch);
        return;
      }

      // Fallback: create a display-friendly name from the ID
      const name = value.split('/').pop() ?? value;
      setSelectedValue({
        id: value,
        uri: value,
        name: name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        category,
        status: 'established',
      });
    } else {
      setSelectedValue(null);
    }
  }, [value, fallbackOptions, apiResults, category, selectedValue]);

  const handleSelect = useCallback(
    (suggestion: ConceptSuggestion) => {
      // Set selectedValue immediately so we preserve the full concept info (including name)
      setSelectedValue(suggestion);
      setQuery('');
      setIsOpen(false);
      onSelect(suggestion);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    setSelectedValue(null);
    setQuery('');
    onClear?.();
  }, [onClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    // For categories without fallbacks, refetch to ensure we have data
    if (!hasFallbacks) {
      refetch();
    }
  }, [hasFallbacks, refetch]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  }, []);

  const defaultPlaceholder = `Search ${CATEGORY_LABELS[category].toLowerCase()}...`;

  // Show selected value as badge
  if (selectedValue) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant="secondary" className="gap-1 py-1 pl-2 pr-1">
          <Tags className="h-3 w-3 text-muted-foreground" />
          <span>{selectedValue.name}</span>
          {selectedValue.wikidataId && (
            <a
              href={`https://www.wikidata.org/wiki/${selectedValue.wikidataId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
              title="View on Wikidata"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
            aria-label={`Remove ${selectedValue.name}`}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            id={id}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder ?? defaultPlaceholder}
            disabled={disabled}
            className="pl-9"
            aria-label={`Search ${CATEGORY_LABELS[category]}`}
          />
          {isLoading && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && suggestions.length === 0 && (
              <CommandEmpty className="py-3 text-center text-sm">
                No {CATEGORY_LABELS[category].toLowerCase()} found
              </CommandEmpty>
            )}

            {suggestions.length > 0 && (
              <CommandGroup heading={CATEGORY_LABELS[category]}>
                {suggestions.slice(0, 10).map((suggestion) => (
                  <CommandItem
                    key={suggestion.id}
                    value={suggestion.id}
                    onSelect={() => handleSelect(suggestion)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Tags className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{suggestion.name}</span>
                          {suggestion.wikidataId && (
                            <a
                              href={`https://www.wikidata.org/wiki/${suggestion.wikidataId}`}
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
                        {suggestion.description && (
                          <span className="text-xs text-muted-foreground ml-6 line-clamp-1">
                            {suggestion.description}
                          </span>
                        )}
                      </div>
                      {suggestion.status !== 'established' && (
                        <span className="text-xs text-amber-600 shrink-0">{suggestion.status}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
