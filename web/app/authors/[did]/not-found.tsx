import Link from 'next/link';
import { UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Not found page for authors.
 *
 * @remarks
 * Displayed when an author profile cannot be found.
 */
export default function AuthorNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 rounded-full bg-muted p-4">
        <UserX className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">Author not found</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        We couldn&apos;t find an author with that identifier. The profile may not exist or the DID
        might be incorrect.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/search">Search preprints</Link>
        </Button>
      </div>
    </div>
  );
}
