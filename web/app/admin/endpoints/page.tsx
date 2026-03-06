'use client';

/**
 * Admin endpoint performance dashboard page.
 *
 * @remarks
 * Displays per-endpoint request rates, error rates, and latency
 * percentiles with color-coded severity indicators. Includes
 * horizontal bar charts for the slowest and most error-prone endpoints.
 * Refreshes every 15 seconds.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useEndpointMetrics } from '@/lib/hooks/use-admin';
import type { EndpointMetric } from '@/lib/hooks/use-admin';

const CHART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#0891b2'];

/**
 * Converts microseconds to milliseconds.
 *
 * @param us - Value in microseconds
 * @returns Value in milliseconds
 */
function usToMs(us: number): number {
  return us / 1000;
}

/**
 * Converts error rate from basis points to a decimal (0-1).
 *
 * @param basisPoints - Error rate in basis points (100 = 1%)
 * @returns Decimal error rate
 */
function basisPointsToDecimal(basisPoints: number): number {
  return basisPoints / 10000;
}

/**
 * Returns a Tailwind text color class for an error rate percentage.
 *
 * @param basisPoints - Error rate in basis points
 * @returns Tailwind text color class
 */
function errorRateColor(basisPoints: number): string {
  const pct = basisPoints / 100;
  if (pct < 1) return 'text-green-600';
  if (pct < 5) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Returns a Tailwind text color class for a P95 latency value.
 *
 * @param ms - P95 latency in milliseconds
 * @returns Tailwind text color class
 */
function p95Color(ms: number): string {
  if (ms < 200) return 'text-green-600';
  if (ms < 1000) return 'text-yellow-600';
  return 'text-red-600';
}

export default function EndpointsPage() {
  const { data, isLoading } = useEndpointMetrics();

  const endpoints: EndpointMetric[] = data?.metrics ?? [];

  // Sort by request count descending for the main table
  const sortedByRequests = [...endpoints].sort((a, b) => b.requestCount - a.requestCount);

  // Top 10 slowest by P95
  const topSlow = [...endpoints].sort((a, b) => b.p95 - a.p95).slice(0, 10);

  // Top 10 highest error rate
  const topErrors = [...endpoints]
    .filter((e) => e.errorRate > 0)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Endpoint Performance</h1>
        <p className="text-muted-foreground">
          Per-endpoint request rates and latency (refreshes every 15s)
        </p>
      </div>

      {/* Sortable Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Endpoints</CardTitle>
          <CardDescription>
            Sorted by request count; {endpoints.length} endpoints tracked
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sortedByRequests.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Error %</TableHead>
                    <TableHead className="text-right">P50 (ms)</TableHead>
                    <TableHead className="text-right">P95 (ms)</TableHead>
                    <TableHead className="text-right">P99 (ms)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByRequests.map((ep) => {
                    const p50Ms = usToMs(ep.p50);
                    const p95Ms = usToMs(ep.p95);
                    const p99Ms = usToMs(ep.p99);
                    const errorPct = basisPointsToDecimal(ep.errorRate);

                    return (
                      <TableRow key={`${ep.method}-${ep.path}`}>
                        <TableCell className="font-mono text-xs">
                          <span className="mr-2 text-muted-foreground">{ep.method}</span>
                          {ep.path}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {ep.requestCount.toLocaleString()}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${errorRateColor(ep.errorRate)}`}
                        >
                          {(errorPct * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right font-mono">{p50Ms.toFixed(0)}</TableCell>
                        <TableCell className={`text-right font-mono ${p95Color(p95Ms)}`}>
                          {p95Ms.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{p99Ms.toFixed(0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No endpoint data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Slow Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Top Slow Endpoints</CardTitle>
            <CardDescription>Top 10 by P95 latency</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : topSlow.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={topSlow.map((ep) => ({
                    name: ep.path.length > 30 ? `...${ep.path.slice(-27)}` : ep.path,
                    p95: usToMs(ep.p95),
                  }))}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    fontSize={10}
                    tick={{ fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    formatter={((value: number) => [`${value.toFixed(0)}ms`, 'P95']) as never}
                  />
                  <Bar dataKey="p95" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} name="P95 (ms)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Error Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Top Error Endpoints</CardTitle>
            <CardDescription>Top 10 by error rate</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : topErrors.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={topErrors.map((ep) => ({
                    name: ep.path.length > 30 ? `...${ep.path.slice(-27)}` : ep.path,
                    errorRate: ep.errorRate / 100,
                  }))}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    fontSize={12}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    fontSize={10}
                    tick={{ fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    formatter={((value: number) => [`${value.toFixed(2)}%`, 'Error Rate']) as never}
                  />
                  <Bar
                    dataKey="errorRate"
                    fill={CHART_COLORS[2]}
                    radius={[0, 4, 4, 0]}
                    name="Error %"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No error data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
