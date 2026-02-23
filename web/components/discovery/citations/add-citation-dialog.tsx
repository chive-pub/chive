'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search } from 'lucide-react';

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
import { useCreateCitation } from '@/lib/hooks/use-citations';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ context: { component: 'add-citation-dialog' } });

/**
 * Known citation type options.
 */
const CITATION_TYPES = [
  { value: 'references', label: 'References' },
  { value: 'extends', label: 'Extends' },
  { value: 'replicates', label: 'Replicates' },
  { value: 'contradicts', label: 'Contradicts' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'uses-method', label: 'Uses method from' },
  { value: 'uses-data', label: 'Uses data from' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * Props for AddCitationDialog component.
 */
export interface AddCitationDialogProps {
  /** AT-URI of the source eprint */
  eprintUri: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for manually adding a citation.
 *
 * @remarks
 * Provides a DOI lookup field that auto-fills citation metadata,
 * manual entry fields, citation type selection, and an optional
 * context textarea.
 *
 * @example
 * ```tsx
 * <AddCitationDialog
 *   eprintUri={eprintUri}
 *   open={dialogOpen}
 *   onOpenChange={setDialogOpen}
 * />
 * ```
 */
export function AddCitationDialog({ eprintUri, open, onOpenChange }: AddCitationDialogProps) {
  // DOI lookup state
  const [doiInput, setDoiInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [venue, setVenue] = useState('');
  const [doi, setDoi] = useState('');
  const [url, setUrl] = useState('');
  const [citationType, setCitationType] = useState('references');
  const [context, setContext] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createCitation = useCreateCitation();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setDoiInput('');
      setIsLookingUp(false);
      setLookupError(null);
      setTitle('');
      setAuthors('');
      setYear('');
      setVenue('');
      setDoi('');
      setUrl('');
      setCitationType('references');
      setContext('');
      setSubmitError(null);
    }
  }, [open]);

  const handleDoiLookup = useCallback(async () => {
    const cleanDoi = doiInput.trim().replace(/^https?:\/\/doi\.org\//, '');
    if (!cleanDoi) {
      setLookupError('Please enter a DOI.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);

    try {
      // Try Crossref API for DOI resolution
      const response = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`,
        {
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) {
        setLookupError('DOI not found. Please check the DOI and try again.');
        setIsLookingUp(false);
        return;
      }

      const data = (await response.json()) as {
        message?: {
          title?: string[];
          author?: Array<{ given?: string; family?: string }>;
          published?: { 'date-parts'?: number[][] };
          'container-title'?: string[];
          URL?: string;
          DOI?: string;
        };
      };
      const work = data.message;

      if (work) {
        // Auto-fill form fields
        if (work.title && work.title.length > 0) {
          setTitle(work.title[0] ?? '');
        }
        if (work.author) {
          const authorNames = work.author
            .map((a) => {
              if (a.family && a.given) return `${a.family}, ${a.given}`;
              return a.family ?? a.given ?? '';
            })
            .filter(Boolean);
          setAuthors(authorNames.join('; '));
        }
        const publishedParts = work.published?.['date-parts'];
        if (publishedParts && publishedParts[0] && publishedParts[0][0]) {
          setYear(String(publishedParts[0][0]));
        }
        if (work['container-title'] && work['container-title'].length > 0) {
          setVenue(work['container-title'][0] ?? '');
        }
        setDoi(work.DOI ?? cleanDoi);
        if (work.URL) {
          setUrl(work.URL);
        }

        logger.info('DOI lookup succeeded', { doi: cleanDoi });
      }
    } catch (err) {
      logger.warn('DOI lookup failed', {
        doi: cleanDoi,
        error: err instanceof Error ? err.message : String(err),
      });
      setLookupError('Failed to look up DOI. You can fill in the fields manually.');
    } finally {
      setIsLookingUp(false);
    }
  }, [doiInput]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setSubmitError('Title is required.');
      return;
    }

    setSubmitError(null);

    // Parse authors from semicolon-separated "Last, First; Last, First" string
    const parsedAuthors = authors.trim()
      ? authors
          .split(';')
          .map((a) => {
            const parts = a
              .trim()
              .split(',')
              .map((p) => p.trim());
            return { lastName: parts[0], firstName: parts[1] };
          })
          .filter((a) => a.lastName || a.firstName)
      : undefined;

    const parsedYear = year.trim() ? parseInt(year.trim(), 10) : undefined;

    try {
      await createCitation.mutateAsync({
        eprintUri,
        title: title.trim(),
        doi: doi.trim() || undefined,
        authors: parsedAuthors,
        year: parsedYear && !isNaN(parsedYear) ? parsedYear : undefined,
        venue: venue.trim() || undefined,
        citationType: citationType || undefined,
        context: context.trim() || undefined,
      });
      logger.info('Citation created', { eprintUri, title: title.trim() });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create citation.';
      setSubmitError(message);
      logger.warn('Failed to create citation', {
        eprintUri,
        error: message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Citation</DialogTitle>
          <DialogDescription>
            Add a citation to this eprint. Enter a DOI to auto-fill fields, or fill them in
            manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* DOI Lookup */}
          <div className="space-y-2">
            <Label htmlFor="doi-lookup">DOI Lookup</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="doi-lookup"
                  value={doiInput}
                  onChange={(e) => setDoiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleDoiLookup();
                    }
                  }}
                  placeholder="10.1234/example.doi or https://doi.org/..."
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => void handleDoiLookup()}
                disabled={isLookingUp || !doiInput.trim()}
              >
                {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lookup'}
              </Button>
            </div>
            {lookupError && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{lookupError}</p>
            )}
          </div>

          {/* Manual fields */}
          <div className="space-y-2">
            <Label htmlFor="citation-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="citation-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title of the cited work"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="citation-authors">Authors</Label>
              <Input
                id="citation-authors"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Last, First; Last, First"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="citation-year">Year</Label>
              <Input
                id="citation-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                type="number"
                min={1800}
                max={2100}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="citation-venue">Venue</Label>
              <Input
                id="citation-venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Journal or conference"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="citation-doi">DOI</Label>
              <Input
                id="citation-doi"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.1234/example"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="citation-url">URL</Label>
            <Input
              id="citation-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>

          {/* Citation type */}
          <div className="space-y-2">
            <Label htmlFor="citation-type">Citation type</Label>
            <Select value={citationType} onValueChange={setCitationType}>
              <SelectTrigger id="citation-type">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {CITATION_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Context */}
          <div className="space-y-2">
            <Label htmlFor="citation-context">
              Context <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="citation-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Why is this work cited? What is the relationship?"
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
          <Button onClick={handleSubmit} disabled={!title.trim() || createCitation.isPending}>
            {createCitation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Citation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
