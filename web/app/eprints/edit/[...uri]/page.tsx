'use client';

/**
 * Eprint edit page with collapsible sections for all fields.
 *
 * @remarks
 * Allows targeted editing of any eprint field without stepping through
 * a wizard. Each section can be expanded independently.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEprint } from '@/lib/hooks/use-eprint';
import { useAgent, useIsAuthenticated, useCurrentUser } from '@/lib/auth';
import { useEprintPermissions } from '@/lib/hooks';
import { LoginPrompt } from '@/components/auth';

import { EprintEditSections } from '@/components/eprints/eprint-edit-sections';

/**
 * Edit page for eprint submissions.
 */
export default function EprintEditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the section to auto-expand from URL params (e.g., ?section=abstract)
  const initialSection = searchParams.get('section');

  // Reconstruct the AT-URI from the route params (same pattern as main eprint page)
  const uriParts = params.uri as string[];
  const uri = uriParts ? decodeURIComponent(uriParts.join('/')) : '';

  const { data: eprint, isLoading, error } = useEprint(uri);
  const isAuthenticated = useIsAuthenticated();
  const currentUser = useCurrentUser();
  const _agent = useAgent();
  const permissions = useEprintPermissions(eprint ?? undefined, currentUser?.did);

  const [isSaving, setIsSaving] = useState(false);

  // Redirect to eprint page after successful save
  const handleSaveSuccess = useCallback(() => {
    toast.success('Eprint updated successfully');
    router.push(`/eprints/${encodeURIComponent(uri)}`);
  }, [router, uri]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    router.push(`/eprints/${encodeURIComponent(uri)}`);
  }, [router, uri]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Error Loading Eprint</h1>
          <p className="mt-2 text-muted-foreground">{error.message}</p>
          <Button asChild className="mt-4">
            <Link href="/eprints">Back to Eprints</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Not found
  if (!eprint) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Eprint Not Found</h1>
          <p className="mt-2 text-muted-foreground">The requested eprint could not be found.</p>
          <Button asChild className="mt-4">
            <Link href="/eprints">Back to Eprints</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign In Required</h1>
          <p className="mt-2 text-muted-foreground">
            You need to be signed in to edit this eprint.
          </p>
          <LoginPrompt action="edit this eprint" className="mt-4" />
        </div>
      </div>
    );
  }

  // No permission
  if (!permissions.canModify) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Permission Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You do not have permission to edit this eprint.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/eprints/${encodeURIComponent(uri)}`}>Back to Eprint</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/eprints/${encodeURIComponent(uri)}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to eprint
        </Link>
        <h1 className="text-3xl font-bold">Edit Eprint</h1>
        <p className="mt-2 text-muted-foreground">
          Click on any section to expand and edit. Changes are saved when you click Save Changes.
        </p>
      </div>

      <Separator className="mb-8" />

      {/* Edit sections */}
      <EprintEditSections
        eprint={eprint}
        initialSection={initialSection}
        onSaveSuccess={handleSaveSuccess}
        onCancel={handleCancel}
        isSaving={isSaving}
        setIsSaving={setIsSaving}
      />
    </div>
  );
}
