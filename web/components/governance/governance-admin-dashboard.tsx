'use client';

/**
 * Governance admin dashboard component.
 *
 * @remarks
 * Administrative dashboard for governance committee members to manage
 * trusted editors, delegations, and review pending authority proposals.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Search,
  RefreshCw,
  AlertCircle,
  Key,
  UserPlus,
  UserMinus,
  Eye,
  Star,
  BookOpen,
  Award,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuLabel,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { GovernanceRole, EditorStatus, ReputationMetrics } from './trusted-editor-status';

/**
 * Trusted editor record.
 *
 * @remarks
 * Uses open union for role to be compatible with lexicon-generated types.
 */
export interface TrustedEditorRecord {
  did: string;
  handle?: string;
  displayName?: string;
  role: GovernanceRole | (string & {});
  roleGrantedAt: number;
  roleGrantedBy?: string;
  hasDelegation: boolean;
  delegationExpiresAt?: number;
  recordsCreatedToday?: number;
  dailyRateLimit?: number;
  metrics: ReputationMetrics;
}

/**
 * Pending elevation request.
 *
 * @remarks
 * Uses open union for roles and string for requestedAt to be compatible
 * with lexicon-generated types.
 */
export interface ElevationRequest {
  id: string;
  did: string;
  handle?: string;
  displayName?: string;
  requestedRole: GovernanceRole | (string & {});
  currentRole: GovernanceRole | (string & {});
  /** Request timestamp (ISO string or Unix timestamp) */
  requestedAt: string | number;
  metrics: ReputationMetrics;
  verificationNotes?: string;
}

/**
 * Delegation record.
 */
export interface DelegationRecord {
  id: string;
  delegateDid: string;
  handle?: string;
  displayName?: string;
  collections: string[];
  expiresAt: number;
  maxRecordsPerDay: number;
  recordsCreatedToday: number;
  grantedAt: number;
  grantedBy: string;
  active: boolean;
}

/**
 * Props for GovernanceAdminDashboard component.
 */
export interface GovernanceAdminDashboardProps {
  /** List of trusted editors */
  editors?: TrustedEditorRecord[];
  /** List of pending elevation requests */
  elevationRequests?: ElevationRequest[];
  /** List of active delegations */
  delegations?: DelegationRecord[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Whether current user is administrator */
  isAdmin?: boolean;
  /** Callback to approve elevation request */
  onApproveElevation?: (requestId: string, notes?: string) => Promise<void>;
  /** Callback to reject elevation request */
  onRejectElevation?: (requestId: string, reason: string) => Promise<void>;
  /** Callback to revoke role */
  onRevokeRole?: (did: string, reason: string) => Promise<void>;
  /** Callback to grant delegation */
  onGrantDelegation?: (did: string, collections: string[], daysValid: number) => Promise<void>;
  /** Callback to revoke delegation */
  onRevokeDelegation?: (delegationId: string) => Promise<void>;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Role display configuration.
 *
 * @remarks
 * Uses string index for compatibility with lexicon's open union types.
 */
const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  'community-member': {
    label: 'Community',
    icon: Shield,
    color: 'text-muted-foreground',
  },
  'trusted-editor': {
    label: 'Trusted Editor',
    icon: ShieldCheck,
    color: 'text-green-600 dark:text-green-400',
  },
  'graph-editor': {
    label: 'Graph Editor',
    icon: BookOpen,
    color: 'text-blue-600 dark:text-blue-400',
  },
  'domain-expert': {
    label: 'Domain Expert',
    icon: Star,
    color: 'text-amber-600 dark:text-amber-400',
  },
  administrator: {
    label: 'Administrator',
    icon: Award,
    color: 'text-purple-600 dark:text-purple-400',
  },
};

/**
 * Governance admin dashboard.
 *
 * @example
 * ```tsx
 * <GovernanceAdminDashboard
 *   editors={editors}
 *   elevationRequests={requests}
 *   delegations={delegations}
 *   isAdmin={true}
 *   onApproveElevation={handleApprove}
 * />
 * ```
 */
export function GovernanceAdminDashboard({
  editors = [],
  elevationRequests = [],
  delegations = [],
  isLoading,
  error,
  isAdmin = false,
  onApproveElevation,
  onRejectElevation,
  onRevokeRole,
  onGrantDelegation,
  onRevokeDelegation,
  onRefresh,
  className,
}: GovernanceAdminDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('editors');
  const [revokeDialog, setRevokeDialog] = useState<{ did: string; name: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [elevationDialog, setElevationDialog] = useState<ElevationRequest | null>(null);
  const [elevationNotes, setElevationNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [delegationDialog, setDelegationDialog] = useState<{ did: string; name: string } | null>(
    null
  );
  const [delegationDays, setDelegationDays] = useState('365');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredEditors = editors.filter(
    (e) =>
      e.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.handle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.did.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const trustedEditorCount = editors.filter((e) => e.role !== 'community-member').length;

  const activeDelegationCount = delegations.filter((d) => d.active).length;

  const handleApproveElevation = useCallback(async () => {
    if (!elevationDialog || !onApproveElevation) return;
    setIsProcessing(true);
    try {
      await onApproveElevation(elevationDialog.id, elevationNotes);
      setElevationDialog(null);
      setElevationNotes('');
    } finally {
      setIsProcessing(false);
    }
  }, [elevationDialog, elevationNotes, onApproveElevation]);

  const handleRejectElevation = useCallback(async () => {
    if (!elevationDialog || !onRejectElevation || !rejectReason) return;
    setIsProcessing(true);
    try {
      await onRejectElevation(elevationDialog.id, rejectReason);
      setElevationDialog(null);
      setRejectReason('');
    } finally {
      setIsProcessing(false);
    }
  }, [elevationDialog, rejectReason, onRejectElevation]);

  const handleRevokeRole = useCallback(async () => {
    if (!revokeDialog || !onRevokeRole || !revokeReason) return;
    setIsProcessing(true);
    try {
      await onRevokeRole(revokeDialog.did, revokeReason);
      setRevokeDialog(null);
      setRevokeReason('');
    } finally {
      setIsProcessing(false);
    }
  }, [revokeDialog, revokeReason, onRevokeRole]);

  const handleGrantDelegation = useCallback(async () => {
    if (!delegationDialog || !onGrantDelegation) return;
    setIsProcessing(true);
    try {
      await onGrantDelegation(
        delegationDialog.did,
        ['pub.chive.graph.authority', 'pub.chive.graph.facet', 'pub.chive.graph.concept'],
        parseInt(delegationDays, 10)
      );
      setDelegationDialog(null);
      setDelegationDays('365');
    } finally {
      setIsProcessing(false);
    }
  }, [delegationDialog, delegationDays, onGrantDelegation]);

  if (!isAdmin) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Restricted</AlertTitle>
        <AlertDescription>
          The governance admin dashboard is only accessible to administrators.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <GovernanceAdminDashboardSkeleton className={className} />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Governance Administration</h2>
          <p className="text-muted-foreground">
            Manage trusted editors, delegations, and elevation requests
          </p>
        </div>
        {onRefresh && (
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trusted Editors</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trustedEditorCount}</div>
            <p className="text-xs text-muted-foreground">Active trusted+ roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Delegations</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDelegationCount}</div>
            <p className="text-xs text-muted-foreground">PDS write delegations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{elevationRequests.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Editors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{editors.length}</div>
            <p className="text-xs text-muted-foreground">All governance participants</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="editors">
            <Users className="mr-2 h-4 w-4" />
            Editors
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Clock className="mr-2 h-4 w-4" />
            Requests
            {elevationRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {elevationRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="delegations">
            <Key className="mr-2 h-4 w-4" />
            Delegations
          </TabsTrigger>
        </TabsList>

        {/* Editors Tab */}
        <TabsContent value="editors" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search editors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Editor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Delegation</TableHead>
                  <TableHead>Reputation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEditors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No editors found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEditors.map((editor) => {
                    // Fallback for unknown roles (forward compatibility)
                    const roleConfig = ROLE_CONFIG[editor.role] ?? {
                      label: editor.role,
                      icon: Shield,
                      color: 'text-muted-foreground',
                    };
                    const RoleIcon = roleConfig.icon;
                    return (
                      <TableRow key={editor.did}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {editor.displayName || editor.handle || 'Unknown'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {editor.handle
                                ? `@${editor.handle}`
                                : editor.did.slice(0, 20) + '...'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <RoleIcon className={cn('h-4 w-4', roleConfig.color)} />
                            <span>{roleConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {editor.hasDelegation ? (
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              None
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {editor.metrics.reputationScore.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Profile
                              </DropdownMenuItem>
                              {editor.role !== 'community-member' && !editor.hasDelegation && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setDelegationDialog({
                                      did: editor.did,
                                      name: editor.displayName || editor.handle || editor.did,
                                    })
                                  }
                                >
                                  <Key className="mr-2 h-4 w-4" />
                                  Grant Delegation
                                </DropdownMenuItem>
                              )}
                              {editor.role !== 'community-member' && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    setRevokeDialog({
                                      did: editor.did,
                                      name: editor.displayName || editor.handle || editor.did,
                                    })
                                  }
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  Revoke Role
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Elevation Requests</CardTitle>
              <CardDescription>Review and approve requests for role elevation</CardDescription>
            </CardHeader>
            <CardContent>
              {elevationRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-muted-foreground">No pending elevation requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {elevationRequests.map((request) => {
                    // Fallback for unknown roles (forward compatibility)
                    const requestedConfig = ROLE_CONFIG[request.requestedRole] ?? {
                      label: request.requestedRole,
                      icon: Shield,
                      color: 'text-muted-foreground',
                    };
                    const RequestedIcon = requestedConfig.icon;
                    // Handle both ISO string and Unix timestamp formats
                    const requestDate =
                      typeof request.requestedAt === 'string'
                        ? new Date(request.requestedAt)
                        : new Date(request.requestedAt);
                    return (
                      <div
                        key={request.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-full bg-muted p-2">
                            <RequestedIcon className={cn('h-5 w-5', requestedConfig.color)} />
                          </div>
                          <div>
                            <p className="font-medium">
                              {request.displayName || request.handle || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Requesting: {requestedConfig.label}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Reputation: {request.metrics.reputationScore.toFixed(2)}</span>
                              <span>|</span>
                              <span>Requested: {requestDate.toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setElevationDialog(request)}
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delegations Tab */}
        <TabsContent value="delegations" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delegate</TableHead>
                  <TableHead>Collections</TableHead>
                  <TableHead>Usage Today</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No delegations found
                    </TableCell>
                  </TableRow>
                ) : (
                  delegations.map((delegation) => (
                    <TableRow key={delegation.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {delegation.displayName || delegation.handle || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {delegation.handle
                              ? `@${delegation.handle}`
                              : delegation.delegateDid.slice(0, 20) + '...'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {delegation.collections.map((c) => (
                            <Badge key={c} variant="secondary" className="text-xs">
                              {c.split('.').pop()}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {delegation.recordsCreatedToday} / {delegation.maxRecordsPerDay}
                      </TableCell>
                      <TableCell>{new Date(delegation.expiresAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {delegation.active ? (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          >
                            Revoked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {delegation.active && onRevokeDelegation && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => onRevokeDelegation(delegation.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Revoke Role Dialog */}
      <Dialog open={!!revokeDialog} onOpenChange={() => setRevokeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Editor Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the trusted editor role from {revokeDialog?.name}?
              This action will be logged and can be reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="revoke-reason">Reason for revocation</Label>
              <Textarea
                id="revoke-reason"
                placeholder="Explain why this role is being revoked..."
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeRole}
              disabled={!revokeReason || isProcessing}
            >
              {isProcessing ? 'Revoking...' : 'Revoke Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Elevation Review Dialog */}
      <Dialog open={!!elevationDialog} onOpenChange={() => setElevationDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Elevation Request</DialogTitle>
            <DialogDescription>
              {elevationDialog?.displayName || elevationDialog?.handle} is requesting elevation to{' '}
              {elevationDialog &&
                (ROLE_CONFIG[elevationDialog.requestedRole]?.label ??
                  elevationDialog.requestedRole)}
              .
            </DialogDescription>
          </DialogHeader>
          {elevationDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-medium">Reputation Metrics</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Account Age: {elevationDialog.metrics.accountAgeDays} days</div>
                  <div>Eprints: {elevationDialog.metrics.eprintCount}</div>
                  <div>Well-endorsed: {elevationDialog.metrics.wellEndorsedEprintCount}</div>
                  <div>Proposals: {elevationDialog.metrics.proposalCount}</div>
                  <div>Votes: {elevationDialog.metrics.voteCount}</div>
                  <div>Score: {elevationDialog.metrics.reputationScore.toFixed(2)}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Verification Notes (optional)</Label>
                <Textarea
                  placeholder="Add any verification notes..."
                  value={elevationNotes}
                  onChange={(e) => setElevationNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rejection Reason (required if rejecting)</Label>
                <Textarea
                  placeholder="Explain why this request is being rejected..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setElevationDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectElevation}
              disabled={!rejectReason || isProcessing}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={handleApproveElevation} disabled={isProcessing}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Delegation Dialog */}
      <Dialog open={!!delegationDialog} onOpenChange={() => setDelegationDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant PDS Delegation</DialogTitle>
            <DialogDescription>
              Grant {delegationDialog?.name} write access to the Governance PDS for creating
              authority records, facets, and concepts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delegation Duration</Label>
              <Select value={delegationDays} onValueChange={setDelegationDays}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">Collections:</p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                <li>pub.chive.graph.authority</li>
                <li>pub.chive.graph.facet</li>
                <li>pub.chive.graph.concept</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegationDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleGrantDelegation} disabled={isProcessing}>
              {isProcessing ? 'Granting...' : 'Grant Delegation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Loading skeleton for GovernanceAdminDashboard.
 */
export function GovernanceAdminDashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-10 w-80" />
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
