'use client';

/**
 * Metadata step for preprint submission.
 *
 * @remarks
 * Step 2 of the submission wizard. Handles:
 * - Title and abstract
 * - Keywords
 * - License selection
 *
 * @packageDocumentation
 */

import { UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { PreprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepMetadata component.
 */
export interface StepMetadataProps {
  /** React Hook Form instance */
  form: UseFormReturn<PreprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Available license options.
 * Values must match the Zod schema in submission-wizard.tsx
 */
const LICENSE_OPTIONS = [
  {
    value: 'cc-by-4.0',
    label: 'CC BY 4.0',
    description: 'Attribution required. Commercial use allowed.',
  },
  {
    value: 'cc-by-sa-4.0',
    label: 'CC BY-SA 4.0',
    description: 'Attribution required. Share-alike for derivatives.',
  },
  {
    value: 'cc-by-nc-4.0',
    label: 'CC BY-NC 4.0',
    description: 'Attribution required. Non-commercial use only.',
  },
  {
    value: 'cc-by-nc-sa-4.0',
    label: 'CC BY-NC-SA 4.0',
    description: 'Attribution, non-commercial, share-alike.',
  },
  {
    value: 'cc0-1.0',
    label: 'CC0 1.0 (Public Domain)',
    description: 'No rights reserved. Public domain dedication.',
  },
  {
    value: 'arxiv-perpetual',
    label: 'arXiv Perpetual',
    description: 'arXiv.org perpetual non-exclusive license.',
  },
] as const;

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
  const abstract = form.watch('abstract') ?? '';
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
              <Input {...field} placeholder="Enter the title of your preprint" maxLength={500} />
            </FormControl>
            <FormDescription>
              A clear, descriptive title for your preprint (max 500 characters)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Abstract */}
      <FormField
        control={form.control}
        name="abstract"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Abstract *</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Enter your abstract..."
                rows={8}
                maxLength={10000}
              />
            </FormControl>
            <FormDescription>{abstract.length}/10,000 characters (minimum 50)</FormDescription>
            <FormMessage />
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
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a license" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {LICENSE_OPTIONS.map((license) => (
                  <SelectItem key={license.value} value={license.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{license.label}</span>
                      <span className="text-xs text-muted-foreground">{license.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <li>Choose keywords that researchers would use to find your work</li>
          <li>CC BY 4.0 is the most common license for academic preprints</li>
        </ul>
      </section>
    </div>
  );
}
