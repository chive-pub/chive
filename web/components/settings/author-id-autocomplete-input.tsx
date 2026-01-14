'use client';

/**
 * Author ID autocomplete input component.
 *
 * @remarks
 * Provides author ID input with autocomplete from various academic databases.
 * Uses direct API calls to each service for author search.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { Search, Loader2, ExternalLink, X, Building2 } from 'lucide-react';

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
import {
  useSemanticScholarAutocomplete,
  useOpenAlexAutocomplete,
  useDblpAutocomplete,
  useOpenReviewAutocomplete,
  type SemanticScholarAuthor,
  type OpenAlexAuthor,
  type DblpAuthor,
  type OpenReviewSuggestion,
} from '@/lib/hooks/use-profile-autocomplete';

export type AuthorIdType =
  | 'semanticScholar'
  | 'openAlex'
  | 'dblp'
  | 'googleScholar'
  | 'openReview'
  | 'scopus';

interface AuthorIdConfig {
  label: string;
  placeholder: string;
  urlPrefix: string;
  formatId?: (id: string) => string;
  description: string;
}

const authorIdConfigs: Record<AuthorIdType, AuthorIdConfig> = {
  semanticScholar: {
    label: 'Semantic Scholar ID',
    placeholder: 'Search by name to find your profile...',
    urlPrefix: 'https://www.semanticscholar.org/author/',
    description: 'Search Semantic Scholar by name',
  },
  openAlex: {
    label: 'OpenAlex ID',
    placeholder: 'Search by name to find your profile...',
    urlPrefix: 'https://openalex.org/authors/',
    description: 'Search OpenAlex by name',
  },
  dblp: {
    label: 'DBLP ID',
    placeholder: 'Search by name to find your profile...',
    urlPrefix: 'https://dblp.org/pid/',
    description: 'Search DBLP by name',
  },
  googleScholar: {
    label: 'Google Scholar ID',
    placeholder: 'Paste your Google Scholar profile URL...',
    urlPrefix: 'https://scholar.google.com/citations?user=',
    description: 'Copy from your Google Scholar profile URL',
  },
  openReview: {
    label: 'OpenReview ID',
    placeholder: 'Search by name to find your profile...',
    urlPrefix: 'https://openreview.net/profile?id=',
    description: 'Search OpenReview by name',
  },
  scopus: {
    label: 'Scopus Author ID',
    placeholder: 'Enter your Scopus author identifier...',
    urlPrefix: 'https://www.scopus.com/authid/detail.uri?authorId=',
    description: 'Find this on your Scopus author page',
  },
};

/** Unified author match type for display */
interface UnifiedAuthorMatch {
  id: string;
  displayName: string;
  institution: string | null;
  worksCount: number;
  citedByCount: number;
}

export interface AuthorIdAutocompleteInputProps {
  /** Type of author ID */
  idType: AuthorIdType;
  /** Current ID value */
  value?: string;
  /** Handler for value changes */
  onChange: (value: string) => void;
  /** Display name for initial search */
  displayName?: string;
  /** Additional class name */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Format large numbers with abbreviations.
 */
function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Extract ID from URL for services without API.
 */
function extractIdFromUrl(idType: AuthorIdType, input: string): string | null {
  const config = authorIdConfigs[idType];

  // If it's already just an ID, return it
  if (!input.includes('://') && !input.includes('/')) {
    return input;
  }

  // Try to extract from URL
  if (idType === 'googleScholar') {
    // Google Scholar URL: https://scholar.google.com/citations?user=XXXXXXXX
    const match = input.match(/[?&]user=([^&]+)/);
    return match ? match[1] : null;
  }

  if (idType === 'openReview') {
    // OpenReview: https://openreview.net/profile?id=~Name_1
    const match = input.match(/[?&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  if (idType === 'scopus') {
    // Scopus: https://www.scopus.com/authid/detail.uri?authorId=12345678
    const match = input.match(/authorId=(\d+)/);
    return match ? match[1] : null;
  }

  // For other types, try to extract from the URL path
  if (input.includes(config.urlPrefix)) {
    return input.replace(config.urlPrefix, '').split(/[?#]/)[0];
  }

  return input;
}

/**
 * Transform Semantic Scholar results to unified format.
 */
function transformSemanticScholar(authors: SemanticScholarAuthor[]): UnifiedAuthorMatch[] {
  return authors.map((author) => ({
    id: author.authorId,
    displayName: author.name,
    institution: author.affiliations?.[0] ?? null,
    worksCount: author.paperCount,
    citedByCount: author.citationCount,
  }));
}

/**
 * Transform OpenAlex results to unified format.
 */
function transformOpenAlex(authors: OpenAlexAuthor[]): UnifiedAuthorMatch[] {
  return authors.map((author) => ({
    id: author.id.replace('https://openalex.org/', ''),
    displayName: author.display_name,
    institution: author.last_known_institution?.display_name ?? null,
    worksCount: author.works_count,
    citedByCount: author.cited_by_count,
  }));
}

/**
 * Extract PID from DBLP URL.
 * URL format: https://dblp.org/pid/234/3480 or https://dblp.org/pid/s/JohnRSmith
 */
function extractDblpPid(url: string): string {
  const match = url.match(/dblp\.org\/pid\/(.+)$/);
  return match ? match[1] : url;
}

/**
 * Extract affiliation from DBLP notes.
 */
function extractDblpAffiliation(notes?: DblpAuthor['notes']): string | null {
  if (!notes?.note) return null;
  const noteArray = Array.isArray(notes.note) ? notes.note : [notes.note];
  const affiliation = noteArray.find((n) => n['@type'] === 'affiliation');
  return affiliation?.text ?? null;
}

/**
 * Transform DBLP results to unified format.
 */
function transformDblp(hits: Array<{ info: DblpAuthor }>): UnifiedAuthorMatch[] {
  return hits.map((hit) => ({
    id: extractDblpPid(hit.info.url),
    displayName: hit.info.author,
    institution: extractDblpAffiliation(hit.info.notes),
    worksCount: 0, // DBLP doesn't provide counts in search
    citedByCount: 0,
  }));
}

/**
 * Transform OpenReview results to unified format.
 */
function transformOpenReview(suggestions: OpenReviewSuggestion[]): UnifiedAuthorMatch[] {
  return suggestions.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    institution: s.institution,
    worksCount: 0,
    citedByCount: 0,
  }));
}

/**
 * Author ID autocomplete input with direct service API calls.
 */
export function AuthorIdAutocompleteInput({
  idType,
  value,
  onChange,
  displayName = '',
  className,
  disabled,
}: AuthorIdAutocompleteInputProps) {
  const config = authorIdConfigs[idType];
  const supportsDiscovery = ['semanticScholar', 'openAlex', 'dblp', 'openReview'].includes(idType);

  const [searchQuery, setSearchQuery] = React.useState(displayName);
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Service-specific hooks - only one will be active based on idType
  const semanticScholarQuery = useSemanticScholarAutocomplete(searchQuery, {
    enabled: idType === 'semanticScholar' && open && searchQuery.length >= 2,
  });

  const openAlexQuery = useOpenAlexAutocomplete(searchQuery, {
    enabled: idType === 'openAlex' && open && searchQuery.length >= 2,
  });

  const dblpQuery = useDblpAutocomplete(searchQuery, {
    enabled: idType === 'dblp' && open && searchQuery.length >= 2,
  });

  const openReviewQuery = useOpenReviewAutocomplete(searchQuery, {
    enabled: idType === 'openReview' && open && searchQuery.length >= 2,
  });

  // Get the appropriate query based on idType
  const activeQuery = React.useMemo(() => {
    switch (idType) {
      case 'semanticScholar':
        return semanticScholarQuery;
      case 'openAlex':
        return openAlexQuery;
      case 'dblp':
        return dblpQuery;
      case 'openReview':
        return openReviewQuery;
      default:
        return null;
    }
  }, [idType, semanticScholarQuery, openAlexQuery, dblpQuery, openReviewQuery]);

  const isLoading = activeQuery?.isLoading ?? false;

  // Transform service-specific results to unified format
  const matches: UnifiedAuthorMatch[] = React.useMemo(() => {
    if (!activeQuery?.data) return [];

    switch (idType) {
      case 'semanticScholar': {
        const data = activeQuery.data as { data: SemanticScholarAuthor[] };
        return transformSemanticScholar(data.data ?? []);
      }
      case 'openAlex': {
        const data = activeQuery.data as { results: OpenAlexAuthor[] };
        return transformOpenAlex(data.results ?? []);
      }
      case 'dblp': {
        const data = activeQuery.data as { result: { hits: { hit: Array<{ info: DblpAuthor }> } } };
        return transformDblp(data.result?.hits?.hit ?? []);
      }
      case 'openReview': {
        const data = activeQuery.data as { suggestions: OpenReviewSuggestion[] };
        return transformOpenReview(data.suggestions ?? []);
      }
      default:
        return [];
    }
  }, [idType, activeQuery?.data]);

  const handleSelect = React.useCallback(
    (match: UnifiedAuthorMatch) => {
      onChange(match.id);
      setSearchQuery('');
      setOpen(false);
    },
    [onChange]
  );

  const handleClear = React.useCallback(() => {
    onChange('');
    setSearchQuery('');
  }, [onChange]);

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      setSearchQuery(input);

      // For services with discovery, open popover when typing
      if (supportsDiscovery && input.length >= 2) {
        setOpen(true);
      }

      // For services without discovery, try to extract ID from URL
      if (!supportsDiscovery && input.includes('/')) {
        const extractedId = extractIdFromUrl(idType, input);
        if (extractedId && extractedId !== input) {
          onChange(extractedId);
          setSearchQuery('');
        }
      }
    },
    [idType, onChange, supportsDiscovery]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!supportsDiscovery) {
          // For non-discovery types, try to extract from current input
          const extractedId = extractIdFromUrl(idType, searchQuery);
          if (extractedId) {
            onChange(extractedId);
            setSearchQuery('');
          }
        }
      }
    },
    [idType, onChange, searchQuery, supportsDiscovery]
  );

  // If value is set, show it formatted
  if (value) {
    const displayId = config.formatId ? config.formatId(value) : value;
    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={idType}>{config.label}</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50">
            <a
              href={`${config.urlPrefix}${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
            >
              <span className="font-mono truncate">{displayId}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
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

  // For services with discovery, show autocomplete
  if (supportsDiscovery) {
    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={idType}>{config.label}</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                id={idType}
                value={searchQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery.length >= 2 && setOpen(true)}
                placeholder={config.placeholder}
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
            className="w-[450px] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList>
                {!isLoading && matches.length === 0 && searchQuery.length >= 2 && (
                  <CommandEmpty className="py-6 text-center text-sm">
                    No profiles found for &quot;{searchQuery}&quot;
                  </CommandEmpty>
                )}
                {matches.length > 0 && (
                  <CommandGroup>
                    {matches.map((match, index) => (
                      <CommandItem
                        key={`${match.id}-${index}`}
                        value={match.id}
                        onSelect={() => handleSelect(match)}
                        className="flex flex-col items-start gap-1 py-3"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium truncate">{match.displayName}</span>
                          {(match.worksCount > 0 || match.citedByCount > 0) && (
                            <span className="text-xs text-muted-foreground ml-auto shrink-0">
                              {formatCount(match.worksCount)} works ·{' '}
                              {formatCount(match.citedByCount)} citations
                            </span>
                          )}
                        </div>
                        {match.institution && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">{match.institution}</span>
                          </div>
                        )}
                        <span className="font-mono text-xs text-primary">{match.id}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </div>
    );
  }

  // For services without discovery, show simple input with URL extraction
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={idType}>{config.label}</Label>
      <Input
        ref={inputRef}
        id={idType}
        value={searchQuery}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={config.placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      <p className="text-xs text-muted-foreground">
        {config.description}. You can paste your profile URL and the ID will be extracted
        automatically.
      </p>
    </div>
  );
}
