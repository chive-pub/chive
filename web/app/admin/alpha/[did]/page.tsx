'use client';

import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Ban,
  User,
  Mail,
  Briefcase,
  GraduationCap,
  Building,
  Tag,
  MessageSquare,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAdminAlphaApplication, useUpdateAlphaApplication } from '@/lib/hooks/use-admin';

/**
 * Returns badge styling for an alpha application status.
 */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500/15 text-yellow-700 border-yellow-200';
    case 'approved':
      return 'bg-green-500/15 text-green-700 border-green-200';
    case 'rejected':
      return 'bg-red-500/15 text-red-700 border-red-200';
    case 'revoked':
      return 'bg-gray-500/15 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-500/15 text-gray-700 border-gray-200';
  }
}

/**
 * Alpha application detail page.
 *
 * @remarks
 * Shows the full application details for a single user and provides
 * action buttons to approve, reject, or revoke the application.
 */
export default function AdminAlphaDetailPage({ params }: { params: Promise<{ did: string }> }) {
  const { did } = use(params);
  const decodedDid = decodeURIComponent(did);

  const { data: application, isLoading } = useAdminAlphaApplication(decodedDid);
  const updateApplication = useUpdateAlphaApplication();

  const [confirmType, setConfirmType] = useState<'approve' | 'reject' | 'revoke' | null>(null);
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    if (!confirmType) return;

    try {
      await updateApplication.mutateAsync({
        did: decodedDid,
        action: confirmType,
        reason: reason || undefined,
      });
    } finally {
      setConfirmType(null);
      setReason('');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-5" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/alpha"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Application Not Found</h1>
            <p className="text-muted-foreground">
              No alpha application found for DID: {decodedDid}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/alpha"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {application.handle ?? decodedDid}
            </h1>
            <p className="text-muted-foreground">Alpha application details</p>
          </div>
        </div>
        <Badge className={statusBadgeClass(application.status ?? 'pending')}>
          {application.status ?? 'pending'}
        </Badge>
      </div>

      {/* Application Details */}
      <Card>
        <CardHeader>
          <CardTitle>Application Information</CardTitle>
          <CardDescription>
            Submitted{' '}
            {application.createdAt
              ? new Date(application.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Handle</p>
                  <p className="text-sm text-muted-foreground">{application.handle ?? 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{application.email ?? 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Sector</p>
                  <p className="text-sm text-muted-foreground">{application.sector ?? 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <GraduationCap className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Career Stage</p>
                  <p className="text-sm text-muted-foreground">
                    {application.careerStage ?? 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Affiliations</p>
                  {application.affiliations && application.affiliations.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {application.affiliations.map((aff: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {aff}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None provided</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Keywords</p>
                  {application.researchKeywords && application.researchKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {application.researchKeywords.map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None provided</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageSquare className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Motivation</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {application.motivation ?? 'None provided'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DID Information */}
      <Card>
        <CardHeader>
          <CardTitle>DID</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-mono text-muted-foreground break-all">{decodedDid}</p>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Update the status of this alpha application</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {application.status !== 'approved' && (
            <Button onClick={() => setConfirmType('approve')}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          )}
          {application.status !== 'rejected' && (
            <Button variant="outline" onClick={() => setConfirmType('reject')}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}
          {application.status === 'approved' && (
            <Button variant="destructive" onClick={() => setConfirmType('revoke')}>
              <Ban className="mr-2 h-4 w-4" />
              Revoke Access
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmType} onOpenChange={() => setConfirmType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{confirmType} Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmType} the application for{' '}
              <span className="font-semibold">{application.handle ?? decodedDid}</span>?
            </DialogDescription>
          </DialogHeader>
          {(confirmType === 'reject' || confirmType === 'revoke') && (
            <div className="space-y-2">
              <label htmlFor="detail-reason" className="text-sm font-medium">
                Reason {confirmType === 'reject' ? '(optional)' : '(required)'}
              </label>
              <Input
                id="detail-reason"
                placeholder={`Reason for ${confirmType}...`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmType(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmType === 'approve' ? 'default' : 'destructive'}
              onClick={handleConfirm}
              disabled={updateApplication.isPending || (confirmType === 'revoke' && !reason.trim())}
            >
              {updateApplication.isPending ? 'Processing...' : confirmType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
