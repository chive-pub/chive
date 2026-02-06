'use client';

/**
 * Contribution type selector for CRediT-based author contributions.
 *
 * @remarks
 * Multi-select component for choosing contribution types from the CRediT
 * taxonomy with degree modifiers (lead/equal/supporting).
 *
 * @example
 * ```tsx
 * <ContributionTypeSelector
 *   selectedContributions={contributions}
 *   onChange={setContributions}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContributionDegrees } from '@/lib/hooks/use-nodes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CREDIT_TAXONOMY,
  CONTRIBUTION_DEGREES,
  type CreditType,
} from '@/lib/constants/credit-taxonomy';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Contribution degree modifier.
 *
 * @remarks
 * Degrees come from governance-controlled nodes with subkind 'contribution-degree'.
 * Common values: 'lead', 'equal', 'supporting'.
 */
export type ContributionDegree = string;

/**
 * Available contribution type from API.
 */
export interface ContributionType {
  /** AT-URI */
  uri: string;
  /** Type identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Description */
  description: string;
  /** Status */
  status: 'established' | 'provisional' | 'deprecated';
}

/**
 * Selected contribution with degree.
 */
export interface SelectedContribution {
  /** AT-URI to contribution type */
  typeUri: string;
  /** Type identifier */
  typeId: string;
  /** Human-readable label */
  typeLabel: string;
  /** Contribution degree */
  degree: ContributionDegree;
}

/**
 * Props for ContributionTypeSelector.
 */
export interface ContributionTypeSelectorProps {
  /** Currently selected contributions */
  selectedContributions: SelectedContribution[];

  /** Callback when contributions change */
  onChange: (contributions: SelectedContribution[]) => void;

  /** Available contribution types (from API) */
  contributionTypes?: ContributionType[];

  /** Loading state */
  isLoading?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Maximum contributions per author */
  maxContributions?: number;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// DEFAULT CREDIT TYPES (fallback if API not available)
// =============================================================================

/**
 * Default CRediT types mapped from shared taxonomy.
 */
const DEFAULT_CREDIT_TYPES: ContributionType[] = CREDIT_TAXONOMY.map(
  (t: CreditType): ContributionType => ({
    uri: t.uri,
    id: t.id,
    label: t.label,
    description: t.description,
    status: t.status,
  })
);

// =============================================================================
// DEGREE SELECTOR
// =============================================================================

interface DegreeSelectorProps {
  value: ContributionDegree;
  onChange: (degree: ContributionDegree) => void;
  disabled?: boolean;
}

// Use shared CONTRIBUTION_DEGREES from credit-taxonomy.ts

function DegreeSelector({ value, onChange, disabled }: DegreeSelectorProps) {
  const { data: degreesData } = useContributionDegrees();

  // Use fetched degrees or fallback to defaults
  const degrees = useMemo(() => {
    if (degreesData?.nodes && degreesData.nodes.length > 0) {
      return degreesData.nodes.map((node) => ({
        slug: node.metadata?.slug ?? node.id,
        label: node.label,
      }));
    }
    return [...CONTRIBUTION_DEGREES];
  }, [degreesData]);

  return (
    <Select value={value} onValueChange={onChange as (v: string) => void} disabled={disabled}>
      <SelectTrigger className="h-7 w-24 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {degrees.map((degree) => (
          <SelectItem key={degree.slug} value={degree.slug}>
            {degree.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// =============================================================================
// CONTRIBUTION CHIP
// =============================================================================

interface ContributionChipProps {
  contribution: SelectedContribution;
  onDegreeChange: (degree: ContributionDegree) => void;
  onRemove: () => void;
  disabled?: boolean;
}

function ContributionChip({
  contribution,
  onDegreeChange,
  onRemove,
  disabled,
}: ContributionChipProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1">
      <span className="text-sm font-medium">{contribution.typeLabel}</span>
      <DegreeSelector value={contribution.degree} onChange={onDegreeChange} disabled={disabled} />
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`Remove ${contribution.typeLabel}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Multi-select contribution type selector with degree modifiers.
 */
export function ContributionTypeSelector({
  selectedContributions,
  onChange,
  contributionTypes,
  isLoading = false,
  disabled = false,
  maxContributions = 14,
  className,
}: ContributionTypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Use provided types or defaults
  const types = useMemo(() => contributionTypes ?? DEFAULT_CREDIT_TYPES, [contributionTypes]);

  // Filter types based on search and exclude already selected
  const filteredTypes = useMemo(() => {
    const selectedIds = new Set(selectedContributions.map((c) => c.typeId));
    return types.filter((type) => {
      if (selectedIds.has(type.id)) return false;
      if (type.status === 'deprecated') return false;
      if (!search.trim()) return true;
      const searchLower = search.toLowerCase();
      return (
        type.label.toLowerCase().includes(searchLower) ||
        type.description.toLowerCase().includes(searchLower)
      );
    });
  }, [types, selectedContributions, search]);

  // Add contribution
  const handleSelect = useCallback(
    (type: ContributionType) => {
      if (selectedContributions.length >= maxContributions) return;

      const newContribution: SelectedContribution = {
        typeUri: type.uri,
        typeId: type.id,
        typeLabel: type.label,
        degree: 'equal', // Default to equal
      };

      onChange([...selectedContributions, newContribution]);
      setSearch('');
    },
    [selectedContributions, onChange, maxContributions]
  );

  // Update degree
  const handleDegreeChange = useCallback(
    (index: number, degree: ContributionDegree) => {
      const updated = [...selectedContributions];
      updated[index] = { ...updated[index], degree };
      onChange(updated);
    },
    [selectedContributions, onChange]
  );

  // Remove contribution
  const handleRemove = useCallback(
    (index: number) => {
      const updated = selectedContributions.filter((_, i) => i !== index);
      onChange(updated);
    },
    [selectedContributions, onChange]
  );

  return (
    <div className={cn('space-y-2', className)} data-testid="contribution-type-selector">
      {/* Selected contributions */}
      {selectedContributions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedContributions.map((contribution, index) => (
            <ContributionChip
              key={contribution.typeId}
              contribution={contribution}
              onDegreeChange={(degree) => handleDegreeChange(index, degree)}
              onRemove={() => handleRemove(index)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Add button with dropdown */}
      {selectedContributions.length < maxContributions && !disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={isLoading}
            >
              Add contribution
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            {/* Search input */}
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contribution types..."
                  className="h-9 pl-8"
                />
              </div>
            </div>

            {/* Type list */}
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredTypes.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No contribution types found
                </div>
              ) : (
                filteredTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleSelect(type)}
                    className="relative flex w-full cursor-default select-none flex-col items-start gap-1 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{type.label}</span>
                      {type.status === 'provisional' && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          Provisional
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {type.description}
                    </span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Help text */}
      {selectedContributions.length === 0 && !disabled && (
        <p className="text-xs text-muted-foreground">
          Select contribution types based on the CRediT taxonomy
        </p>
      )}
    </div>
  );
}
