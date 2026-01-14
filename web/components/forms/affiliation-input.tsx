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

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Author affiliation with optional ROR ID and department.
 */
export interface AuthorAffiliation {
  /** Organization name */
  name: string;
  /** ROR ID (e.g., "https://ror.org/02mhbdp94") */
  rorId?: string;
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
// ROR SEARCH HOOK
// =============================================================================

/**
 * Custom hook for searching ROR organizations.
 */
function useRorSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RorOrganization[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setResults([]);
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
      const response = await fetch(
        `https://api.ror.org/v2/organizations?query=${encodeURIComponent(searchQuery)}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error('ROR search failed');
      }

      const data = await response.json();
      setResults(data.items?.slice(0, 8) ?? []);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('ROR search error:', error);
        setResults([]);
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

  return {
    query,
    setQuery,
    results,
    isSearching,
    clearResults: () => setResults([]),
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
  const { query, setQuery, results, isSearching, clearResults } = useRorSearch();
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectOrg = useCallback(
    (org: RorOrganization) => {
      onAdd({
        name: getRorDisplayName(org),
        rorId: org.id,
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
        if (results.length > 0) {
          handleSelectOrg(results[0]);
        } else if (query.trim()) {
          handleManualAdd();
        }
      }
      if (e.key === 'Escape') {
        setShowResults(false);
      }
    },
    [results, query, handleSelectOrg, handleManualAdd]
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

      {/* ROR Results dropdown */}
      {showResults && (results.length > 0 || (query.trim().length >= 3 && !isSearching)) && (
        <div className="absolute z-50 w-full rounded-md border bg-popover shadow-md">
          {results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto p-1">
              {results.map((org) => {
                const displayName = getRorDisplayName(org);
                const countryName = getRorCountryName(org);
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => handleSelectOrg(org)}
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
          ) : null}

          {/* Manual entry option */}
          {query.trim().length >= 3 && (
            <div className="border-t p-2">
              <button
                type="button"
                onClick={handleManualAdd}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-4 w-4" />
                <span>Add &quot;{query.trim()}&quot; without ROR</span>
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Search by organization name for automatic ROR linking, or enter manually
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
