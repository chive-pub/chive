'use client';

import { CheckCircle2, Clock } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AlphaApplicationStatus } from '@/lib/api/schema';

export interface AlphaStatusDisplayProps {
  /** The application status. Note: 'rejected' is displayed as 'pending' to users. */
  status: Exclude<AlphaApplicationStatus, 'none'>;
  appliedAt?: string;
  reviewedAt?: string;
}

/**
 * Displays the status of an alpha application.
 *
 * @remarks
 * For user experience, rejected applications are displayed as "pending".
 * Users should never see that their application was rejected.
 */
export function AlphaStatusDisplay({ status, appliedAt, reviewedAt }: AlphaStatusDisplayProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Show pending status for both pending AND rejected applications
  if (status === 'pending' || status === 'rejected') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-amber-500" />
            <CardTitle>Application Under Review</CardTitle>
          </div>
          <CardDescription>{appliedAt && <>Applied on {formatDate(appliedAt)}</>}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Thanks for applying to the Chive alpha! We are reviewing applications and will notify
            you by email when a decision is made.
          </p>
        </CardContent>
      </Card>
    );
  }

  // status === 'approved'
  return (
    <Card className="mx-auto max-w-lg border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          <CardTitle className="text-green-700 dark:text-green-300">
            Welcome to the Alpha!
          </CardTitle>
        </div>
        <CardDescription>{reviewedAt && <>Approved on {formatDate(reviewedAt)}</>}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-green-700 dark:text-green-300">
          Your application has been approved. You now have full access to Chive. Explore preprints,
          submit your work, and join the scholarly conversation.
        </p>
      </CardContent>
    </Card>
  );
}
