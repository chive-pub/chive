'use client';

/**
 * Basics step for the collection wizard.
 *
 * @remarks
 * Step 1: Name, description, visibility, tags, and field selection.
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { X, Hash } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagAutocomplete } from '@/components/forms/tag-autocomplete';
import { FieldSearch, type FieldSelection } from '@/components/forms/field-search';

import type { CollectionFormValues } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepBasics component.
 */
export interface StepBasicsProps {
  /** React Hook Form instance */
  form: UseFormReturn<CollectionFormValues>;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Collection basics step: name, description, visibility, tags, and fields.
 *
 * @param props - Component props
 * @returns Basics step element
 */
export function StepBasics({ form }: StepBasicsProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const tags = watch('tags') ?? [];
  const fields = watch('fields') ?? [];

  const handleTagSelect = useCallback(
    (tag: string) => {
      if (tags.length >= 20) return;
      if (!tags.includes(tag)) {
        setValue('tags', [...tags, tag], { shouldDirty: true });
      }
    },
    [tags, setValue]
  );

  const handleTagRemove = useCallback(
    (tag: string) => {
      setValue(
        'tags',
        tags.filter((t) => t !== tag),
        { shouldDirty: true }
      );
    },
    [tags, setValue]
  );

  const handleFieldAdd = useCallback(
    (field: FieldSelection) => {
      setValue('fields', [...fields, field], { shouldDirty: true });
    },
    [fields, setValue]
  );

  const handleFieldRemove = useCallback(
    (field: FieldSelection) => {
      setValue(
        'fields',
        fields.filter((f) => f.uri !== field.uri),
        { shouldDirty: true }
      );
    },
    [fields, setValue]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Collection Basics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name your collection and configure its visibility.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="collection-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="collection-name"
          {...register('name')}
          placeholder="e.g., Reading List: NLP Transformers"
          maxLength={300}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="collection-description">Description</Label>
        <Textarea
          id="collection-description"
          {...register('description')}
          placeholder="A brief description of this collection..."
          maxLength={3000}
          className="min-h-[100px]"
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <Label htmlFor="collection-visibility">Visibility</Label>
        <Select
          value={watch('visibility')}
          onValueChange={(value) =>
            setValue('visibility', value as 'listed' | 'unlisted', {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger id="collection-visibility">
            <SelectValue placeholder="Select visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="listed">Listed (visible in search and listings)</SelectItem>
            <SelectItem value="unlisted">Unlisted (accessible via direct link only)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleTagRemove(tag)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {tags.length < 20 && (
          <TagAutocomplete
            key={tags.length}
            onSelect={handleTagSelect}
            placeholder="Search tags..."
            existingTags={tags}
          />
        )}
        <p className="text-xs text-muted-foreground">{tags.length}/20 tags</p>
      </div>

      {/* Fields */}
      <FieldSearch
        selectedFields={fields}
        onFieldAdd={handleFieldAdd}
        onFieldRemove={handleFieldRemove}
        label="Fields"
        helpText="Categorize this collection by academic field."
      />
    </div>
  );
}
