'use client';

import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Loading skeleton for the AnnotatedPDFViewer.
 *
 * @remarks
 * This is in a separate file to allow SSR-safe imports while
 * the main AnnotatedPDFViewer must be dynamically imported.
 */
export function AnnotatedPDFViewerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center h-full p-8', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">Loading PDF...</p>
    </div>
  );
}
