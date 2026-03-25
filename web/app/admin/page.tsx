'use client';

import Link from 'next/link';
import {
  FileText,
  Users,
  MessageSquare,
  ThumbsUp,
  Library,
  Tags,
  HeartPulse,
  Radio,
  RefreshCw,
  AlertTriangle,
  Server,
  BarChart3,
  ShieldCheck,
  Gauge,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  useAdminOverview,
  useSystemHealth,
  useFirehoseStatus,
  useBackfillStatus,
} from '@/lib/hooks/use-admin';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns color and label for a service health status badge.
 *
 * @param status - Health status string
 * @returns Badge className and label text
 */
function statusBadge(status: string): { className: string; label: string } {
  switch (status) {
    case 'healthy':
      return { className: 'bg-green-500/15 text-green-700 border-green-200', label: 'Healthy' };
    case 'degraded':
      return { className: 'bg-yellow-500/15 text-yellow-700 border-yellow-200', label: 'Degraded' };
    case 'unhealthy':
      return { className: 'bg-red-500/15 text-red-700 border-red-200', label: 'Unhealthy' };
    default:
      return { className: 'bg-gray-500/15 text-gray-700 border-gray-200', label: 'Unknown' };
  }
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

// =============================================================================
// STAT CARD
// =============================================================================

/**
 * A clickable stat card that displays a single metric with icon.
 */
function StatCard({
  title,
  value,
  icon: Icon,
  href,
  loading,
}: {
  title: string;
  value: number | null;
  icon: React.ElementType;
  href: string;
  loading: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/50">
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
    </Link>
  );
}

// =============================================================================
// PAGE
// =============================================================================

/**
 * Admin dashboard overview page.
 *
 * @remarks
 * Displays content statistics, system health, firehose status,
 * active backfill operations, and quick actions for administrators.
 */
export default function AdminOverviewPage() {
  const { data: overview, isLoading: overviewLoading } = useAdminOverview();
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: firehose, isLoading: firehoseLoading } = useFirehoseStatus();
  const { data: backfill, isLoading: backfillLoading } = useBackfillStatus();

  // Extract databases array from health data for the summary panel
  const databases = health?.databases ?? [];

  // Count active backfill operations
  const activeBackfills = backfill?.operations?.filter((op) => op.status === 'running') ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and administration</p>
      </div>

      {/* Content Stats Grid */}
      <section aria-label="Content statistics">
        <h2 className="text-lg font-semibold mb-4">Content Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Eprints"
            value={overviewLoading ? null : (overview?.eprints ?? 0)}
            icon={FileText}
            href="/admin/content"
            loading={overviewLoading}
          />
          <StatCard
            title="Authors"
            value={overviewLoading ? null : (overview?.authors ?? 0)}
            icon={Users}
            href="/admin/users"
            loading={overviewLoading}
          />
          <StatCard
            title="Reviews"
            value={overviewLoading ? null : (overview?.reviews ?? 0)}
            icon={MessageSquare}
            href="/admin/content"
            loading={overviewLoading}
          />
          <StatCard
            title="Endorsements"
            value={overviewLoading ? null : (overview?.endorsements ?? 0)}
            icon={ThumbsUp}
            href="/admin/content"
            loading={overviewLoading}
          />
          <StatCard
            title="Collections"
            value={overviewLoading ? null : (overview?.collections ?? 0)}
            icon={Library}
            href="/admin/content"
            loading={overviewLoading}
          />
          <StatCard
            title="Tags"
            value={overviewLoading ? null : (overview?.tags ?? 0)}
            icon={Tags}
            href="/admin/content"
            loading={overviewLoading}
          />
        </div>
      </section>

      {/* System Health Panel */}
      <section aria-label="System health">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-muted-foreground" />
                System Health
              </CardTitle>
              <CardDescription>
                Database connections and service status
                {health && (
                  <span className="ml-2">
                    (overall:{' '}
                    <Badge className={statusBadge(health.status).className}>
                      {statusBadge(health.status).label}
                    </Badge>
                    )
                  </span>
                )}
              </CardDescription>
            </div>
            {health?.uptime != null && (
              <div className="text-right text-sm text-muted-foreground">
                <div>Uptime</div>
                <div className="font-mono font-semibold">{formatUptime(health.uptime)}</div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : databases.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {databases.map((db) => {
                  const derivedStatus = db.healthy ? 'healthy' : 'unhealthy';
                  const badge = statusBadge(derivedStatus);
                  return (
                    <div key={db.name} className="space-y-2 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{db.name}</span>
                        {db.healthy ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <Badge className={badge.className}>{badge.label}</Badge>
                      <p className="text-xs text-muted-foreground">
                        Latency: <span className="font-mono">{db.latencyMs ?? 0}ms</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No health data available
              </p>
            )}
            <div className="mt-4">
              <Link href="/admin/health" className="text-sm text-primary hover:underline">
                View detailed health status
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Firehose + Backfill Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Firehose Panel */}
        <section aria-label="Firehose status">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-muted-foreground" />
                  Firehose
                </CardTitle>
                <CardDescription>Real-time event stream status</CardDescription>
              </div>
              {firehose && (
                <Badge
                  variant={firehose.cursor != null ? 'default' : 'destructive'}
                  className="flex items-center gap-1"
                >
                  {firehose.cursor != null ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  {firehose.cursor != null ? 'Active' : 'Inactive'}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {firehoseLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : firehose ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cursor</span>
                    <span className="font-mono text-xs max-w-[200px] truncate">
                      {firehose.cursor ?? 'N/A'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">DLQ Count</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{firehose.dlqCount ?? 0}</span>
                      {(firehose.dlqCount ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Needs attention
                        </Badge>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Firehose status unavailable
                </p>
              )}
              <div className="mt-4">
                <Link href="/admin/firehose" className="text-sm text-primary hover:underline">
                  View firehose details
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Active Backfill Operations */}
        <section aria-label="Backfill operations">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-muted-foreground" />
                  Backfill Operations
                </CardTitle>
                <CardDescription>Active reindexing and backfill tasks</CardDescription>
              </div>
              {activeBackfills.length > 0 && (
                <Badge variant="secondary">{activeBackfills.length} active</Badge>
              )}
            </CardHeader>
            <CardContent>
              {backfillLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : activeBackfills.length > 0 ? (
                <div className="space-y-4">
                  {activeBackfills.map((op) => {
                    const progressPercent = Math.round(op.progress ?? 0);
                    return (
                      <div key={op.id} className="space-y-2 rounded-lg border p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{op.type}</span>
                          <Badge variant="outline" className="text-xs">
                            {op.status}
                          </Badge>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {(op.recordsProcessed ?? 0).toLocaleString()} records processed
                          </span>
                          <span>{progressPercent}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Started {new Date(op.startedAt).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <RefreshCw className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No active operations</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All backfill tasks are complete or not yet started.
                  </p>
                </div>
              )}
              <div className="mt-4">
                <Link href="/admin/backfill" className="text-sm text-primary hover:underline">
                  View all operations
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Quick Actions */}
      <section aria-label="Quick actions">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative operations</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/admin/firehose">
                <Radio className="mr-2 h-4 w-4" />
                View DLQ
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/backfill">
                <RefreshCw className="mr-2 h-4 w-4" />
                Trigger Scan
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/pds">
                <Server className="mr-2 h-4 w-4" />
                PDS Registry
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/users">
                <Users className="mr-2 h-4 w-4" />
                User Management
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/metrics">
                <BarChart3 className="mr-2 h-4 w-4" />
                Metrics
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/governance">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Governance
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/endpoints">
                <Gauge className="mr-2 h-4 w-4" />
                Endpoints
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
