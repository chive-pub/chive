'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, Bookmark, BookmarkCheck, Check, Copy } from 'lucide-react';

import { SearchInput, SearchResults, SearchPagination, FacetSelector } from '@/components/search';
import {
  useFacetedSearch,
  countTotalFilters,
  type DynamicFacetFilters,
} from '@/lib/hooks/use-faceted-search';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Initial params for the browse page.
 */
export interface BrowseInitialParams {
  q?: string;
  facets?: DynamicFacetFilters;
}

/**
 * Props for the BrowsePageContent component.
 */
export interface BrowsePageContentProps {
  /** Initial params from URL */
  initialParams: BrowseInitialParams;
}

/**
 * Saved filter type.
 */
interface SavedFilter {
  name: string;
  query: string;
  filters: DynamicFacetFilters;
  createdAt: string;
}

const SAVED_FILTERS_KEY = 'chive-saved-filters';

/**
 * Converts filters to URL search params.
 */
function filtersToSearchParams(filters: DynamicFacetFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [slug, values] of Object.entries(filters)) {
    if (values && values.length > 0) {
      for (const value of values) {
        params.append(slug, value);
      }
    }
  }
  return params;
}

/**
 * Parses URL search params into filters.
 */
function searchParamsToFilters(searchParams: URLSearchParams): DynamicFacetFilters {
  const filters: DynamicFacetFilters = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === 'q') continue; // Skip query param
    if (!filters[key]) {
      filters[key] = [];
    }
    filters[key].push(value);
  }
  return filters;
}

/**
 * Client-side browse page content with faceted search.
 *
 * @remarks
 * Manages facet selections, search query, and results with URL sync.
 * Facets are fetched dynamically from the knowledge graph.
 */
export function BrowsePageContent({ initialParams }: BrowsePageContentProps) {
  const router = useRouter();

  // Initialize state from URL params
  const [query, setQuery] = useState(initialParams.q ?? '');
  const [filters, setFilters] = useState<DynamicFacetFilters>(initialParams.facets ?? {});

  // Share and save state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');

  // Load saved filters from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SAVED_FILTERS_KEY);
    if (stored) {
      try {
        setSavedFilters(JSON.parse(stored));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Generate shareable URL
  const generateShareUrl = useCallback(() => {
    const params = filtersToSearchParams(filters);
    if (query) {
      params.set('q', query);
    }
    const queryString = params.toString();
    const url = `${window.location.origin}/browse${queryString ? `?${queryString}` : ''}`;
    setShareUrl(url);
    setShareDialogOpen(true);
    setCopied(false);
  }, [query, filters]);

  // Copy URL to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  // Save current filters
  const saveCurrentFilters = useCallback(() => {
    if (!filterName.trim()) return;

    const newFilter: SavedFilter = {
      name: filterName.trim(),
      query,
      filters,
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
    setSaveDialogOpen(false);
    setFilterName('');
  }, [filterName, query, filters, savedFilters]);

  const activeFilterCount = countTotalFilters(filters);

  // Fetch results with faceted search
  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useFacetedSearch({
    q: query || undefined,
    facets: Object.keys(filters).length > 0 ? filters : undefined,
    limit: 20,
  });

  // Update URL when state changes
  const updateUrl = useCallback(
    (newQuery: string, newFilters: DynamicFacetFilters) => {
      const params = filtersToSearchParams(newFilters);
      if (newQuery) {
        params.set('q', newQuery);
      }
      const queryString = params.toString();
      router.push(queryString ? `/browse?${queryString}` : '/browse', { scroll: false });
    },
    [router]
  );

  // Handle search
  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      updateUrl(newQuery, filters);
    },
    [filters, updateUrl]
  );

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: DynamicFacetFilters) => {
      setFilters(newFilters);
      updateUrl(query, newFilters);
    },
    [query, updateUrl]
  );

  // Load saved filter
  const loadSavedFilter = useCallback(
    (saved: SavedFilter) => {
      setQuery(saved.query);
      setFilters(saved.filters);
      updateUrl(saved.query, saved.filters);
    },
    [updateUrl]
  );

  // Delete saved filter
  const deleteSavedFilter = useCallback(
    (index: number) => {
      const updated = savedFilters.filter((_, i) => i !== index);
      setSavedFilters(updated);
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
    },
    [savedFilters]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Sidebar with facets */}
      <aside className="hidden lg:block">
        <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto space-y-4 pr-2">
          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-medium mb-3">Saved Filters</h3>
              <div className="space-y-2">
                {savedFilters.map((saved, i) => (
                  <div key={i} className="flex items-center justify-between text-sm group">
                    <button
                      onClick={() => loadSavedFilter(saved)}
                      className="text-left hover:text-primary truncate flex-1"
                    >
                      {saved.name}
                    </button>
                    <button
                      onClick={() => deleteSavedFilter(i)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <FacetSelector
            facets={searchResults?.facets}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            isLoading={isLoading}
            mode="sidebar"
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="space-y-6">
        {/* Search input with actions */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchInput
              defaultValue={query}
              onSearch={handleSearch}
              placeholder="Search within filtered results..."
            />
          </div>

          {/* Share and Save buttons */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                {savedFilters.length > 0 ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setSaveDialogOpen(true)}
                disabled={activeFilterCount === 0 && !query}
              >
                Save current filters
              </DropdownMenuItem>
              {savedFilters.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {savedFilters.map((saved, i) => (
                    <DropdownMenuItem key={i} onClick={() => loadSavedFilter(saved)}>
                      {saved.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="icon" onClick={generateShareUrl}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile facet selector */}
        <div className="lg:hidden">
          <FacetSelector
            facets={searchResults?.facets}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            isLoading={isLoading}
            mode="tabs"
          />
        </div>

        {/* Results */}
        <SearchResults
          query={query || 'all eprints'}
          data={searchResults}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          onClearFilters={() => handleFiltersChange({})}
          hasFilters={Object.keys(filters).length > 0}
        />

        {/* Pagination */}
        {searchResults && (
          <SearchPagination
            hasMore={searchResults.hasMore}
            cursor={searchResults.cursor}
            total={searchResults.total}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Share URL Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Search</DialogTitle>
            <DialogDescription>
              Copy this URL to share your current search and filters
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={shareUrl} readOnly className="font-mono text-sm" />
            <Button onClick={copyToClipboard} variant="outline" size="icon">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {copied && <p className="text-sm text-green-600">Copied to clipboard!</p>}
        </DialogContent>
      </Dialog>

      {/* Save Filter Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filters</DialogTitle>
            <DialogDescription>
              Save your current search and filters for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Filter name</Label>
              <Input
                id="filter-name"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="e.g., Machine Learning papers 2024"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveCurrentFilters} disabled={!filterName.trim()}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
