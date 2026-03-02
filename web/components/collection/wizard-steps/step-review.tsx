'use client';

/**
 * Review step for the collection wizard.
 *
 * @remarks
 * Step 6: Final confirmation before creating the collection.
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { FolderPlus, FileText, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { CollectionFormValues } from './types';
import { ITEM_TYPE_CONFIG } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepReview component.
 */
export interface StepReviewProps {
  /** React Hook Form instance */
  form: UseFormReturn<CollectionFormValues>;
  /** Whether the form is currently submitting */
  isSubmitting: boolean;
  /** Error message from submission, if any */
  submitError: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Review step: final confirmation of collection details.
 *
 * @param props - Component props
 * @returns Review step element
 */
export function StepReview({ form, isSubmitting, submitError }: StepReviewProps) {
  const values = form.getValues();
  const items = values.items ?? [];
  const edges = values.edges ?? [];
  const subcollections = values.subcollections ?? [];
  const fields = values.fields ?? [];
  const tags = values.tags ?? [];

  const getItemLabel = useCallback(
    (uri: string): string => items.find((i) => i.uri === uri)?.label ?? uri,
    [items]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review Collection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details before creating your collection.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
            <p className="font-medium">{values.name}</p>
          </div>

          {values.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{values.description}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Visibility</h3>
            <Badge variant="outline" className="capitalize">
              {values.visibility}
            </Badge>
          </div>

          {tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Tags</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {fields.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Fields</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {fields.map((f) => (
                  <Badge key={f.uri} variant="secondary">
                    {f.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <div>
        <h3 className="text-sm font-medium mb-2">Items ({items.length})</h3>
        {items.length > 0 ? (
          <div className="space-y-1">
            {items.map((item, index) => {
              const config = ITEM_TYPE_CONFIG[item.type] ?? {
                label: item.type,
                icon: FileText,
                color: 'bg-gray-100 text-gray-800',
              };
              const Icon = config.icon;

              return (
                <div key={`${item.uri}-${index}`} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className={cn('shrink-0 gap-1 text-xs', config.color)}>
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                  <span className="truncate">{item.label}</span>
                  {item.note && (
                    <span className="text-xs text-muted-foreground truncate">({item.note})</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No items added.</p>
        )}
      </div>

      {/* Subcollections */}
      {subcollections.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Subcollections ({subcollections.length})</h3>
          <div className="space-y-1">
            {subcollections.map((sub) => (
              <div key={sub.name} className="flex items-center gap-2 text-sm">
                <FolderPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{sub.name}</span>
                <span className="text-muted-foreground">
                  ({sub.items.length} item{sub.items.length !== 1 ? 's' : ''})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edges */}
      {edges.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Custom Edges ({edges.length})</h3>
          <div className="space-y-1">
            {edges.map((edge, index) => (
              <div key={index} className="text-sm">
                <span className="font-medium">{getItemLabel(edge.sourceUri)}</span>
                <span className="mx-2 text-muted-foreground">&rarr;</span>
                <Badge variant="outline" className="text-xs mx-1">
                  {edge.relationLabel}
                </Badge>
                <span className="mx-2 text-muted-foreground">&rarr;</span>
                <span className="font-medium">{getItemLabel(edge.targetUri)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cosmik */}
      {values.enableCosmikMirror && <Badge variant="secondary">Semble mirror enabled</Badge>}

      {/* Submit error */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}

      {isSubmitting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating collection and adding items...
        </div>
      )}
    </div>
  );
}
