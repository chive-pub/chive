'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FlaskConical,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Ban,
  Eye,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  useAdminAlphaApplications,
  useAdminAlphaStats,
  useUpdateAlphaApplication,
} from '@/lib/hooks/use-admin';

type AlphaStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'revoked';

interface ConfirmAction {
  type: 'approve' | 'reject' | 'revoke';
  did: string;
  handle: string;
}

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
 * Alpha applications management page.
 *
 * @remarks
 * Allows administrators to view, filter, approve, reject, and revoke
 * alpha access applications.
 */
export default function AdminAlphaPage() {
  const [activeTab, setActiveTab] = useState<AlphaStatus>('all');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [reason, setReason] = useState('');

  const statusFilter = activeTab === 'all' ? undefined : activeTab;
  const { data: applications, isLoading: applicationsLoading } =
    useAdminAlphaApplications(statusFilter);
  const { data: stats, isLoading: statsLoading } = useAdminAlphaStats();
  const updateApplication = useUpdateAlphaApplication();

  const handleConfirm = async () => {
    if (!confirmAction) return;

    try {
      await updateApplication.mutateAsync({
        did: confirmAction.did,
        action: confirmAction.type,
        reason: reason || undefined,
      });
    } finally {
      setConfirmAction(null);
      setReason('');
    }
  };

  const applicationList = applications?.items ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alpha Applications</h1>
          <p className="text-muted-foreground">
            Manage alpha access requests from prospective users
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 md:grid-cols-4">
        {(['pending', 'approved', 'rejected', 'revoked'] as const).map((status) => (
          <Card key={status}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium capitalize">{status}</CardTitle>
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{stats?.byStatus?.[status] ?? 0}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Filters & Table */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AlphaStatus)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="revoked">Revoked</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {applicationsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : applicationList.length === 0 ? (
                <div className="p-8 text-center">
                  <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No {activeTab === 'all' ? '' : activeTab} applications found.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Handle</TableHead>
                      <TableHead>DID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Career Stage</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applicationList.map(
                      (app: {
                        did: string;
                        handle?: string;
                        email?: string;
                        sector?: string;
                        careerStage?: string;
                        appliedAt?: string;
                        status?: string;
                      }) => (
                        <TableRow key={app.did}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/admin/alpha/${encodeURIComponent(app.did)}`}
                              className="text-primary hover:underline"
                            >
                              {app.handle ?? 'N/A'}
                            </Link>
                          </TableCell>
                          <TableCell className="min-w-0">
                            <span className="truncate block max-w-[200px] font-mono text-xs">
                              {app.did}
                            </span>
                          </TableCell>
                          <TableCell className="min-w-0">
                            <span className="truncate block max-w-[200px]">
                              {app.email ?? 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>{app.sector ?? 'N/A'}</TableCell>
                          <TableCell>{app.careerStage ?? 'N/A'}</TableCell>
                          <TableCell>
                            {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadgeClass(app.status ?? 'pending')}>
                              {app.status ?? 'pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/alpha/${encodeURIComponent(app.did)}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Detail
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {app.status !== 'approved' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirmAction({
                                        type: 'approve',
                                        did: app.did,
                                        handle: app.handle ?? app.did,
                                      })
                                    }
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve
                                  </DropdownMenuItem>
                                )}
                                {app.status !== 'rejected' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirmAction({
                                        type: 'reject',
                                        did: app.did,
                                        handle: app.handle ?? app.did,
                                      })
                                    }
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject
                                  </DropdownMenuItem>
                                )}
                                {app.status === 'approved' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirmAction({
                                        type: 'revoke',
                                        did: app.did,
                                        handle: app.handle ?? app.did,
                                      })
                                    }
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Revoke
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{confirmAction?.type} Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmAction?.type} the application for{' '}
              <span className="font-semibold">{confirmAction?.handle}</span>?
            </DialogDescription>
          </DialogHeader>
          {(confirmAction?.type === 'reject' || confirmAction?.type === 'revoke') && (
            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason {confirmAction.type === 'reject' ? '(optional)' : '(required)'}
              </label>
              <Input
                id="reason"
                placeholder={`Reason for ${confirmAction.type}...`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === 'approve' ? 'default' : 'destructive'}
              onClick={handleConfirm}
              disabled={
                updateApplication.isPending || (confirmAction?.type === 'revoke' && !reason.trim())
              }
            >
              {updateApplication.isPending
                ? 'Processing...'
                : `${confirmAction?.type === 'approve' ? 'Approve' : confirmAction?.type === 'reject' ? 'Reject' : 'Revoke'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
