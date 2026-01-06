'use client';

/**
 * Field search component with autocomplete.
 *
 * @remarks
 * Provides a search interface for selecting knowledge graph fields.
 * Uses the same Command/Popover pattern as TagInput for consistency.
 *
 * @example
 * ```tsx
 * <FieldSearch
 *   selectedFields={fields}
 *   onFieldAdd={handleAdd}
 *   onFieldRemove={handleRemove}
 *   maxFields={10}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, Loader2, X, ChevronRight } from 'lucide-react';

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
import { useFields } from '@/lib/hooks/use-field';
import type { FieldSummary } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Field reference for form state.
 */
export interface FieldSelection {
  /** Field ID */
  id: string;
  /** Field name for display */
  name: string;
  /** Optional description */
  description?: string;
}

/**
 * Props for FieldSearch component.
 */
export interface FieldSearchProps {
  /** Currently selected fields */
  selectedFields: FieldSelection[];

  /** Callback when field is added */
  onFieldAdd: (field: FieldSelection) => void;

  /** Callback when field is removed */
  onFieldRemove: (field: FieldSelection) => void;

  /** Maximum number of fields allowed (default: 10) */
  maxFields?: number;

  /** Placeholder text */
  placeholder?: string;

  /** Disabled state */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Label for the field list */
  label?: string;

  /** Help text displayed below input */
  helpText?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Search and select knowledge graph fields with autocomplete.
 *
 * @param props - Component props
 * @returns Field search element
 */
export function FieldSearch({
  selectedFields,
  onFieldAdd,
  onFieldRemove,
  maxFields = 10,
  placeholder = 'Search for a field...',
  disabled = false,
  className,
  label,
  helpText,
}: FieldSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Fetch fields, using approved status by default.
  const { data: fieldsData, isLoading } = useFields({
    status: 'approved',
    limit: 50,
  });

  const selectedIds = useMemo(() => new Set(selectedFields.map((f) => f.id)), [selectedFields]);
  const canAddMore = selectedFields.length < maxFields;

  // Filter fields based on query and exclude already selected
  const filteredFields = (fieldsData?.fields ?? []).filter((field) => {
    if (selectedIds.has(field.id)) return false;
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    return (
      field.name.toLowerCase().includes(lowerQuery) ||
      field.description?.toLowerCase().includes(lowerQuery)
    );
  });

  const handleAddField = useCallback(
    (field: FieldSummary) => {
      if (!canAddMore) return;
      if (selectedIds.has(field.id)) return;

      onFieldAdd({
        id: field.id,
        name: field.name,
        description: field.description,
      });
      setQuery('');
      setIsOpen(false);
    },
    [canAddMore, selectedIds, onFieldAdd]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  // Open popover when typing
  useEffect(() => {
    if (query.length >= 1) {
      setIsOpen(true);
    }
  }, [query]);

  return (
    <div className={cn('space-y-3', className)} data-testid="field-search">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}

      {/* Selected fields */}
      {selectedFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedFields.map((field) => (
            <Badge
              key={field.id}
              variant="secondary"
              className="gap-1 py-1 pl-2 pr-1"
              data-testid="selected-field"
            >
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span>{field.name}</span>
              <button
                type="button"
                onClick={() => onFieldRemove(field)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                aria-label={`Remove ${field.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input with autocomplete */}
      {canAddMore && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                className="pl-9"
                aria-label="Field search"
              />
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

                {!isLoading && filteredFields.length === 0 && (
                  <CommandEmpty className="py-3 text-center text-sm">
                    No fields found matching &quot;{query}&quot;
                  </CommandEmpty>
                )}

                {filteredFields.length > 0 && (
                  <CommandGroup heading="Fields">
                    {filteredFields.slice(0, 10).map((field) => (
                      <CommandItem
                        key={field.id}
                        value={field.id}
                        onSelect={() => handleAddField(field)}
                        className="cursor-pointer"
                        data-testid="field-suggestion"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{field.name}</span>
                          {field.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {field.description}
                            </span>
                          )}
                        </div>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {field.preprintCount} preprints
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Help text and count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {helpText && <span>{helpText}</span>}
        <span className="ml-auto">
          {selectedFields.length}/{maxFields} fields
        </span>
      </div>
    </div>
  );
}
