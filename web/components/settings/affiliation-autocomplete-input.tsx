'use client';

/**
 * Affiliation autocomplete input component.
 *
 * @remarks
 * Provides institutional affiliation input with ROR API autocomplete.
 * Selected affiliations include ROR IDs for authority linking.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { useMemo } from 'react';
import { Plus, X, Loader2, Building2, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useAffiliationAutocomplete,
  type AffiliationSuggestion,
} from '@/lib/hooks/use-profile-autocomplete';
import type { Affiliation } from '@/lib/api/schema';

export interface AffiliationAutocompleteInputProps {
  /** Label for the input */
  label: string;
  /** Current affiliations */
  values: Affiliation[];
  /** Handler for value changes */
  onChange: (values: Affiliation[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum number of items */
  maxItems?: number;
  /** Description text */
  description?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Affiliation autocomplete input with ROR integration.
 */
export function AffiliationAutocompleteInput({
  label,
  values,
  onChange,
  placeholder = 'Search institutions...',
  maxItems,
  description,
  className,
}: AffiliationAutocompleteInputProps) {
  const [inputValue, setInputValue] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading } = useAffiliationAutocomplete(inputValue, {
    enabled: inputValue.length >= 2,
  });

  const suggestions = useMemo(() => data?.suggestions ?? [], [data?.suggestions]);
  const shouldShowDropdown = open && inputValue.length >= 2;

  const handleSelect = React.useCallback(
    (suggestion: AffiliationSuggestion) => {
      // Check for duplicates
      if (values.some((v) => v.rorId === suggestion.rorId || v.name === suggestion.name)) {
        return;
      }

      // Check max items
      if (maxItems && values.length >= maxItems) {
        return;
      }

      onChange([...values, { name: suggestion.name, rorId: suggestion.rorId }]);
      setInputValue('');
      setOpen(false);
      inputRef.current?.focus();
    },
    [values, onChange, maxItems]
  );

  const handleAddFreeText = React.useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Check for duplicates
    if (values.some((v) => v.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    // Check max items
    if (maxItems && values.length >= maxItems) {
      return;
    }

    onChange([...values, { name: trimmed }]);
    setInputValue('');
    setOpen(false);
  }, [inputValue, values, onChange, maxItems]);

  const handleRemove = React.useCallback(
    (index: number) => {
      onChange(values.filter((_, i) => i !== index));
    },
    [values, onChange]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions.length > 0) {
          handleSelect(suggestions[0]);
        } else if (inputValue.trim()) {
          handleAddFreeText();
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [suggestions, handleSelect, inputValue, handleAddFreeText]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}

      <Popover open={shouldShowDropdown} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (e.target.value.length >= 2) {
                    setOpen(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => inputValue.length >= 2 && setOpen(true)}
                placeholder={placeholder}
                className="pl-9"
                disabled={maxItems !== undefined && values.length >= maxItems}
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddFreeText}
              disabled={!inputValue.trim() || (maxItems !== undefined && values.length >= maxItems)}
              title="Add as free text"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {isLoading && suggestions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  <p className="mt-2">Searching ROR...</p>
                </div>
              ) : suggestions.length === 0 ? (
                <CommandEmpty>
                  <div className="text-center">
                    <p>No institutions found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Press Enter to add &quot;{inputValue}&quot; as free text
                    </p>
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.rorId}
                      value={suggestion.rorId}
                      onSelect={() => handleSelect(suggestion)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <span className="text-sm font-medium">{suggestion.name}</span>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          ROR
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{suggestion.country}</span>
                        {suggestion.acronym && (
                          <>
                            <span>•</span>
                            <span>{suggestion.acronym}</span>
                          </>
                        )}
                        {suggestion.types.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{suggestion.types.join(', ')}</span>
                          </>
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

      {/* Selected affiliations */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map((affiliation, index) => (
            <Badge key={index} variant="secondary" className="gap-1 py-1 px-2">
              {affiliation.name}
              {affiliation.rorId && (
                <a
                  href={affiliation.rorId}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                  title="View on ROR"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {maxItems && (
        <p className="text-xs text-muted-foreground">
          {values.length}/{maxItems} items
        </p>
      )}
    </div>
  );
}
