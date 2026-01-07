'use client';

import { CheckCircle2, Clock, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AlphaApplicationStatus } from '@/lib/api/schema';

export interface AlphaStatusDisplayProps {
  status: Exclude<AlphaApplicationStatus, 'none'>;
  appliedAt?: string;
  reviewedAt?: string;
}

/**
 * Displays the status of an alpha application.
 */
export function AlphaStatusDisplay({ status, appliedAt, reviewedAt }: AlphaStatusDisplayProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (status === 'pending') {
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

  if (status === 'approved') {
    return (
      <Card className="mx-auto max-w-lg border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            <CardTitle className="text-green-700 dark:text-green-300">
              Welcome to the Alpha!
            </CardTitle>
          </div>
          <CardDescription>
            {reviewedAt && <>Approved on {formatDate(reviewedAt)}</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-green-700 dark:text-green-300">
            Your application has been approved. You now have full access to Chive. Explore
            preprints, submit your work, and join the scholarly conversation.
          </p>
        </CardContent>
      </Card>
    );
  }

  // status === 'rejected'
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <XCircle className="h-6 w-6 text-muted-foreground" />
          <CardTitle>Application Not Approved</CardTitle>
        </div>
        <CardDescription>{reviewedAt && <>Reviewed on {formatDate(reviewedAt)}</>}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Unfortunately, we are not able to approve your application at this time. If you believe
          this is an error or have questions, please contact us at{' '}
          <a href="mailto:support@chive.pub" className="text-primary hover:underline">
            support@chive.pub
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
