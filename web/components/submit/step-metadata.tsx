'use client';

/**
 * Metadata step for eprint submission.
 *
 * @remarks
 * Step 2 of the submission wizard. Handles:
 * - Title and abstract (with rich text support)
 * - Keywords
 * - License selection (via knowledge graph autocomplete)
 *
 * @packageDocumentation
 */

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
import { AnnotationEditor } from '@/components/annotations';
import { extractPlainText } from '@/lib/utils/annotation-serializer';
import { ConceptAutocomplete } from '@/components/forms/concept-autocomplete';
import type { RichAnnotationBody } from '@/lib/api/schema';
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
// CONSTANTS
// =============================================================================

/**
 * Empty rich text body for form default.
 */
const EMPTY_RICH_TEXT: RichAnnotationBody = {
  type: 'RichText',
  items: [],
  format: 'application/x-chive-gloss+json',
};

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
  const abstractPlainText = typeof abstract === 'string' ? abstract : extractPlainText(abstract);
  const keywords = form.watch('keywords') ?? [];

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

      {/* Abstract with Rich Text */}
      <Controller
        control={form.control}
        name="abstract"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Abstract *</FormLabel>
            <AnnotationEditor
              value={
                typeof field.value === 'string'
                  ? field.value
                    ? {
                        type: 'RichText',
                        items: [{ type: 'text', content: field.value }],
                        format: 'application/x-chive-gloss+json',
                      }
                    : EMPTY_RICH_TEXT
                  : (field.value ?? EMPTY_RICH_TEXT)
              }
              onChange={(body) => {
                // Store rich text body directly (type will be updated in schema)
                // For backward compatibility, extract plain text if schema expects string
                const plainText = extractPlainText(body);
                field.onChange(plainText);
              }}
              placeholder="Enter your abstract. Use @ for institutions/people, # for fields/topics..."
              maxLength={10000}
              minHeight="10rem"
              enabledTriggers={['@', '#']}
            />
            <FormDescription>
              {abstractPlainText.length}/10,000 characters (minimum 50). Use @ to reference
              institutions and people, # to reference fields and topics.
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
        name="license"
        render={({ field }) => (
          <FormItem>
            <FormLabel>License *</FormLabel>
            <FormControl>
              <ConceptAutocomplete
                id="license-select"
                category="license"
                value={field.value}
                onSelect={(concept) => {
                  // Use the concept ID as the license value
                  field.onChange(concept.id);
                }}
                onClear={() => field.onChange('')}
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
          <li>
            Use @ to reference institutions (e.g., @MIT) and # to reference fields (e.g.,
            #machine-learning)
          </li>
          <li>Choose keywords that researchers would use to find your work</li>
          <li>CC BY 4.0 is the most common license for academic eprints</li>
        </ul>
      </section>
    </div>
  );
}
