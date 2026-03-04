'use client';

import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  ShieldPlus,
  ShieldMinus,
  FileText,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Clock,
  Copy,
  Check,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminUserDetail, useAssignRole, useRevokeRole } from '@/lib/hooks/use-admin';

/**
 * Returns a color class for a role badge.
 */
function roleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':
    case 'administrator':
      return 'bg-purple-500/15 text-purple-700 border-purple-200';
    case 'moderator':
      return 'bg-blue-500/15 text-blue-700 border-blue-200';
    case 'trusted_editor':
      return 'bg-green-500/15 text-green-700 border-green-200';
    case 'alpha':
      return 'bg-yellow-500/15 text-yellow-700 border-yellow-200';
    default:
      return 'bg-gray-500/15 text-gray-700 border-gray-200';
  }
}

/**
 * User detail page.
 *
 * @remarks
 * Displays a user profile with roles, stats, warnings, violations,
 * and provides role management actions.
 */
export default function AdminUserDetailPage({ params }: { params: Promise<{ did: string }> }) {
  const { did } = use(params);
  const decodedDid = decodeURIComponent(did);

  const { data: user, isLoading } = useAdminUserDetail(decodedDid);
  const assignRole = useAssignRole();
  const revokeRole = useRevokeRole();

  const [roleAction, setRoleAction] = useState<'assign' | 'revoke' | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [copiedDid, setCopiedDid] = useState(false);

  const handleCopyDid = () => {
    navigator.clipboard.writeText(decodedDid).then(() => {
      setCopiedDid(true);
      setTimeout(() => setCopiedDid(false), 2000);
    });
  };

  const handleRoleAction = async () => {
    if (!roleAction || !selectedRole) return;

    try {
      if (roleAction === 'assign') {
        await assignRole.mutateAsync({ did: decodedDid, role: selectedRole });
      } else {
        await revokeRole.mutateAsync({ did: decodedDid, role: selectedRole });
      }
    } finally {
      setRoleAction(null);
      setSelectedRole('');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/users"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Not Found</h1>
            <p className="text-muted-foreground">No user found for DID: {decodedDid}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {user.displayName ?? user.handle ?? 'Unknown User'}
          </h1>
          <p className="text-muted-foreground">User profile and management</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.handle ?? ''}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate">
                  {user.displayName ?? user.handle ?? 'Unknown'}
                </CardTitle>
                <CardDescription className="truncate">@{user.handle ?? 'unknown'}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">DID</p>
              <div className="flex items-center gap-1">
                <p className="text-xs font-mono text-muted-foreground break-all min-w-0">
                  {decodedDid}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={handleCopyDid}
                >
                  {copiedDid ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Roles</p>
              <div className="flex flex-wrap gap-1">
                {user.roles && user.roles.length > 0 ? (
                  user.roles.map((role: string) => (
                    <Badge key={role} className={`text-xs ${roleBadgeClass(role)}`}>
                      {role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No roles assigned</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setRoleAction('assign')}>
                <ShieldPlus className="mr-1 h-3 w-3" />
                Assign
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRoleAction('revoke')}>
                <ShieldMinus className="mr-1 h-3 w-3" />
                Revoke
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats & Activity */}
        <div className="md:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eprints</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{user.eprintCount ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reviews</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{user.reviewCount ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Endorsements</CardTitle>
                <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{user.endorsementCount ?? 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Warnings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Warnings & Violations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.warnings && user.warnings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.warnings.map(
                      (
                        warning: { type?: string; reason?: string; createdAt?: string },
                        i: number
                      ) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge variant="outline">{warning.type ?? 'Warning'}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{warning.reason ?? 'N/A'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {warning.createdAt
                              ? new Date(warning.createdAt).toLocaleDateString()
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No warnings or violations on record.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.recentActivity && user.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {user.recentActivity.map(
                    (
                      activity: { type?: string; description?: string; createdAt?: string },
                      i: number
                    ) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium">{activity.type ?? 'Activity'}</p>
                          <p className="text-muted-foreground">{activity.description ?? ''}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {activity.createdAt
                              ? new Date(activity.createdAt).toLocaleString()
                              : ''}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Role Dialog */}
      <Dialog open={!!roleAction} onOpenChange={() => setRoleAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roleAction === 'assign' ? 'Assign Role' : 'Revoke Role'}</DialogTitle>
            <DialogDescription>
              {roleAction === 'assign' ? 'Assign a role to' : 'Revoke a role from'}{' '}
              <span className="font-semibold">{user?.handle ?? decodedDid}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="user-role-select" className="text-sm font-medium">
              Role
            </label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="user-role-select">
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="trusted_editor">Trusted Editor</SelectItem>
                <SelectItem value="alpha">Alpha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleAction(null)}>
              Cancel
            </Button>
            <Button
              variant={roleAction === 'assign' ? 'default' : 'destructive'}
              onClick={handleRoleAction}
              disabled={!selectedRole || assignRole.isPending || revokeRole.isPending}
            >
              {assignRole.isPending || revokeRole.isPending
                ? 'Processing...'
                : roleAction === 'assign'
                  ? 'Assign'
                  : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
