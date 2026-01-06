'use client';

/**
 * Authors step for preprint submission.
 *
 * @remarks
 * Step 3 of the submission wizard. Handles:
 * - Primary author (submitting user)
 * - Co-author management
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { User } from 'lucide-react';

import { AuthorInput, type AuthorRef } from '@/components/forms';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import type { PreprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepAuthors component.
 */
export interface StepAuthorsProps {
  /** React Hook Form instance */
  form: UseFormReturn<PreprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Authors management step component.
 *
 * @param props - Component props
 * @returns Authors step element
 */
export function StepAuthors({ form, className }: StepAuthorsProps) {
  const { user } = useAuth();
  const watchedAuthors = form.watch('authors');
  const authors = useMemo(() => watchedAuthors ?? [], [watchedAuthors]);

  // Set primary author from authenticated user
  useEffect(() => {
    if (user && authors.length === 0) {
      const primaryAuthor: AuthorRef = {
        did: user.did,
        displayName: user.displayName,
        handle: user.handle,
        avatar: user.avatar,
        isPrimary: true,
      };
      form.setValue('authors', [primaryAuthor], { shouldValidate: true });
    }
  }, [user, authors.length, form]);

  // Handle adding a co-author
  const handleAuthorAdd = useCallback(
    (author: AuthorRef) => {
      form.setValue('authors', [...authors, author], { shouldValidate: true });
    },
    [form, authors]
  );

  // Handle removing a co-author (can't remove primary)
  const handleAuthorRemove = useCallback(
    (author: AuthorRef) => {
      if (author.isPrimary) return;
      const updated = authors.filter((a) => a.did !== author.did);
      form.setValue('authors', updated, { shouldValidate: true });
    },
    [form, authors]
  );

  // Handle reordering authors
  const handleAuthorReorder = useCallback(
    (reorderedAuthors: AuthorRef[]) => {
      // Keep primary author first
      const primary = reorderedAuthors.find((a) => a.isPrimary);
      const others = reorderedAuthors.filter((a) => !a.isPrimary);
      const ordered = primary ? [primary, ...others] : reorderedAuthors;
      form.setValue('authors', ordered, { shouldValidate: true });
    },
    [form]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5" />
          Authors
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add co-authors to your preprint. You are automatically listed as the primary author.
        </p>
      </div>

      {/* Primary author notice */}
      {user && (
        <Alert>
          <User className="h-4 w-4" />
          <AlertTitle>You are the primary author</AlertTitle>
          <AlertDescription>
            As the submitting user, you will be listed as the primary author. Your preprint will be
            stored in your Personal Data Server (PDS).
          </AlertDescription>
        </Alert>
      )}

      {/* Author list */}
      <AuthorInput
        authors={authors}
        onAuthorAdd={handleAuthorAdd}
        onAuthorRemove={handleAuthorRemove}
        onAuthorReorder={handleAuthorReorder}
        maxAuthors={20}
        label="Author List"
        helpText="Add co-authors by their ATProto DID. Order reflects authorship contribution."
        showPrimaryBadge
      />

      {form.formState.errors.authors && (
        <p className="text-sm text-destructive">{form.formState.errors.authors.message}</p>
      )}

      {/* Co-author information */}
      <section className="rounded-lg border border-muted bg-muted/30 p-4">
        <h4 className="font-medium mb-2">About Co-Authors</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-inside list-disc">
          <li>Co-authors are identified by their ATProto DID (Decentralized Identifier)</li>
          <li>Each co-author should have an ATProto account (e.g., Bluesky)</li>
          <li>ORCID can be added for author disambiguation</li>
          <li>Author order typically reflects contribution level</li>
        </ul>
      </section>
    </div>
  );
}
