'use client';

import { ThumbsUp } from 'lucide-react';

/**
 * User's endorsements page.
 */
export default function MyEndorsementsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Endorsements</h1>
        <p className="text-muted-foreground">Endorsements you have given</p>
      </div>

      {/* Content: Placeholder for now */}
      <div className="rounded-lg border-2 border-dashed p-12 text-center">
        <ThumbsUp className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No endorsements yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Endorsements you give to preprints will appear here
        </p>
      </div>
    </div>
  );
}
