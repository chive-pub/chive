'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  RefreshCw,
  Play,
  XCircle,
  Server,
  Clock,
  BookOpen,
  Database,
  Shield,
  Users,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  useBackfillStatus,
  useBackfillHistory,
  useTriggerPDSScan,
  useTriggerFreshnessScan,
  useTriggerCitationExtraction,
  useTriggerFullReindex,
  useTriggerGovernanceSync,
  useTriggerDIDSync,
  useCancelBackfill,
} from '@/lib/hooks/use-admin';
import type { BackfillOperation } from '@/lib/hooks/use-admin';

/**
 * Formats elapsed time from a start timestamp to a human-readable string.
 *
 * @param startedAt - ISO 8601 timestamp of when the operation started
 * @returns formatted duration (e.g., "45s", "3m 12s", "1h 5m")
 */
function formatDuration(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Formats a completed duration from start and end timestamps.
 *
 * @param startedAt - start timestamp
 * @param completedAt - end timestamp
 * @returns formatted duration string
 */
function formatCompletedDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Returns a color class for a backfill operation status badge.
 *
 * @param status - operation status
 * @returns Tailwind CSS classes for the badge
 */
function operationStatusClass(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-blue-500/15 text-blue-700 border-blue-200';
    case 'completed':
      return 'bg-green-500/15 text-green-700 border-green-200';
    case 'failed':
      return 'bg-red-500/15 text-red-700 border-red-200';
    case 'cancelled':
      return 'bg-gray-500/15 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-500/15 text-gray-700 border-gray-200';
  }
}

/**
 * Returns a color class for a backfill operation type badge.
 *
 * @param type - operation type
 * @returns Tailwind CSS classes for the badge
 */
function operationTypeClass(type: string): string {
  switch (type) {
    case 'pdsScan':
      return 'bg-purple-500/15 text-purple-700 border-purple-200';
    case 'freshnessScan':
      return 'bg-cyan-500/15 text-cyan-700 border-cyan-200';
    case 'citationExtraction':
      return 'bg-orange-500/15 text-orange-700 border-orange-200';
    case 'fullReindex':
      return 'bg-red-500/15 text-red-700 border-red-200';
    case 'governanceSync':
      return 'bg-indigo-500/15 text-indigo-700 border-indigo-200';
    case 'didSync':
      return 'bg-teal-500/15 text-teal-700 border-teal-200';
    default:
      return 'bg-gray-500/15 text-gray-700 border-gray-200';
  }
}

/**
 * Backfill operations control center.
 *
 * Displays active backfill operations with progress bars, provides trigger cards
 * for starting new operations, and shows a history of completed operations.
 * Status polls every 5 seconds while the page is open.
 */
export default function AdminBackfillPage() {
  const { data: backfillStatus, isLoading } = useBackfillStatus();
  const { data: historyData, isLoading: isHistoryLoading } = useBackfillHistory();
  const triggerPDSScan = useTriggerPDSScan();
  const triggerFreshnessScan = useTriggerFreshnessScan();
  const triggerCitationExtraction = useTriggerCitationExtraction();
  const triggerFullReindex = useTriggerFullReindex();
  const triggerGovernanceSync = useTriggerGovernanceSync();
  const triggerDIDSync = useTriggerDIDSync();
  const cancelBackfill = useCancelBackfill();

  const [pdsUrl, setPdsUrl] = useState('');
  const [batchSize, setBatchSize] = useState('100');
  const [didInput, setDidInput] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'reindex' | 'cancel';
    operationId?: string;
  } | null>(null);

  const operations = backfillStatus?.operations ?? [];
  const activeOps = operations.filter((op) => op.status === 'running');
  const completedOps = historyData?.operations ?? [];

  const handleTriggerPDSScan = () => {
    const input = pdsUrl.trim() ? { pdsUrl: pdsUrl.trim() } : {};
    triggerPDSScan.mutate(input, {
      onSuccess: () => {
        toast.success(pdsUrl.trim() ? 'PDS scan triggered' : 'Full PDS scan triggered');
        setPdsUrl('');
      },
      onError: () => toast.error('Failed to trigger PDS scan'),
    });
  };

  const handleTriggerFreshnessScan = () => {
    triggerFreshnessScan.mutate(undefined, {
      onSuccess: () => toast.success('Freshness scan triggered'),
      onError: () => toast.error('Failed to trigger freshness scan'),
    });
  };

  const handleTriggerCitationExtraction = () => {
    triggerCitationExtraction.mutate(undefined, {
      onSuccess: () => {
        toast.success('Citation extraction triggered for all eprints');
      },
      onError: () => toast.error('Failed to trigger citation extraction'),
    });
  };

  const handleConfirmReindex = () => {
    const size = parseInt(batchSize, 10);
    triggerFullReindex.mutate(
      { type: 'fullReindex', options: { batchSize: isNaN(size) ? 100 : size } },
      {
        onSuccess: () => {
          toast.success('Full reindex started');
          setConfirmDialog(null);
          setBatchSize('100');
        },
        onError: () => {
          toast.error('Failed to start reindex');
          setConfirmDialog(null);
        },
      }
    );
  };

  const handleTriggerGovernanceSync = () => {
    triggerGovernanceSync.mutate(undefined, {
      onSuccess: () => toast.success('Governance sync triggered'),
      onError: () => toast.error('Failed to trigger governance sync'),
    });
  };

  const handleTriggerDIDSync = () => {
    const did = didInput.trim();
    if (!did) {
      toast.error('DID is required');
      return;
    }
    triggerDIDSync.mutate(
      { did },
      {
        onSuccess: () => {
          toast.success(`DID sync triggered for ${did}`);
          setDidInput('');
        },
        onError: () => toast.error('Failed to trigger DID sync'),
      }
    );
  };

  const handleCancelBackfill = () => {
    if (!confirmDialog?.operationId) return;
    cancelBackfill.mutate(
      { operationId: confirmDialog.operationId },
      {
        onSuccess: () => {
          toast.success('Operation cancelled');
          setConfirmDialog(null);
        },
        onError: () => {
          toast.error('Failed to cancel operation');
          setConfirmDialog(null);
        },
      }
    );
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Backfill Operations</h1>
          <p className="text-muted-foreground">Trigger and monitor data backfill operations</p>
        </div>
      </div>

      {/* Active Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            Active Operations
            {activeOps.length > 0 && <Badge variant="secondary">{activeOps.length}</Badge>}
          </CardTitle>
          <CardDescription>Currently running backfill operations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : activeOps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No active operations</p>
          ) : (
            <div className="space-y-6">
              {activeOps.map((op: BackfillOperation) => {
                const progressPercent = Math.round(op.progress ?? 0);
                return (
                  <div key={op.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={operationTypeClass(op.type)}>{op.type}</Badge>
                        <Badge className={operationStatusClass(op.status)}>{op.status}</Badge>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDialog({ type: 'cancel', operationId: op.id })}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {(op.recordsProcessed ?? 0).toLocaleString()} records ({progressPercent}%)
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <span>Elapsed: {formatDuration(op.startedAt)}</span>
                      <span>Records: {(op.recordsProcessed ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trigger New Backfill */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Trigger New Backfill</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* PDS Scan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                PDS Scan
              </CardTitle>
              <CardDescription>
                Scan one or all Personal Data Servers for new records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="PDS URL (optional, leave blank for all)"
                value={pdsUrl}
                onChange={(e) => setPdsUrl(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={handleTriggerPDSScan}
                disabled={triggerPDSScan.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {triggerPDSScan.isPending ? 'Starting...' : pdsUrl.trim() ? 'Scan PDS' : 'Scan All'}
              </Button>
            </CardContent>
          </Card>

          {/* Freshness Scan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Freshness Scan
              </CardTitle>
              <CardDescription>
                Check all indexed records for staleness against their source PDSes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={handleTriggerFreshnessScan}
                disabled={triggerFreshnessScan.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {triggerFreshnessScan.isPending ? 'Starting...' : 'Run Freshness Scan'}
              </Button>
            </CardContent>
          </Card>

          {/* Citation Extraction */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Citation Extraction
              </CardTitle>
              <CardDescription>Extract citations from all eprint PDFs via GROBID</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={handleTriggerCitationExtraction}
                disabled={triggerCitationExtraction.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {triggerCitationExtraction.isPending ? 'Starting...' : 'Extract All'}
              </Button>
            </CardContent>
          </Card>

          {/* Full ES Reindex */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                Full ES Reindex
              </CardTitle>
              <CardDescription>
                Rebuild the Elasticsearch index from PostgreSQL data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="batch-size" className="text-sm font-medium">
                  Batch Size
                </label>
                <Input
                  id="batch-size"
                  type="number"
                  placeholder="100"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  min={1}
                  max={10000}
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setConfirmDialog({ type: 'reindex' })}
                disabled={triggerFullReindex.isPending}
              >
                <Database className="mr-2 h-4 w-4" />
                {triggerFullReindex.isPending ? 'Starting...' : 'Start Reindex'}
              </Button>
            </CardContent>
          </Card>

          {/* Governance Sync */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Governance Sync
              </CardTitle>
              <CardDescription>
                Synchronize authority records from the Governance PDS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={handleTriggerGovernanceSync}
                disabled={triggerGovernanceSync.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {triggerGovernanceSync.isPending ? 'Starting...' : 'Sync Governance'}
              </Button>
            </CardContent>
          </Card>

          {/* DID Sync */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                DID Sync
              </CardTitle>
              <CardDescription>
                Resolve a DID to its PDS and scan all Chive collections for that user
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="did:plc:... (required)"
                value={didInput}
                onChange={(e) => setDidInput(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={handleTriggerDIDSync}
                disabled={triggerDIDSync.isPending || !didInput.trim()}
              >
                <Play className="mr-2 h-4 w-4" />
                {triggerDIDSync.isPending ? 'Starting...' : 'Sync DID'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Operation History */}
      <Card>
        <CardHeader>
          <CardTitle>Operation History</CardTitle>
          <CardDescription>Previously completed backfill operations</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isHistoryLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : completedOps.length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No completed operations</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedOps.map((op: BackfillOperation) => (
                  <TableRow key={op.id}>
                    <TableCell>
                      <Badge className={operationTypeClass(op.type)}>{op.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={operationStatusClass(op.status)}>{op.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(op.startedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {op.completedAt
                        ? formatCompletedDuration(op.startedAt, op.completedAt)
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      {(op.recordsProcessed ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground min-w-0 max-w-[200px]">
                      {op.error ? (
                        <span className="text-red-600 truncate block" title={op.error}>
                          {op.error}
                        </span>
                      ) : op.status === 'completed' ? (
                        <span className="text-green-600">Success</span>
                      ) : op.status === 'cancelled' ? (
                        <span className="text-gray-500">Cancelled</span>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog (Reindex or Cancel) */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === 'reindex' ? 'Confirm Full Reindex' : 'Cancel Operation'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === 'reindex'
                ? 'Starting a full Elasticsearch reindex will rebuild all search indexes from PostgreSQL. This is a resource-intensive operation that may temporarily affect search performance.'
                : 'Are you sure you want to cancel this backfill operation? Any progress will be lost.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={
                confirmDialog?.type === 'reindex' ? handleConfirmReindex : handleCancelBackfill
              }
              disabled={
                (confirmDialog?.type === 'reindex' && triggerFullReindex.isPending) ||
                (confirmDialog?.type === 'cancel' && cancelBackfill.isPending)
              }
            >
              {triggerFullReindex.isPending || cancelBackfill.isPending
                ? 'Processing...'
                : confirmDialog?.type === 'reindex'
                  ? 'Start Reindex'
                  : 'Cancel Operation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
