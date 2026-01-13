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
import { User, Info } from 'lucide-react';

import {
  EprintAuthorEditor,
  type EprintAuthorFormData,
} from '@/components/forms/eprint-author-editor';
import type { ContributionType } from '@/components/forms/contribution-type-selector';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
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
  const authors = useMemo(() => (watchedAuthors as EprintAuthorFormData[]) ?? [], [watchedAuthors]);

  // Contribution types would be fetched from API in production
  const [contributionTypes, setContributionTypes] = useState<ContributionType[] | undefined>();

  // Add submitter as initial author on mount
  useEffect(() => {
    if (user && authors.length === 0) {
      const initialAuthor: EprintAuthorFormData = {
        did: user.did,
        name: user.displayName ?? user.handle ?? 'Unknown',
        handle: user.handle,
        avatar: user.avatar,
        orcid: undefined,
        email: undefined,
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: true, // Submitter is corresponding by default
        isHighlighted: false,
      };
      form.setValue('authors', [initialAuthor], { shouldValidate: true });
    }
  }, [user, authors.length, form]);

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
              }
            : undefined
        }
        contributionTypes={contributionTypes}
        maxAuthors={50}
      />

      {form.formState.errors.authors && (
        <p className="text-sm text-destructive">{form.formState.errors.authors.message}</p>
      )}

      {/* Help section */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="help">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              About Authors & Contributions
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>
                <h5 className="font-medium text-foreground mb-1">Author Types</h5>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>ATProto users:</strong> Authors with ATProto accounts (e.g., Bluesky)
                    are linked by their DID
                  </li>
                  <li>
                    <strong>External collaborators:</strong> Authors without ATProto accounts can be
                    added with their name, ORCID, and email
                  </li>
                </ul>
              </div>

              <div>
                <h5 className="font-medium text-foreground mb-1">CRediT Contributions</h5>
                <p>
                  Contributions follow the{' '}
                  <a
                    href="https://credit.niso.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    CRediT taxonomy
                  </a>
                  . Each contribution can be marked as:
                </p>
                <ul className="list-disc list-inside mt-1">
                  <li>
                    <strong>Lead:</strong> Primary responsibility
                  </li>
                  <li>
                    <strong>Equal:</strong> Shared responsibility
                  </li>
                  <li>
                    <strong>Supporting:</strong> Assisted with this contribution
                  </li>
                </ul>
              </div>

              <div>
                <h5 className="font-medium text-foreground mb-1">Author Designations</h5>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Corresponding author:</strong> Primary contact for the paper (shown with
                    envelope icon)
                  </li>
                  <li>
                    <strong>Highlighted (†):</strong> Authors who contributed equally (co-first or
                    co-last authorship)
                  </li>
                </ul>
              </div>

              <div>
                <h5 className="font-medium text-foreground mb-1">Affiliations</h5>
                <p>
                  Add institutional affiliations with optional{' '}
                  <a
                    href="https://ror.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    ROR
                  </a>{' '}
                  identifiers for disambiguation. Search by organization name for automatic ROR
                  linking.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
