'use client';

/**
 * Admin activity and correlation dashboard page.
 *
 * @remarks
 * Displays firehose activity confirmation rates, latency metrics,
 * and category breakdowns from the correlation metrics endpoint.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivityCorrelation } from '@/lib/hooks/use-admin';
import type { ActivityCorrelation } from '@/lib/hooks/use-admin';

const CHART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#0891b2'];

/**
 * Computes aggregate stats from the metrics array.
 *
 * @param metrics - array of per-category, per-hour metrics
 * @returns aggregate confirmation rate (0-100), avg latency in ms, and p95 latency in ms
 */
function computeAggregates(metrics: ActivityCorrelation['metrics']): {
  confirmationRatePct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
} {
  if (metrics.length === 0) {
    return { confirmationRatePct: 0, avgLatencyMs: 0, p95LatencyMs: 0 };
  }

  let totalActivities = 0;
  let weightedRateSum = 0;
  let latencySum = 0;
  let latencyCount = 0;
  let maxP95 = 0;

  for (const m of metrics) {
    totalActivities += m.total;
    weightedRateSum += m.confirmationRatePct * m.total;
    const avgMs = m.avgLatencyMs ?? 0;
    if (avgMs > 0) {
      latencySum += avgMs * m.total;
      latencyCount += m.total;
    }
    const p95 = m.p95LatencyMs ?? 0;
    if (p95 > maxP95) {
      maxP95 = p95;
    }
  }

  return {
    confirmationRatePct: totalActivities > 0 ? weightedRateSum / totalActivities : 0,
    avgLatencyMs: latencyCount > 0 ? latencySum / latencyCount : 0,
    p95LatencyMs: maxP95,
  };
}

/**
 * Groups metrics by category for the summary table.
 *
 * @param metrics - array of per-category, per-hour metrics
 * @returns array of category summaries
 */
function groupByCategory(metrics: ActivityCorrelation['metrics']): Array<{
  category: string;
  total: number;
  confirmed: number;
  failed: number;
  timeout: number;
  pending: number;
  confirmationRatePct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}> {
  const map = new Map<
    string,
    {
      total: number;
      confirmed: number;
      failed: number;
      timeout: number;
      pending: number;
      rateSum: number;
      latencySum: number;
      latencyCount: number;
      maxP95: number;
    }
  >();

  for (const m of metrics) {
    const existing = map.get(m.category);
    const avgMs = m.avgLatencyMs ?? 0;
    const p95 = m.p95LatencyMs ?? 0;

    if (existing) {
      existing.total += m.total;
      existing.confirmed += m.confirmed;
      existing.failed += m.failed;
      existing.timeout += m.timeout;
      existing.pending += m.pending;
      existing.rateSum += m.confirmationRatePct * m.total;
      if (avgMs > 0) {
        existing.latencySum += avgMs * m.total;
        existing.latencyCount += m.total;
      }
      if (p95 > existing.maxP95) {
        existing.maxP95 = p95;
      }
    } else {
      map.set(m.category, {
        total: m.total,
        confirmed: m.confirmed,
        failed: m.failed,
        timeout: m.timeout,
        pending: m.pending,
        rateSum: m.confirmationRatePct * m.total,
        latencySum: avgMs > 0 ? avgMs * m.total : 0,
        latencyCount: avgMs > 0 ? m.total : 0,
        maxP95: p95,
      });
    }
  }

  return Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      total: v.total,
      confirmed: v.confirmed,
      failed: v.failed,
      timeout: v.timeout,
      pending: v.pending,
      confirmationRatePct: v.total > 0 ? v.rateSum / v.total : 0,
      avgLatencyMs: v.latencyCount > 0 ? v.latencySum / v.latencyCount : 0,
      p95LatencyMs: v.maxP95,
    }))
    .sort((a, b) => b.total - a.total);
}

export default function ActivityPage() {
  const { data, isLoading } = useActivityCorrelation();

  const metrics = data?.metrics ?? [];
  const aggregates = computeAggregates(metrics);
  const categoryRows = groupByCategory(metrics);

  // Build chart data: per-category totals for confirmed/failed/timeout/pending
  const chartData = categoryRows.map((row) => ({
    category: row.category,
    confirmed: row.confirmed,
    failed: row.failed,
    timeout: row.timeout,
    pending: row.pending,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity & Correlation</h1>
        <p className="text-muted-foreground">Firehose activity correlation metrics</p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Confirmation Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {aggregates.confirmationRatePct.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aggregates.avgLatencyMs.toFixed(0)}ms</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">P95 Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aggregates.p95LatencyMs.toFixed(0)}ms</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Category Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>By Category</CardTitle>
          <CardDescription>Activity status breakdown by category</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="confirmed"
                  stackId="status"
                  fill={CHART_COLORS[1]}
                  name="Confirmed"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="failed"
                  stackId="status"
                  fill={CHART_COLORS[2]}
                  name="Failed"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="timeout"
                  stackId="status"
                  fill={CHART_COLORS[3]}
                  name="Timeout"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pending"
                  stackId="status"
                  fill={CHART_COLORS[4]}
                  name="Pending"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
          <CardDescription>
            Confirmation rates, latencies, and error counts per category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : categoryRows.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Confirmed</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Timeout</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Avg Latency</TableHead>
                    <TableHead className="text-right">P95 Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRows.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell>
                        <Badge variant="outline">{row.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.confirmed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.failed > 0 ? (
                          <span className="text-red-600">{row.failed.toLocaleString()}</span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.timeout > 0 ? (
                          <span className="text-yellow-600">{row.timeout.toLocaleString()}</span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.pending.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.confirmationRatePct.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.avgLatencyMs.toFixed(0)}ms
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.p95LatencyMs.toFixed(0)}ms
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No activity data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timestamp */}
      {data?.timestamp && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
