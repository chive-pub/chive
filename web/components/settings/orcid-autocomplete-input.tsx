'use client';

/**
 * ORCID autocomplete input component.
 *
 * @remarks
 * Provides ORCID input with autocomplete search from ORCID registry.
 * Users can search by name to find their ORCID ID.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { Search, Loader2, ExternalLink, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrcidAutocomplete, type OrcidSuggestion } from '@/lib/hooks/use-profile-autocomplete';

export interface OrcidAutocompleteInputProps {
  /** Current ORCID value */
  value?: string;
  /** Handler for value changes */
  onChange: (value: string) => void;
  /** Additional class name */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Format ORCID for display.
 */
function formatOrcid(orcid: string): string {
  // ORCID format: 0000-0001-2345-6789
  if (orcid.includes('-')) {
    return orcid;
  }
  // Add dashes if not present
  return orcid.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dX])/, '$1-$2-$3-$4');
}

/**
 * ORCID autocomplete input with registry search.
 */
export function OrcidAutocompleteInput({
  value,
  onChange,
  className,
  disabled,
}: OrcidAutocompleteInputProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading } = useOrcidAutocomplete(searchQuery, {
    enabled: searchQuery.length >= 2 && open,
  });

  const suggestions = React.useMemo(() => data?.suggestions ?? [], [data?.suggestions]);

  const handleSelect = React.useCallback(
    (suggestion: OrcidSuggestion) => {
      onChange(suggestion.orcid);
      setSearchQuery('');
      setOpen(false);
    },
    [onChange]
  );

  const handleClear = React.useCallback(() => {
    onChange('');
    setSearchQuery('');
  }, [onChange]);

  // If value is set, show it formatted
  if (value) {
    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor="orcid">ORCID</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50">
            <a
              href={`https://orcid.org/${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
            >
              {formatOrcid(value)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="orcid">ORCID</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id="orcid"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length >= 2) {
                  setOpen(true);
                }
              }}
              onFocus={() => searchQuery.length >= 2 && setOpen(true)}
              placeholder="Search by name to find your ORCID..."
              className="pl-9"
              disabled={disabled}
              autoComplete="off"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[400px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {!isLoading && suggestions.length === 0 && searchQuery.length >= 2 && (
                <CommandEmpty className="py-6 text-center text-sm">
                  No ORCID profiles found for &quot;{searchQuery}&quot;
                </CommandEmpty>
              )}
              {suggestions.length > 0 && (
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.orcid}
                      value={suggestion.orcid}
                      onSelect={() => handleSelect(suggestion)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {suggestion.givenNames} {suggestion.familyName}
                        </span>
                        <span className="font-mono text-xs text-green-600 dark:text-green-400">
                          {formatOrcid(suggestion.orcid)}
                        </span>
                      </div>
                      {suggestion.affiliation && (
                        <span className="text-xs text-muted-foreground">
                          {suggestion.affiliation}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Search the ORCID registry by name to find and link your profile.
      </p>
    </div>
  );
}
