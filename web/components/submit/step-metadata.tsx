'use client';

/**
 * Metadata step for eprint submission.
 *
 * @remarks
 * Step 2 of the submission wizard. Handles:
 * - Title input
 * - Abstract with rich text support (Markdown and LaTeX)
 * - Keywords
 * - License selection (via knowledge graph autocomplete)
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { UseFormReturn, Controller } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { RichTextEditor, type RichTextContent, createFromPlainText } from '@/components/editor';
import { ConceptAutocomplete } from '@/components/forms/concept-autocomplete';
import type { EprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepMetadata component.
 */
export interface StepMetadataProps {
  /** React Hook Form instance */
  form: UseFormReturn<EprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Metadata input step component.
 *
 * @param props - Component props
 * @returns Metadata step element
 */
export function StepMetadata({ form, className }: StepMetadataProps) {
  const abstract = form.watch('abstract');
  const abstractLength = typeof abstract === 'string' ? abstract.length : 0;
  const keywords = form.watch('keywords') ?? [];

  // Convert string value to RichTextContent for the editor
  const getAbstractContent = useCallback((value: string | undefined): RichTextContent => {
    if (!value) {
      return { text: '', html: '', facets: [] };
    }
    return createFromPlainText(value);
  }, []);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Title */}
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title *</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Enter the title of your eprint" maxLength={500} />
            </FormControl>
            <FormDescription>
              A clear, descriptive title for your eprint (max 500 characters)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Abstract with Rich Text Editor */}
      <Controller
        control={form.control}
        name="abstract"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Abstract *</FormLabel>
            <RichTextEditor
              value={getAbstractContent(field.value)}
              onChange={(content) => {
                // Store plain text for the abstract field
                // The lexicon currently expects plain text or an array of items
                field.onChange(content.text);
              }}
              placeholder="Enter your abstract. Use Markdown for formatting and $...$ for inline LaTeX, $$...$$ for display equations."
              maxLength={10000}
              minHeight="200px"
              enablePreview={true}
              showToolbar={true}
              enableLatex={true}
              ariaLabel="Abstract editor"
            />
            <FormDescription>
              {abstractLength}/10,000 characters (minimum 50). Supports Markdown formatting and
              LaTeX equations.
            </FormDescription>
            {fieldState.error && (
              <p className="text-sm text-destructive">{fieldState.error.message}</p>
            )}
          </FormItem>
        )}
      />

      {/* Keywords */}
      <FormField
        control={form.control}
        name="keywords"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Keywords</FormLabel>
            <FormControl>
              <Input
                value={field.value?.join(', ') ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const keywords = value
                    .split(',')
                    .map((k) => k.trim())
                    .filter(Boolean);
                  field.onChange(keywords);
                }}
                placeholder="machine learning, neural networks, deep learning"
              />
            </FormControl>
            <FormDescription>
              Comma-separated keywords for discoverability ({keywords.length}/20 keywords)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* License */}
      <FormField
        control={form.control}
        name="licenseSlug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>License *</FormLabel>
            <FormControl>
              <ConceptAutocomplete
                id="license-select"
                category="license"
                value={field.value}
                onSelect={(concept) => {
                  // Set both licenseSlug and licenseUri from the concept
                  // The slug is used for display fallback, the URI for graph reference
                  field.onChange(concept.id);
                  form.setValue('licenseUri', concept.uri || undefined);
                }}
                onClear={() => {
                  field.onChange('');
                  form.setValue('licenseUri', undefined);
                }}
                placeholder="Search licenses..."
              />
            </FormControl>
            <FormDescription>
              Choose how others can use and share your work.{' '}
              <a
                href="https://creativecommons.org/licenses/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Learn more about licenses
              </a>
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Writing Tips */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">Writing Tips</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-inside list-disc">
          <li>Use a descriptive title that summarizes your main finding</li>
          <li>Abstract should cover: background, methods, results, conclusions</li>
          <li>Use Markdown for formatting: **bold**, *italic*, `code`, and lists</li>
          <li>
            Use LaTeX for equations: <code className="text-xs bg-muted px-1 rounded">$E=mc^2$</code>{' '}
            for inline, <code className="text-xs bg-muted px-1 rounded">$$\int_0^\infty$$</code> for
            display
          </li>
          <li>Choose keywords that researchers would use to find your work</li>
          <li>CC BY 4.0 is the most common license for academic eprints</li>
        </ul>
      </section>
    </div>
  );
}
