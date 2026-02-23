'use client';

/**
 * Full tag management panel for eprints.
 *
 * @example
 * ```tsx
 * <TagManager eprintUri={eprintUri} editable={isOwner} />
 * ```
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import { Tags, Plus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEprintTags, useCreateTag, useDeleteTag } from '@/lib/hooks/use-tags';
import type { TagSummary } from '@/lib/api/schema';
import { TagList, TagListSkeleton } from './tag-list';
import { TagInput } from './tag-input';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for TagManager.
 */
export interface TagManagerProps {
  /** AT-URI of the eprint */
  eprintUri: string;

  /** Whether tags can be edited */
  editable?: boolean;

  /** Current user's DID (for ownership) */
  currentUserDid?: string;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays and manages tags for an eprint.
 *
 * @param props - Component props
 * @returns Tag manager element
 */
export function TagManager({
  eprintUri,
  editable = false,
  currentUserDid,
  className,
}: TagManagerProps) {
  const [isAdding, setIsAdding] = useState(false);

  const { data, isLoading, error } = useEprintTags(eprintUri);
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();

  const tags = data?.tags ?? [];

  // Separate user's own tags from others, deduplicating by normalizedForm.
  // A user may have multiple records with the same normalized form (e.g. created twice);
  // we keep all URIs so deletion removes every duplicate.
  const userTagsByNorm = new Map<string, { tag: (typeof tags)[number]; uris: string[] }>();
  const otherTagsByNorm = new Map<string, { tag: (typeof tags)[number]; count: number }>();

  for (const t of tags) {
    if (currentUserDid && t.author.did === currentUserDid) {
      const existing = userTagsByNorm.get(t.normalizedForm);
      if (existing) {
        existing.uris.push(t.uri);
      } else {
        userTagsByNorm.set(t.normalizedForm, { tag: t, uris: [t.uri] });
      }
    } else {
      // Skip terms the current user already tagged
      if (currentUserDid && userTagsByNorm.has(t.normalizedForm)) continue;
      const existing = otherTagsByNorm.get(t.normalizedForm);
      if (existing) {
        existing.count++;
      } else {
        otherTagsByNorm.set(t.normalizedForm, { tag: t, count: 1 });
      }
    }
  }

  const dedupedUserTags = Array.from(userTagsByNorm.values());
  const dedupedOtherTags = Array.from(otherTagsByNorm.values());

  const handleAddTag = async (displayForm: string) => {
    await createTag.mutateAsync({
      eprintUri,
      displayForm,
    });
    setIsAdding(false);
  };

  /**
   * Handle tag removal - accepts TagSummary or string from TagList.
   * Deletes all user records matching the normalized form (handles duplicates).
   */
  const handleRemoveTag = async (tag: TagSummary | string) => {
    const normalizedForm = typeof tag === 'string' ? tag : tag.normalizedForm;

    const entry = userTagsByNorm.get(normalizedForm);
    if (!entry) return;

    // Delete all duplicate records for this normalized form
    for (const uri of entry.uris) {
      await deleteTag.mutateAsync({ uri, eprintUri });
    }
  };

  if (error) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="py-4">
          <p className="text-sm text-destructive">Failed to load tags</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('', className)} data-testid="tag-manager">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="h-4 w-4" />
              Community Tags
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              User-contributed labels for discovery
            </p>
          </div>

          {editable && !isAdding && (
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4" />
              Add tag
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Loading state */}
        {isLoading && <TagListSkeleton count={5} />}

        {/* Tag input when adding */}
        {isAdding && (
          <div className="space-y-2">
            <TagInput
              existingTags={dedupedUserTags.map((e) => e.tag.normalizedForm)}
              onTagAdd={handleAddTag}
              onTagRemove={handleRemoveTag}
              maxTags={10}
              disabled={createTag.isPending}
            />
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* User's tags */}
        {!isLoading && dedupedUserTags.length > 0 && !isAdding && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Your tags</p>
            <TagList
              tags={dedupedUserTags.map((e) => ({
                normalizedForm: e.tag.normalizedForm,
                displayForms: [e.tag.displayForm],
                usageCount: 1,
                qualityScore: 1,
                isPromoted: false,
              }))}
              onTagRemove={editable ? handleRemoveTag : undefined}
              linkToTags
            />
          </div>
        )}

        {/* Other users' tags */}
        {!isLoading && dedupedOtherTags.length > 0 && (
          <div className="space-y-1">
            {dedupedUserTags.length > 0 && (
              <p className="text-xs text-muted-foreground">Community tags</p>
            )}
            <TagList
              tags={dedupedOtherTags.map((e) => ({
                normalizedForm: e.tag.normalizedForm,
                displayForms: [e.tag.displayForm],
                usageCount: e.count,
                qualityScore: 1,
                isPromoted: false,
              }))}
              linkToTags
              showCounts={false}
            />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && tags.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground">
            No tags yet.{' '}
            {editable && (
              <button className="text-primary hover:underline" onClick={() => setIsAdding(true)}>
                Add the first tag
              </button>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
