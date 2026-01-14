'use client';

/**
 * Authors step for eprint submission.
 *
 * @remarks
 * Step 3 of the submission wizard. Handles comprehensive author management:
 * - ATProto users and external collaborators
 * - CRediT-based contributions with degree modifiers
 * - Multiple affiliations with ROR support
 * - Corresponding author designation
 * - Highlighted author status (co-first, co-last)
 * - Author ordering
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { User } from 'lucide-react';

import {
  EprintAuthorEditor,
  type EprintAuthorFormData,
} from '@/components/forms/eprint-author-editor';
import type { ContributionType } from '@/components/forms/contribution-type-selector';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { useAuthor } from '@/lib/hooks/use-author';
import type { EprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepAuthors component.
 */
export interface StepAuthorsProps {
  /** React Hook Form instance */
  form: UseFormReturn<EprintFormValues>;
  /** Whether this is an import flow (shows "This is me" on existing authors) */
  isImportMode?: boolean;
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
export function StepAuthors({ form, isImportMode = false, className }: StepAuthorsProps) {
  const { user } = useAuth();
  const watchedAuthors = form.watch('authors');
  const authors = useMemo(() => (watchedAuthors as EprintAuthorFormData[]) ?? [], [watchedAuthors]);

  // Fetch the submitter's Chive profile to get ORCID and affiliations
  const { data: submitterProfile } = useAuthor(user?.did ?? '', { enabled: !!user?.did });

  // Contribution types would be fetched from API in production
  const [contributionTypes, setContributionTypes] = useState<ContributionType[] | undefined>();

  // Track if we've already added the initial author
  const [initialAuthorAdded, setInitialAuthorAdded] = useState(false);

  // Add submitter as initial author on mount, with profile data when available
  useEffect(() => {
    if (user && authors.length === 0 && !initialAuthorAdded) {
      const initialAuthor: EprintAuthorFormData = {
        did: user.did,
        name: user.displayName ?? user.handle ?? 'Unknown',
        handle: user.handle,
        avatar: user.avatar,
        orcid: submitterProfile?.profile?.orcid,
        email: undefined,
        order: 1,
        affiliations:
          submitterProfile?.profile?.affiliations?.map((aff) => ({
            name: aff.name,
            rorId: aff.rorId,
          })) ?? [],
        contributions: [],
        isCorrespondingAuthor: true, // Submitter is corresponding by default
        isHighlighted: false,
      };
      form.setValue('authors', [initialAuthor], { shouldValidate: true });
      setInitialAuthorAdded(true);
    }
  }, [user, authors.length, form, submitterProfile, initialAuthorAdded]);

  // Update the submitter's profile data when it loads (if they were already added)
  useEffect(() => {
    if (submitterProfile?.profile && authors.length > 0 && user) {
      const submitterIndex = authors.findIndex((a) => a.did === user.did);
      if (submitterIndex !== -1) {
        const currentAuthor = authors[submitterIndex];
        // Only update if profile data is missing
        if (!currentAuthor.orcid && submitterProfile.profile.orcid) {
          const updatedAuthors = [...authors];
          updatedAuthors[submitterIndex] = {
            ...currentAuthor,
            orcid: submitterProfile.profile.orcid,
            affiliations:
              submitterProfile.profile.affiliations?.map((aff) => ({
                name: aff.name,
                rorId: aff.rorId,
              })) ?? currentAuthor.affiliations,
          };
          form.setValue('authors', updatedAuthors, { shouldValidate: true });
        }
      }
    }
  }, [submitterProfile, authors, user, form]);

  // Handle author list changes
  const handleAuthorsChange = useCallback(
    (updatedAuthors: EprintAuthorFormData[]) => {
      form.setValue('authors', updatedAuthors, { shouldValidate: true });
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
          Add all authors with their contributions and affiliations.
        </p>
      </div>

      {/* Submitter notice */}
      {user && (
        <Alert>
          <User className="h-4 w-4" />
          <AlertTitle>You are the submitter</AlertTitle>
          <AlertDescription>
            Your eprint will be stored in your Personal Data Server (PDS). You are added as an
            author by default, but you can reorder authors or remove yourself if you&apos;re not an
            author. You can also add external collaborators who don&apos;t have ATProto accounts.
          </AlertDescription>
        </Alert>
      )}

      {/* Author editor */}
      <EprintAuthorEditor
        authors={authors}
        onChange={handleAuthorsChange}
        submitterDid={user?.did}
        submitterProfile={
          user
            ? {
                handle: user.handle,
                displayName: user.displayName,
                avatar: user.avatar,
                orcid: submitterProfile?.profile?.orcid,
                affiliations: submitterProfile?.profile?.affiliations?.map((aff) => ({
                  name: aff.name,
                  rorId: aff.rorId,
                })),
              }
            : undefined
        }
        contributionTypes={contributionTypes}
        maxAuthors={50}
        isImportMode={isImportMode}
      />

      {form.formState.errors.authors && (
        <p className="text-sm text-destructive">{form.formState.errors.authors.message}</p>
      )}
    </div>
  );
}
