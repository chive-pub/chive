'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Client-side authors page content.
 *
 * @remarks
 * Provides author search and discovery functionality.
 * Authors can be found by searching for their handle or DID.
 */
export function AuthorsPageContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedDid, setSearchedDid] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // If it looks like a DID, navigate to author page
      if (searchQuery.startsWith('did:')) {
        setSearchedDid(searchQuery.trim());
      } else {
        // Otherwise treat as a handle/search
        setSearchedDid(null);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Search section */}
      <Card>
        <CardHeader>
          <CardTitle>Find an Author</CardTitle>
          <CardDescription>
            Search for researchers by their AT Protocol handle or DID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter handle (e.g., @alice.bsky.social) or DID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Search</Button>
          </form>

          {searchedDid && (
            <div className="mt-4">
              <Button asChild>
                <Link href={`/authors/${encodeURIComponent(searchedDid)}`}>
                  View Profile: {searchedDid}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Decentralized Identity</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              Chive uses AT Protocol&apos;s decentralized identity system. Authors own their
              identity through DIDs (Decentralized Identifiers) and can use any AT Protocol handle.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Author Profiles</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              View an author&apos;s eprints, metrics, and endorsements by visiting their profile
              page. Link your ORCID to enhance your academic identity.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for future featured authors section */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-muted-foreground">Featured Authors</CardTitle>
          <CardDescription>
            Coming soon: Browse active researchers and discover new work
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
