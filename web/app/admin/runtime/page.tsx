'use client';

/**
 * Admin Node.js runtime metrics dashboard page.
 *
 * @remarks
 * Displays CPU usage, memory (heap, RSS), event loop lag,
 * process info, and Prometheus metric entries.
 * Refreshes every 10 seconds.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNodeMetrics } from '@/lib/hooks/use-admin';

/**
 * Converts bytes to megabytes.
 *
 * @param bytes - Value in bytes
 * @returns Value in megabytes
 */
function bytesToMb(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Formats megabyte values for display.
 *
 * @param mb - Value in megabytes
 * @returns Formatted string
 */
function formatMb(mb: number): string {
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Formats an uptime value in seconds to a human-readable string.
 *
 * @param seconds - Total seconds of uptime
 * @returns Formatted string (e.g., "3d 12h 45m")
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Computes an approximate CPU usage percentage from microsecond values and uptime.
 *
 * @param cpuUser - CPU user time in microseconds
 * @param cpuSystem - CPU system time in microseconds
 * @param uptimeSeconds - Process uptime in seconds
 * @returns Estimated CPU usage percentage (0-100)
 */
function computeCpuPercent(
  cpuUser: number | undefined,
  cpuSystem: number | undefined,
  uptimeSeconds: number
): number {
  if (cpuUser === undefined || cpuSystem === undefined || uptimeSeconds <= 0) return 0;
  const totalCpuSeconds = (cpuUser + cpuSystem) / 1_000_000;
  return Math.min(Math.round((totalCpuSeconds / uptimeSeconds) * 100), 100);
}

export default function RuntimePage() {
  const { data, isLoading } = useNodeMetrics();

  const pi = data?.processInfo;
  const heapUsedMb = bytesToMb(pi?.heapUsed ?? 0);
  const heapTotalMb = bytesToMb(pi?.heapTotal ?? 0);
  const rssMb = bytesToMb(pi?.rss ?? 0);
  const externalMb = bytesToMb(pi?.external ?? 0);
  const cpuPercent = computeCpuPercent(pi?.cpuUser, pi?.cpuSystem, pi?.uptime ?? 0);
  const eventLoopMs = (pi?.eventLoopLag ?? 0) / 1_000;
  const heapPercent = heapTotalMb > 0 ? Math.round((heapUsedMb / heapTotalMb) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Node.js Runtime</h1>
        <p className="text-muted-foreground">
          Process metrics and resource usage (refreshes every 10s)
        </p>
      </div>

      {/* Uptime */}
      {pi?.uptime != null && (
        <p className="text-sm text-muted-foreground">
          Uptime: <span className="font-mono font-semibold">{formatUptime(pi.uptime)}</span>
          {pi.pid != null && (
            <span className="ml-4">
              PID: <span className="font-mono font-semibold">{pi.pid}</span>
            </span>
          )}
        </p>
      )}

      {/* CPU + Memory Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CPU Card */}
        <Card>
          <CardHeader>
            <CardTitle>CPU Usage</CardTitle>
            <CardDescription>Process CPU utilization (cumulative average)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-20" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average</span>
                  <span className="text-2xl font-bold">{cpuPercent}%</span>
                </div>
                <Progress value={cpuPercent} className="h-3" />
                {pi?.cpuUser != null && pi?.cpuSystem != null && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>User time</span>
                      <span className="font-mono">{(pi.cpuUser / 1_000_000).toFixed(2)}s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>System time</span>
                      <span className="font-mono">{(pi.cpuSystem / 1_000_000).toFixed(2)}s</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Memory Card */}
        <Card>
          <CardHeader>
            <CardTitle>Memory</CardTitle>
            <CardDescription>Heap and RSS memory usage</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Heap */}
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Heap Used / Total</span>
                    <span className="font-mono">
                      {formatMb(heapUsedMb)} / {formatMb(heapTotalMb)}
                    </span>
                  </div>
                  <Progress value={heapPercent} className="mt-1 h-3" />
                  <p className="mt-1 text-xs text-muted-foreground text-right">{heapPercent}%</p>
                </div>

                {/* RSS */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">RSS</span>
                  <span className="font-mono font-semibold">{formatMb(rssMb)}</span>
                </div>

                {/* External */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">External</span>
                  <span className="font-mono">{formatMb(externalMb)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Loop + Prometheus Metrics Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Event Loop */}
        <Card>
          <CardHeader>
            <CardTitle>Event Loop</CardTitle>
            <CardDescription>Event loop lag from Prometheus</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-20" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current lag</p>
                  <p className="text-2xl font-bold font-mono">{eventLoopMs.toFixed(2)}ms</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Process Info */}
        <Card>
          <CardHeader>
            <CardTitle>Process Info</CardTitle>
            <CardDescription>PID, uptime, and CPU time breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PID</span>
                  <span className="font-mono font-semibold">{pi?.pid ?? 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono font-semibold">
                    {pi?.uptime != null ? formatUptime(pi.uptime) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">CPU (user + system)</span>
                  <span className="font-mono">
                    {pi?.cpuUser != null && pi?.cpuSystem != null
                      ? `${((pi.cpuUser + pi.cpuSystem) / 1_000_000).toFixed(2)}s`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prometheus Metric Entries */}
      {data?.metrics?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Prometheus Metrics</CardTitle>
            <CardDescription>
              Raw Node.js and Chive metrics from the Prometheus registry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.metrics.map((m, i) => (
                    <TableRow key={`${m.name}-${i}`}>
                      <TableCell className="font-mono text-xs">{m.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.type}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{m.value}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {m.unit ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
