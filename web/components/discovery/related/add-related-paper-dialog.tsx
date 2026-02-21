'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateRelatedWork } from '@/lib/hooks/use-related-works';
import { api } from '@/lib/api/client';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'add-related-paper-dialog' } });

/**
 * Known relationship types for related paper links.
 */
const RELATION_TYPES = [
  { value: 'extends', label: 'Extends' },
  { value: 'replicates', label: 'Replicates' },
  { value: 'contradicts', label: 'Contradicts' },
  { value: 'cites', label: 'Cites' },
  { value: 'cited-by', label: 'Cited by' },
  { value: 'same-topic', label: 'Same topic' },
  { value: 'same-author', label: 'Same author' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'related', label: 'Related' },
] as const;

/**
 * Search result for eprint lookup.
 */
interface EprintSearchResult {
  uri: string;
  title: string;
  authors?: string[];
}

/**
 * Props for AddRelatedPaperDialog component.
 */
export interface AddRelatedPaperDialogProps {
  /** AT-URI of the source eprint */
  eprintUri: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the related URI (e.g., from suggestion click) */
  prefillRelatedUri?: string;
}

/**
 * Dialog for adding a related paper link.
 *
 * @remarks
 * Provides an eprint search field, relationship type selector,
 * and optional description. The search field queries the Chive
 * search API for matching eprints.
 *
 * @example
 * ```tsx
 * <AddRelatedPaperDialog
 *   eprintUri={eprintUri}
 *   open={dialogOpen}
 *   onOpenChange={setDialogOpen}
 * />
 * ```
 */
export function AddRelatedPaperDialog({
  eprintUri,
  open,
  onOpenChange,
  prefillRelatedUri,
}: AddRelatedPaperDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EprintSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUri, setSelectedUri] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [relationType, setRelationType] = useState('related');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createRelatedWork = useCreateRelatedWork();

  // Pre-fill when a suggestion URI is provided
  useEffect(() => {
    if (prefillRelatedUri && open) {
      setSelectedUri(prefillRelatedUri);
      setSearchQuery('');
      setSearchResults([]);
      // Attempt to resolve the title
      resolveEprintDetails(prefillRelatedUri);
    }
  }, [prefillRelatedUri, open]);

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUri('');
      setSelectedTitle('');
      setSelectedAuthors([]);
      setRelationType('related');
      setDescription('');
      setSubmitError(null);
    }
  }, [open]);

  const resolveEprintDetails = async (uri: string) => {
    try {
      const response = await api.pub.chive.eprint.getSubmission({ uri });
      const data = response.data as {
        value?: { title?: string; authors?: Array<{ name?: string }> };
      };
      if (data.value?.title) {
        setSelectedTitle(data.value.title);
      }
      if (data.value?.authors) {
        setSelectedAuthors(data.value.authors.map((a) => a.name ?? '').filter(Boolean));
      }
    } catch {
      logger.info('Could not resolve eprint details for prefill', { uri });
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await api.pub.chive.eprint.searchSubmissions({
        q: query,
        limit: 5,
      });
      const data = response.data as {
        hits?: Array<{
          uri?: string;
          title?: string;
          authors?: Array<{ name?: string }>;
        }>;
      };
      const results: EprintSearchResult[] = (data.hits ?? []).map((hit) => ({
        uri: hit.uri ?? '',
        title: hit.title ?? 'Untitled',
        authors: hit.authors?.map((a) => a.name ?? '').filter(Boolean),
      }));
      setSearchResults(results);
    } catch (err) {
      logger.warn('Eprint search failed', {
        query,
        error: err instanceof Error ? err.message : String(err),
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      void handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSelectResult = (result: EprintSearchResult) => {
    setSelectedUri(result.uri);
    setSelectedTitle(result.title);
    setSelectedAuthors(result.authors ?? []);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedUri) {
      setSubmitError('Please select a related paper.');
      return;
    }
    if (!relationType) {
      setSubmitError('Please select a relationship type.');
      return;
    }

    setSubmitError(null);

    try {
      await createRelatedWork.mutateAsync({
        eprintUri,
        relatedUri: selectedUri,
        relationType,
        description: description.trim() || undefined,
      });
      logger.info('Related work created', { eprintUri, relatedUri: selectedUri, relationType });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create related work link.';
      setSubmitError(message);
      logger.warn('Failed to create related work', {
        eprintUri,
        relatedUri: selectedUri,
        error: message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Related Paper</DialogTitle>
          <DialogDescription>
            Link a related paper to this eprint. Search for an existing Chive eprint or paste its
            AT-URI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selected paper display */}
          {selectedUri && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="text-sm font-medium">{selectedTitle || 'Selected paper'}</p>
              {selectedAuthors.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{selectedAuthors.join(', ')}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 px-2 text-xs"
                onClick={() => {
                  setSelectedUri('');
                  setSelectedTitle('');
                  setSelectedAuthors([]);
                }}
              >
                Change
              </Button>
            </div>
          )}

          {/* Search field */}
          {!selectedUri && (
            <div className="space-y-2">
              <Label htmlFor="eprint-search">Search for a paper</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="eprint-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or paste an AT-URI..."
                  className="pl-9"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="rounded-md border max-h-48 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.uri}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-b-0"
                      onClick={() => handleSelectResult(result)}
                    >
                      <p className="font-medium line-clamp-1">{result.title}</p>
                      {result.authors && result.authors.length > 0 && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {result.authors.join(', ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Manual AT-URI entry */}
              {searchQuery.startsWith('at://') && searchResults.length === 0 && !isSearching && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelectedUri(searchQuery);
                    setSelectedTitle('');
                    setSearchQuery('');
                    resolveEprintDetails(searchQuery);
                  }}
                >
                  Use AT-URI: {searchQuery}
                </Button>
              )}
            </div>
          )}

          {/* Relationship type */}
          <div className="space-y-2">
            <Label htmlFor="relation-type">Relationship type</Label>
            <Select value={relationType} onValueChange={setRelationType}>
              <SelectTrigger id="relation-type">
                <SelectValue placeholder="Select relationship..." />
              </SelectTrigger>
              <SelectContent>
                {RELATION_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe how these papers are related..."
              rows={2}
            />
          </div>

          {/* Error message */}
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedUri || !relationType || createRelatedWork.isPending}
          >
            {createRelatedWork.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Related Paper'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
