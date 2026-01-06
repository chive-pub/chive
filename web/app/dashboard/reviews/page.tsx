'use client';

import { MessageSquare } from 'lucide-react';

/**
 * User's reviews page.
 */
export default function MyReviewsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Reviews</h1>
        <p className="text-muted-foreground">Reviews you have written</p>
      </div>

      {/* Content - Placeholder for now */}
      <div className="rounded-lg border-2 border-dashed p-12 text-center">
        <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No reviews yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Reviews you write on preprints will appear here
        </p>
      </div>
    </div>
  );
}
