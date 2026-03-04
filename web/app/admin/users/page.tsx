'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Search,
  MoreHorizontal,
  Eye,
  ShieldPlus,
  ShieldMinus,
  Copy,
  Check,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminUserSearch, useAssignRole, useRevokeRole } from '@/lib/hooks/use-admin';

/**
 * Truncates a DID string for display, showing the first and last parts.
 */
function truncateDid(did: string): string {
  if (did.length <= 24) return did;
  return `${did.slice(0, 16)}...${did.slice(-8)}`;
}

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
 * User management page.
 *
 * @remarks
 * Allows administrators to search users, view their details,
 * and manage role assignments.
 */
export default function AdminUsersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [copiedDid, setCopiedDid] = useState<string | null>(null);

  const [roleDialog, setRoleDialog] = useState<{
    type: 'assign' | 'revoke';
    did: string;
    handle: string;
  } | null>(null);
  const [selectedRole, setSelectedRole] = useState('');

  const { data: usersData, isLoading } = useAdminUserSearch(debouncedQuery);
  const assignRole = useAssignRole();
  const revokeRole = useRevokeRole();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCopyDid = useCallback((did: string) => {
    navigator.clipboard.writeText(did).then(() => {
      setCopiedDid(did);
      setTimeout(() => setCopiedDid(null), 2000);
    });
  }, []);

  const handleRoleAction = async () => {
    if (!roleDialog || !selectedRole) return;

    try {
      if (roleDialog.type === 'assign') {
        await assignRole.mutateAsync({ did: roleDialog.did, role: selectedRole });
      } else {
        await revokeRole.mutateAsync({ did: roleDialog.did, role: selectedRole });
      }
    } finally {
      setRoleDialog(null);
      setSelectedRole('');
    }
  };

  const users = usersData?.users ?? [];

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
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Search users, view profiles, and manage role assignments
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by handle or DID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Users
            {usersData?.total !== undefined && (
              <span className="text-sm font-normal text-muted-foreground">
                ({usersData.total} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {debouncedQuery ? `No users found matching "${debouncedQuery}"` : 'No users found'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Handle</TableHead>
                  <TableHead>DID</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Eprints</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(
                  (user: {
                    did: string;
                    handle?: string;
                    roles?: string[];
                    eprintCount?: number;
                    reviewCount?: number;
                  }) => (
                    <TableRow key={user.did}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/users/${encodeURIComponent(user.did)}`}
                          className="text-primary hover:underline"
                        >
                          {user.handle ?? 'Unknown'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {truncateDid(user.did)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopyDid(user.did)}
                          >
                            {copiedDid === user.did ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span className="sr-only">Copy DID</span>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge key={role} className={`text-xs ${roleBadgeClass(role)}`}>
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{user.eprintCount ?? 0}</TableCell>
                      <TableCell className="text-right">{user.reviewCount ?? 0}</TableCell>
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
                              <Link href={`/admin/users/${encodeURIComponent(user.did)}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Detail
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setRoleDialog({
                                  type: 'assign',
                                  did: user.did,
                                  handle: user.handle ?? user.did,
                                })
                              }
                            >
                              <ShieldPlus className="mr-2 h-4 w-4" />
                              Assign Role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setRoleDialog({
                                  type: 'revoke',
                                  did: user.did,
                                  handle: user.handle ?? user.did,
                                })
                              }
                            >
                              <ShieldMinus className="mr-2 h-4 w-4" />
                              Revoke Role
                            </DropdownMenuItem>
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

      {/* Role Assignment/Revocation Dialog */}
      <Dialog open={!!roleDialog} onOpenChange={() => setRoleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {roleDialog?.type === 'assign' ? 'Assign Role' : 'Revoke Role'}
            </DialogTitle>
            <DialogDescription>
              {roleDialog?.type === 'assign' ? 'Assign a role to' : 'Revoke a role from'}{' '}
              <span className="font-semibold">{roleDialog?.handle}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="role-select" className="text-sm font-medium">
              Role
            </label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role-select">
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
            <Button variant="outline" onClick={() => setRoleDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={roleDialog?.type === 'assign' ? 'default' : 'destructive'}
              onClick={handleRoleAction}
              disabled={!selectedRole || assignRole.isPending || revokeRole.isPending}
            >
              {assignRole.isPending || revokeRole.isPending
                ? 'Processing...'
                : roleDialog?.type === 'assign'
                  ? 'Assign'
                  : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
