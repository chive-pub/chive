'use client';

import Link from 'next/link';
import { ArrowLeft, Server, CheckCircle2, XCircle, RefreshCw, Database } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAdminPDSes, useRescanPDS } from '@/lib/hooks/use-admin';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Formats an ISO date string as a relative date.
 */
function formatRelativeDate(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

/**
 * Returns badge styling for a PDS status value.
 */
function statusBadge(status: string): { className: string; label: string } {
  switch (status) {
    case 'active':
      return { className: 'bg-green-500/15 text-green-700 border-green-200', label: 'Healthy' };
    case 'stale':
      return {
        className: 'bg-yellow-500/15 text-yellow-700 border-yellow-200',
        label: 'Stale',
      };
    case 'unreachable':
      return { className: 'bg-red-500/15 text-red-700 border-red-200', label: 'Unhealthy' };
    default:
      return { className: 'bg-gray-500/15 text-gray-700 border-gray-200', label: 'Unknown' };
  }
}

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number | null;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value?.toLocaleString() ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// PAGE
// =============================================================================

/**
 * PDS Registry administration page.
 *
 * @remarks
 * Displays registered Personal Data Servers with health status,
 * record counts, and rescan actions.
 */
export default function AdminPDSPage() {
  const { data, isLoading } = useAdminPDSes();
  const rescanMutation = useRescanPDS();

  const stats = data?.stats;
  const entries = stats?.items ?? [];

  const totalRegistered = stats?.total ?? entries.length;
  const withRecords = stats?.withRecords ?? entries.filter((e) => e.recordCount > 0).length;
  const healthy = stats?.healthy ?? entries.filter((e) => e.status === 'active').length;
  const unhealthy = stats?.unhealthy ?? entries.filter((e) => e.status === 'unreachable').length;

  function handleRescan(pdsUrl: string): void {
    rescanMutation.mutate(
      { pdsUrl },
      {
        onSuccess: () => toast.success(`Rescan triggered for ${pdsUrl}`),
        onError: (error) => toast.error(`Rescan failed: ${error.message}`),
      }
    );
  }

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
          <h1 className="text-3xl font-bold tracking-tight">PDS Registry</h1>
          <p className="text-muted-foreground">Registered Personal Data Servers</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Registered"
          value={isLoading ? null : totalRegistered}
          icon={Server}
          loading={isLoading}
        />
        <StatCard
          title="With Records"
          value={isLoading ? null : withRecords}
          icon={Database}
          loading={isLoading}
        />
        <StatCard
          title="Healthy"
          value={isLoading ? null : healthy}
          icon={CheckCircle2}
          loading={isLoading}
        />
        <StatCard
          title="Unhealthy"
          value={isLoading ? null : unhealthy}
          icon={XCircle}
          loading={isLoading}
        />
      </div>

      {/* PDS Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered PDSes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center">
              <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No PDSes registered.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PDS URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Scan</TableHead>
                    <TableHead className="text-right">Record Count</TableHead>
                    <TableHead className="text-right">User Count</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const badge = statusBadge(entry.status);
                    return (
                      <TableRow key={entry.url}>
                        <TableCell className="font-medium font-mono text-sm max-w-[300px] truncate">
                          {entry.url}
                        </TableCell>
                        <TableCell>
                          <Badge className={badge.className}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.lastScanAt ? formatRelativeDate(entry.lastScanAt) : 'Never'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.recordCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.userCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRescan(entry.url)}
                            disabled={rescanMutation.isPending}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Rescan
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
