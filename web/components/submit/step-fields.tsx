'use client';

/**
 * Field selection step for preprint submission.
 *
 * @remarks
 * Step 4 of the submission wizard. Handles:
 * - Knowledge graph field selection
 * - PMEST/FAST facet selection (optional)
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Network } from 'lucide-react';

import { FieldSearch, type FieldSelection } from '@/components/forms';
import { cn } from '@/lib/utils';
import type { PreprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepFields component.
 */
export interface StepFieldsProps {
  /** React Hook Form instance */
  form: UseFormReturn<PreprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Field selection step component.
 *
 * @param props - Component props
 * @returns Field selection step element
 */
export function StepFields({ form, className }: StepFieldsProps) {
  const watchedFieldNodes = form.watch('fieldNodes');
  const fieldNodes = useMemo(() => watchedFieldNodes ?? [], [watchedFieldNodes]);

  // Handle field addition
  const handleFieldAdd = useCallback(
    (field: FieldSelection) => {
      form.setValue('fieldNodes', [...fieldNodes, { id: field.id, name: field.name }], {
        shouldValidate: true,
      });
    },
    [form, fieldNodes]
  );

  // Handle field removal
  const handleFieldRemove = useCallback(
    (field: FieldSelection) => {
      const updated = fieldNodes.filter((f) => f.id !== field.id);
      form.setValue('fieldNodes', updated, { shouldValidate: true });
    },
    [form, fieldNodes]
  );

  // Convert form field format to FieldSelection
  const selectedFields: FieldSelection[] = fieldNodes.map((f) => ({
    id: f.id,
    name: f.name,
  }));

  return (
    <div className={cn('space-y-6', className)} data-testid="classification-step">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Network className="h-5 w-5" />
          Research Fields
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select the knowledge graph fields that best describe your research. This helps others
          discover your work.
        </p>
      </div>

      {/* Field search */}
      <FieldSearch
        selectedFields={selectedFields}
        onFieldAdd={handleFieldAdd}
        onFieldRemove={handleFieldRemove}
        maxFields={10}
        label="Select Fields"
        helpText="Choose 1-10 fields that describe your research area"
        placeholder="Search for a research field..."
      />

      {form.formState.errors.fieldNodes && (
        <p className="text-sm text-destructive">{form.formState.errors.fieldNodes.message}</p>
      )}

      {/* Field selection tips */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">Selection Tips</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-inside list-disc">
          <li>Select the most specific fields that apply to your work</li>
          <li>Parent fields are included automatically</li>
          <li>Cross-disciplinary work can have multiple fields</li>
          <li>Fields help with faceted search and recommendations</li>
        </ul>
      </section>

      {/* No fields warning */}
      {fieldNodes.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/50">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            At least one field is required for submission. Fields help categorize your preprint and
            make it discoverable.
          </p>
        </div>
      )}
    </div>
  );
}
