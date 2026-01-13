import Link from 'next/link';
import { FolderX } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Not found page for fields.
 *
 * @remarks
 * Displayed when a field cannot be found.
 */
export default function FieldNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 rounded-full bg-muted p-4">
        <FolderX className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">Field not found</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        We couldn&apos;t find a field with that identifier. It may not exist or may have been
        removed.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/fields">Browse all fields</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/search">Search eprints</Link>
        </Button>
      </div>
    </div>
  );
}
