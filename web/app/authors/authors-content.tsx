'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DidAutocompleteInput,
  type SelectedAtprotoUser,
} from '@/components/forms/did-autocomplete-input';

/**
 * Client-side authors page content.
 *
 * @remarks
 * Provides author search and discovery functionality.
 * Uses autocomplete to search for authors with eprints on Chive,
 * falling back to general ATProto user search.
 */
export function AuthorsPageContent() {
  const router = useRouter();

  const handleAuthorSelect = useCallback(
    (user: SelectedAtprotoUser) => {
      // Navigate to the author's profile page
      router.push(`/authors/${encodeURIComponent(user.did)}`);
    },
    [router]
  );

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Find an Author</CardTitle>
          <CardDescription>
            Search for researchers by name or handle. Results show authors with eprints on Chive
            first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DidAutocompleteInput
            onSelect={handleAuthorSelect}
            placeholder="Search by name or handle..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
