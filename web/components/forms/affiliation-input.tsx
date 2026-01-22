'use client';

/**
 * Affiliation input with ROR autocomplete support.
 *
 * @remarks
 * Allows authors to add multiple institutional affiliations with optional
 * ROR (Research Organization Registry) identifiers for disambiguation.
 *
 * @example
 * ```tsx
 * <AffiliationInput
 *   affiliations={affiliations}
 *   onChange={setAffiliations}
 *   maxAffiliations={5}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, X, Building2, ExternalLink, Loader2 } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { logger } from '@/lib/observability';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const log = logger.child({ component: 'affiliation-input' });

// =============================================================================
// TYPES
// =============================================================================

/**
 * Author affiliation with optional ROR ID, Chive URI, and department.
 */
export interface AuthorAffiliation {
  /** Organization name */
  name: string;
  /** ROR ID (e.g., "https://ror.org/02mhbdp94") */
  rorId?: string;
  /** Chive institution AT-URI (if linked in knowledge graph) */
  institutionUri?: string;
  /** Department or division */
  department?: string;
}

/**
 * ROR API v2 response organization.
 */
interface RorOrganization {
  id: string;
  names: Array<{
    value: string;
    types: string[];
  }>;
  locations?: Array<{
    geonames_details?: {
      country_name?: string;
      country_code?: string;
    };
  }>;
  types?: string[];
}

/**
 * Chive institution from knowledge graph.
 */
interface ChiveInstitution {
  id: string;
  uri: string;
  name: string;
  country?: string;
  city?: string;
  ror?: string;
  status: string;
}

/**
 * Gets the display name from ROR v2 names array.
 * Prefers ror_display type, falls back to first name.
 */
function getRorDisplayName(org: RorOrganization): string {
  const displayName = org.names.find((n) => n.types.includes('ror_display'));
  return displayName?.value ?? org.names[0]?.value ?? 'Unknown';
}

/**
 * Gets the country name from ROR v2 locations array.
 */
function getRorCountryName(org: RorOrganization): string | undefined {
  return org.locations?.[0]?.geonames_details?.country_name;
}

/**
 * Props for AffiliationInput.
 */
export interface AffiliationInputProps {
  /** Current affiliations */
  affiliations: AuthorAffiliation[];

  /** Callback when affiliations change */
  onChange: (affiliations: AuthorAffiliation[]) => void;

  /** Maximum number of affiliations */
  maxAffiliations?: number;

  /** Disabled state */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Label for the input */
  label?: string;

  /** Help text */
  helpText?: string;
}

// =============================================================================
// DUAL-SOURCE SEARCH HOOK
// =============================================================================

/**
 * Search results from both sources.
 */
interface DualSourceResults {
  chiveInstitutions: ChiveInstitution[];
  rorOrganizations: RorOrganization[];
}

/**
 * Custom hook for searching both Chive institutions and ROR organizations.
 */
function useDualSourceSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DualSourceResults>({
    chiveInstitutions: [],
    rorOrganizations: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults({ chiveInstitutions: [], rorOrganizations: [] });
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    try {
      // Query both sources in parallel
      const [chiveResponse, rorResponse] = await Promise.allSettled([
        // Chive knowledge graph - using unified node search
        fetch(
          `/xrpc/pub.chive.graph.searchNodes?query=${encodeURIComponent(searchQuery)}&subkind=institution&kind=object&limit=5`,
          { signal: controller.signal }
        ),
        // ROR API (only if query is 3+ chars)
        searchQuery.length >= 3
          ? fetch(`https://api.ror.org/v2/organizations?query=${encodeURIComponent(searchQuery)}`, {
              signal: controller.signal,
            })
          : Promise.resolve(null),
      ]);

      // Parse Chive results - map unified node format to ChiveInstitution
      let chiveInstitutions: ChiveInstitution[] = [];
      if (chiveResponse.status === 'fulfilled' && chiveResponse.value?.ok) {
        const chiveData = await chiveResponse.value.json();
        chiveInstitutions = (chiveData.nodes ?? []).map(
          (node: {
            id: string;
            uri: string;
            label: string;
            metadata?: { country?: string; city?: string };
            externalIds?: Array<{ system: string; identifier: string }>;
            status: string;
          }) => ({
            id: node.id,
            uri: node.uri,
            name: node.label,
            country: node.metadata?.country,
            city: node.metadata?.city,
            ror: node.externalIds?.find((ext) => ext.system === 'ror')?.identifier,
            status: node.status,
          })
        );
      }

      // Parse ROR results
      let rorOrganizations: RorOrganization[] = [];
      if (rorResponse.status === 'fulfilled' && rorResponse.value?.ok) {
        const rorData = await rorResponse.value.json();
        rorOrganizations = rorData.items?.slice(0, 8) ?? [];
      }

      // Deduplicate: filter out ROR results that are already in Chive (by ROR ID)
      const chiveRorIds = new Set(chiveInstitutions.map((inst) => inst.ror).filter(Boolean));
      const filteredRor = rorOrganizations.filter((org) => !chiveRorIds.has(org.id));

      setResults({
        chiveInstitutions,
        rorOrganizations: filteredRor,
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        log.error('Institution search error', error, { query: searchQuery });
        setResults({ chiveInstitutions: [], rorOrganizations: [] });
      }
    } finally {
      setIsSearching(false);
    }
  }, 300);

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const hasResults = results.chiveInstitutions.length > 0 || results.rorOrganizations.length > 0;

  return {
    query,
    setQuery,
    results,
    hasResults,
    isSearching,
    clearResults: () => setResults({ chiveInstitutions: [], rorOrganizations: [] }),
  };
}

// =============================================================================
// AFFILIATION CARD
// =============================================================================

interface AffiliationCardProps {
  affiliation: AuthorAffiliation;
  index: number;
  onUpdate: (updates: Partial<AuthorAffiliation>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

function AffiliationCard({
  affiliation,
  index,
  onUpdate,
  onRemove,
  disabled,
}: AffiliationCardProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border bg-card p-3"
      data-testid={`affiliation-card-${index}`}
    >
      <Building2 className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{affiliation.name}</span>
          {affiliation.rorId && (
            <a
              href={affiliation.rorId}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" />
              ROR
            </a>
          )}
        </div>

        {/* Department input */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Department (optional)</label>
          <Input
            value={affiliation.department ?? ''}
            onChange={(e) => onUpdate({ department: e.target.value || undefined })}
            placeholder="e.g., Computer Science"
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label={`Remove ${affiliation.name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// ADD AFFILIATION FORM
// =============================================================================

interface AddAffiliationFormProps {
  onAdd: (affiliation: AuthorAffiliation) => void;
  disabled?: boolean;
}

function AddAffiliationForm({ onAdd, disabled }: AddAffiliationFormProps) {
  const { query, setQuery, results, hasResults, isSearching, clearResults } = useDualSourceSearch();
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectChiveInstitution = useCallback(
    (inst: ChiveInstitution) => {
      onAdd({
        name: inst.name,
        rorId: inst.ror ? `https://ror.org/${inst.ror}` : undefined,
        institutionUri: inst.uri,
        department: undefined,
      });
      setQuery('');
      clearResults();
      setShowResults(false);
    },
    [onAdd, setQuery, clearResults]
  );

  const handleSelectRorOrg = useCallback(
    (org: RorOrganization) => {
      onAdd({
        name: getRorDisplayName(org),
        rorId: org.id,
        institutionUri: undefined,
        department: undefined,
      });
      setQuery('');
      clearResults();
      setShowResults(false);
    },
    [onAdd, setQuery, clearResults]
  );

  const handleManualAdd = useCallback(() => {
    if (!query.trim()) return;

    onAdd({
      name: query.trim(),
      rorId: undefined,
      institutionUri: undefined,
      department: undefined,
    });
    setQuery('');
    clearResults();
    setShowResults(false);
  }, [query, onAdd, setQuery, clearResults]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Prefer Chive results, then ROR, then manual
        if (results.chiveInstitutions.length > 0) {
          handleSelectChiveInstitution(results.chiveInstitutions[0]);
        } else if (results.rorOrganizations.length > 0) {
          handleSelectRorOrg(results.rorOrganizations[0]);
        } else if (query.trim()) {
          handleManualAdd();
        }
      }
      if (e.key === 'Escape') {
        setShowResults(false);
      }
    },
    [results, query, handleSelectChiveInstitution, handleSelectRorOrg, handleManualAdd]
  );

  return (
    <div className="relative space-y-2" data-testid="add-affiliation-form">
      <div className="relative">
        <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => {
            // Delay to allow click on results
            setTimeout(() => setShowResults(false), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search organizations or enter manually..."
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Sectioned results dropdown */}
      {showResults && (hasResults || (query.trim().length >= 2 && !isSearching)) && (
        <div className="absolute z-50 w-full rounded-md border bg-popover shadow-md">
          <div className="max-h-72 overflow-y-auto">
            {/* Chive Institutions Section */}
            {results.chiveInstitutions.length > 0 && (
              <div>
                <div className="sticky top-0 bg-muted/80 px-2 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  Chive Institutions
                </div>
                <div className="p-1">
                  {results.chiveInstitutions.map((inst) => (
                    <button
                      key={inst.uri}
                      type="button"
                      onClick={() => handleSelectChiveInstitution(inst)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="font-medium">{inst.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[inst.city, inst.country].filter(Boolean).join(', ')}
                        {inst.ror && ' • ROR linked'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ROR Registry Section */}
            {results.rorOrganizations.length > 0 && (
              <div>
                <div className="sticky top-0 bg-muted/80 px-2 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  ROR Registry
                </div>
                <div className="p-1">
                  {results.rorOrganizations.map((org) => {
                    const displayName = getRorDisplayName(org);
                    const countryName = getRorCountryName(org);
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => handleSelectRorOrg(org)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      >
                        <span className="font-medium">{displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {countryName}
                          {org.types && org.types.length > 0 && ` • ${org.types.join(', ')}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Manual entry option */}
          {query.trim().length >= 2 && (
            <div className="border-t p-2">
              <button
                type="button"
                onClick={handleManualAdd}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-4 w-4" />
                <span>Add &quot;{query.trim()}&quot; manually</span>
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Search by organization name. Chive-linked institutions are preferred for better metadata.
      </p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Input for managing multiple affiliations with ROR autocomplete.
 */
export function AffiliationInput({
  affiliations,
  onChange,
  maxAffiliations = 5,
  disabled = false,
  className,
  label,
  helpText,
}: AffiliationInputProps) {
  const canAddMore = affiliations.length < maxAffiliations;

  const handleAdd = useCallback(
    (affiliation: AuthorAffiliation) => {
      if (affiliations.length >= maxAffiliations) return;
      onChange([...affiliations, affiliation]);
    },
    [affiliations, onChange, maxAffiliations]
  );

  const handleUpdate = useCallback(
    (index: number, updates: Partial<AuthorAffiliation>) => {
      const updated = [...affiliations];
      updated[index] = { ...updated[index], ...updates };
      onChange(updated);
    },
    [affiliations, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = affiliations.filter((_, i) => i !== index);
      onChange(updated);
    },
    [affiliations, onChange]
  );

  return (
    <div className={cn('space-y-3', className)} data-testid="affiliation-input">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      {/* Affiliation list */}
      {affiliations.length > 0 && (
        <div className="space-y-2">
          {affiliations.map((affiliation, index) => (
            <AffiliationCard
              key={`${affiliation.name}-${index}`}
              affiliation={affiliation}
              index={index}
              onUpdate={(updates) => handleUpdate(index, updates)}
              onRemove={() => handleRemove(index)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Add affiliation form */}
      {canAddMore && !disabled && <AddAffiliationForm onAdd={handleAdd} disabled={disabled} />}

      {/* Help text and count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {helpText && <span>{helpText}</span>}
        <span className="ml-auto">
          {affiliations.length}/{maxAffiliations} affiliations
        </span>
      </div>
    </div>
  );
}
