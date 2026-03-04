'use client';

import Link from 'next/link';
import {
  Database,
  Search,
  Globe,
  Server,
  ArrowLeft,
  Clock,
  Cpu,
  MemoryStick,
  Activity,
  Gauge,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useSystemHealth, useNodeMetrics } from '@/lib/hooks/use-admin';

// =============================================================================
// HELPERS
// =============================================================================

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
  return Math.min((totalCpuSeconds / uptimeSeconds) * 100, 100);
}

/**
 * Returns a badge variant and label for a health status.
 *
 * @param status - Health status string
 * @returns Object with className and label
 */
function statusBadge(status: string): { className: string; label: string } {
  switch (status) {
    case 'healthy':
      return { className: 'bg-green-500/15 text-green-700 border-green-200', label: 'Healthy' };
    case 'degraded':
      return {
        className: 'bg-yellow-500/15 text-yellow-700 border-yellow-200',
        label: 'Degraded',
      };
    case 'unhealthy':
      return { className: 'bg-red-500/15 text-red-700 border-red-200', label: 'Unhealthy' };
    default:
      return { className: 'bg-gray-500/15 text-gray-700 border-gray-200', label: 'Unknown' };
  }
}

/**
 * Returns a color class based on latency severity.
 *
 * @param ms - Latency in milliseconds
 * @returns Tailwind text color class
 */
function latencyColor(ms: number): string {
  if (ms < 10) return 'text-green-600';
  if (ms < 50) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Returns a color class based on CPU usage percentage.
 *
 * @param percent - CPU usage as a percentage (0-100)
 * @returns Tailwind text color class
 */
function cpuColor(percent: number): string {
  if (percent < 50) return 'text-green-600';
  if (percent < 80) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Returns a color class based on memory usage ratio.
 *
 * @param used - Memory used in MB
 * @param total - Total memory in MB
 * @returns Tailwind text color class
 */
function memoryColor(used: number, total: number): string {
  if (total === 0) return 'text-muted-foreground';
  const ratio = used / total;
  if (ratio < 0.6) return 'text-green-600';
  if (ratio < 0.85) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Returns a color class based on event loop lag.
 *
 * @param ms - Event loop lag in milliseconds
 * @returns Tailwind text color class
 */
function eventLoopColor(ms: number): string {
  if (ms < 20) return 'text-green-600';
  if (ms < 100) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Formats seconds into a human-readable uptime string.
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
 * Database service descriptor with icon and description.
 */
interface DatabaseServiceInfo {
  key: string;
  name: string;
  icon: React.ElementType;
  description: string;
}

/**
 * Static metadata for each database service.
 */
const DATABASE_SERVICES: DatabaseServiceInfo[] = [
  {
    key: 'postgresql',
    name: 'PostgreSQL',
    icon: Database,
    description: 'Primary metadata store for indexed eprint records',
  },
  {
    key: 'elasticsearch',
    name: 'Elasticsearch',
    icon: Search,
    description: 'Full-text search engine for eprint discovery',
  },
  {
    key: 'neo4j',
    name: 'Neo4j',
    icon: Globe,
    description: 'Knowledge graph for field relationships and citations',
  },
  {
    key: 'redis',
    name: 'Redis',
    icon: Server,
    description: 'Caching layer and rate limiting store',
  },
];

// =============================================================================
// PAGE
// =============================================================================

/**
 * System health deep-dive page.
 *
 * @remarks
 * Displays detailed health information for all database connections,
 * Node.js runtime metrics (CPU, memory, event loop), and uptime.
 */
export default function AdminHealthPage() {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: nodeMetrics, isLoading: nodeLoading } = useNodeMetrics();

  // Build database list from health data, matching by name
  const databases = health?.databases ?? [];

  // Map database health data to the database descriptors
  const databaseCards = DATABASE_SERVICES.map((db) => {
    const dbHealth = databases.find((d) => d.name.toLowerCase() === db.key.toLowerCase());
    return {
      ...db,
      status: dbHealth?.healthy ? 'healthy' : dbHealth ? 'unhealthy' : ('unknown' as string),
      latencyMs: dbHealth?.latencyMs ?? 0,
      error: dbHealth?.error,
    };
  });

  // Derive display values from processInfo
  const pi = nodeMetrics?.processInfo;
  const heapUsedMb = pi ? bytesToMb(pi.heapUsed) : 0;
  const heapTotalMb = pi ? bytesToMb(pi.heapTotal) : 0;
  const rssMb = pi ? bytesToMb(pi.rss) : 0;
  const externalMb = pi ? bytesToMb(pi.external ?? 0) : 0;
  const cpuPercent = pi ? computeCpuPercent(pi.cpuUser, pi.cpuSystem, pi.uptime) : 0;
  const eventLoopMs = pi ? (pi.eventLoopLag ?? 0) / 1000 : 0;
  const uptime = pi?.uptime ?? 0;

  // Compute memory percentage for progress bar
  const heapPercent = heapTotalMb > 0 ? Math.round((heapUsedMb / heapTotalMb) * 100) : 0;

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
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">Database connections and runtime metrics</p>
        </div>
      </div>

      {/* Overall Status Banner */}
      {health && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Overall status:</span>
          <Badge className={statusBadge(health.status).className}>
            {statusBadge(health.status).label}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">
            Last checked: {new Date(health.timestamp).toLocaleString()}
          </span>
        </div>
      )}

      {/* Database Health Cards */}
      <section aria-label="Database health">
        <h2 className="text-lg font-semibold mb-4">Database Connections</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {healthLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))
            : databaseCards.map((db) => {
                const badge = statusBadge(db.status);
                const DbIcon = db.icon;
                return (
                  <Card key={db.key}>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <DbIcon className="h-5 w-5 text-muted-foreground" />
                          {db.name}
                        </CardTitle>
                        <CardDescription>{db.description}</CardDescription>
                      </div>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Latency</span>
                          <span className={`font-mono ${latencyColor(db.latencyMs)}`}>
                            {db.latencyMs}ms
                          </span>
                        </div>
                        {db.error && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Error</span>
                            <span className="text-xs text-red-600 max-w-[200px] truncate">
                              {db.error}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </section>

      {/* Node.js Runtime Metrics */}
      <section aria-label="Node.js runtime metrics">
        <h2 className="text-lg font-semibold mb-4">Node.js Runtime</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* CPU Usage */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  CPU Usage
                </CardTitle>
                <CardDescription>Process CPU utilization</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {nodeLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : pi ? (
                <div className="space-y-3">
                  <div className={`text-3xl font-bold ${cpuColor(cpuPercent)}`}>
                    {cpuPercent.toFixed(1)}%
                  </div>
                  <Progress value={Math.min(cpuPercent, 100)} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {cpuPercent < 50
                      ? 'CPU usage is healthy'
                      : cpuPercent < 80
                        ? 'Elevated CPU usage'
                        : 'High CPU usage; investigate potential bottlenecks'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">Metrics unavailable</p>
              )}
            </CardContent>
          </Card>

          {/* Memory */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  Memory
                </CardTitle>
                <CardDescription>V8 heap and process memory</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {nodeLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : pi ? (
                <div className="space-y-4">
                  {/* Heap */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Heap Used / Total</span>
                      <span className={`font-mono ${memoryColor(heapUsedMb, heapTotalMb)}`}>
                        {heapUsedMb.toFixed(0)} / {heapTotalMb.toFixed(0)} MB
                      </span>
                    </div>
                    <Progress value={heapPercent} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">{heapPercent}% used</p>
                  </div>
                  <Separator />
                  {/* RSS */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">RSS</span>
                    <span className="font-mono">{rssMb.toFixed(0)} MB</span>
                  </div>
                  {/* External */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">External</span>
                    <span className="font-mono">{externalMb.toFixed(1)} MB</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">Metrics unavailable</p>
              )}
            </CardContent>
          </Card>

          {/* Event Loop Lag */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Event Loop Lag
                </CardTitle>
                <CardDescription>Delay in processing async callbacks</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {nodeLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : pi ? (
                <div className="space-y-3">
                  <div className={`text-3xl font-bold ${eventLoopColor(eventLoopMs)}`}>
                    {eventLoopMs.toFixed(1)}ms
                  </div>
                  <Progress value={Math.min((eventLoopMs / 200) * 100, 100)} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {eventLoopMs < 20
                      ? 'Event loop is responsive'
                      : eventLoopMs < 100
                        ? 'Mild event loop pressure'
                        : 'Significant event loop lag detected'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">Metrics unavailable</p>
              )}
            </CardContent>
          </Card>

          {/* Process Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  Process Info
                </CardTitle>
                <CardDescription>PID and CPU time breakdown</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {nodeLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ) : pi ? (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PID</span>
                    <span className="font-mono">{pi.pid}</span>
                  </div>
                  {pi.cpuUser != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">CPU User</span>
                      <span className="font-mono">{(pi.cpuUser / 1_000_000).toFixed(1)}s</span>
                    </div>
                  )}
                  {pi.cpuSystem != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">CPU System</span>
                      <span className="font-mono">{(pi.cpuSystem / 1_000_000).toFixed(1)}s</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">Metrics unavailable</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Uptime */}
      {pi && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Uptime
              </CardTitle>
              <CardDescription>Time since the Node.js process started</CardDescription>
            </div>
            <div className="text-2xl font-bold font-mono">{formatUptime(uptime)}</div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
