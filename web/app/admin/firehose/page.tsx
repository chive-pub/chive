'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Radio,
  AlertTriangle,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  CircleDot,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  useFirehoseStatus,
  useAdminDLQEntries,
  useRetryDLQEntry,
  useDismissDLQEntry,
  useRetryAllDLQ,
  usePurgeOldDLQ,
} from '@/lib/hooks/use-admin';

/**
 * Formats milliseconds as a human-readable duration string.
 *
 * @param ms - duration in milliseconds
 * @returns formatted string (e.g., "1.5s", "3.2m", "1.1h")
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

/**
 * Truncates a string to the specified length with an ellipsis.
 *
 * @param str - the string to truncate
 * @param maxLength - maximum character length before truncation
 * @returns the truncated string with trailing ellipsis, or the original if short enough
 */
function truncateStr(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

/**
 * Firehose and indexing management page.
 *
 * Displays real-time firehose connection status, cursor position, lag metrics,
 * and a dead letter queue table with retry and purge operations.
 */
export default function AdminFirehosePage() {
  const { data: firehose, isLoading: firehoseLoading } = useFirehoseStatus();
  const { data: dlqData, isLoading: dlqLoading } = useAdminDLQEntries();
  const retryEntry = useRetryDLQEntry();
  const dismissEntry = useDismissDLQEntry();
  const retryAll = useRetryAllDLQ();
  const purgeOldDLQ = usePurgeOldDLQ();

  const [batchDialog, setBatchDialog] = useState<'retryAll' | 'purge' | null>(null);
  const [selectedErrorType, setSelectedErrorType] = useState('');

  const dlqEntries = dlqData?.entries ?? [];
  const dlqTotal = dlqData?.total ?? dlqEntries.length;

  const handleRetryEntry = (index: number) => {
    retryEntry.mutate(
      { index },
      {
        onSuccess: () => toast.success('Entry queued for retry'),
        onError: () => toast.error('Failed to retry entry'),
      }
    );
  };

  const handleDismissEntry = (index: number) => {
    dismissEntry.mutate(
      { index },
      {
        onSuccess: () => toast.success('Entry dismissed'),
        onError: () => toast.error('Failed to dismiss entry'),
      }
    );
  };

  const handleBatchAction = async () => {
    try {
      if (batchDialog === 'retryAll') {
        await retryAll.mutateAsync();
        toast.success('All entries queued for retry');
      } else if (batchDialog === 'purge') {
        await purgeOldDLQ.mutateAsync({ olderThanDays: 7 });
        toast.success('Old entries purged');
      }
    } catch {
      toast.error(
        batchDialog === 'retryAll' ? 'Failed to retry entries' : 'Failed to purge entries'
      );
    } finally {
      setBatchDialog(null);
      setSelectedErrorType('');
    }
  };

  const isActive = firehose?.cursor != null;

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
          <h1 className="text-3xl font-bold tracking-tight">Firehose & Indexing</h1>
          <p className="text-muted-foreground">Monitor event processing and dead letter queue</p>
        </div>
      </div>

      {/* Real-time Status Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-muted-foreground" />
            Firehose Status
          </CardTitle>
          <CardDescription>Real-time connection and processing metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {firehoseLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : firehose ? (
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <CircleDot
                    className={`h-4 w-4 ${isActive ? 'text-green-500' : 'text-red-500'}`}
                  />
                  <span className="font-semibold">{isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cursor</p>
                <p className="font-mono text-sm">{firehose.cursor ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">DLQ Count</p>
                <p className="font-semibold">{firehose.dlqCount ?? 0}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Firehose status unavailable
            </p>
          )}
        </CardContent>
      </Card>

      {/* DLQ Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Dead Letter Queue
              {dlqTotal > 0 && <Badge variant="destructive">{dlqTotal}</Badge>}
            </CardTitle>
            <CardDescription>
              Events that failed processing and require manual review
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchDialog('retryAll')}
              disabled={dlqEntries.length === 0}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchDialog('purge')}
              disabled={dlqEntries.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Purge Old
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dlqLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : dlqEntries.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No dead letter queue entries</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error Type</TableHead>
                  <TableHead>Event URI</TableHead>
                  <TableHead>DID</TableHead>
                  <TableHead className="text-right">Retry Count</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dlqEntries.map(
                  (
                    entry: {
                      id?: string;
                      uri?: string;
                      collection?: string;
                      error?: string;
                      attempts?: number;
                      createdAt?: string;
                      did?: string;
                    },
                    idx: number
                  ) => {
                    const did = entry.did ?? entry.uri?.split('/')[2] ?? '';
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="outline">
                            {entry.collection ?? entry.error ?? 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs min-w-0 max-w-[200px]">
                          <span className="truncate block" title={entry.uri}>
                            {entry.uri ? truncateStr(entry.uri, 40) : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs min-w-0 max-w-[150px]">
                          <span className="truncate block" title={did}>
                            {did ? truncateStr(did, 24) : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{entry.attempts ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.createdAt
                            ? formatDuration(Date.now() - new Date(entry.createdAt).getTime())
                            : 'N/A'}
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
                              <DropdownMenuItem
                                onClick={() => handleRetryEntry(idx)}
                                disabled={retryEntry.isPending}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Retry
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDismissEntry(idx)}
                                disabled={dismissEntry.isPending}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Dismiss
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  }
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Batch Action Confirmation Dialog */}
      <Dialog open={!!batchDialog} onOpenChange={() => setBatchDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {batchDialog === 'retryAll' ? 'Retry All DLQ Entries' : 'Purge Old Entries'}
            </DialogTitle>
            <DialogDescription>
              {batchDialog === 'retryAll'
                ? 'Retry all failed entries in the dead letter queue. Optionally filter by error type.'
                : 'Remove entries older than 7 days from the dead letter queue. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          {batchDialog === 'retryAll' && (
            <div className="space-y-2">
              <label htmlFor="error-type-filter" className="text-sm font-medium">
                Error Type Filter (optional)
              </label>
              <Select value={selectedErrorType} onValueChange={setSelectedErrorType}>
                <SelectTrigger id="error-type-filter">
                  <SelectValue placeholder="All error types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="validation">Validation Error</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                  <SelectItem value="connection">Connection Error</SelectItem>
                  <SelectItem value="parse">Parse Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={batchDialog === 'purge' ? 'destructive' : 'default'}
              onClick={handleBatchAction}
              disabled={retryAll.isPending || purgeOldDLQ.isPending}
            >
              {retryAll.isPending || purgeOldDLQ.isPending
                ? 'Processing...'
                : batchDialog === 'retryAll'
                  ? 'Retry All'
                  : 'Purge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
