'use client';

/**
 * Admin search analytics dashboard page.
 *
 * @remarks
 * Displays search quality metrics including query volume, click-through rates,
 * position distribution, relevance grade distribution, and top queries with
 * performance data.
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
import { useSearchAnalytics } from '@/lib/hooks/use-admin';
import type { SearchAnalytics } from '@/lib/hooks/use-admin';

const CHART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#0891b2'];

export default function SearchAnalyticsPage() {
  const { data, isLoading } = useSearchAnalytics();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search Analytics</h1>
        <p className="text-muted-foreground">Search quality and click-through metrics</p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
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
                <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(data?.totalQueries ?? 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(data?.totalClicks ?? 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{((data?.ctr ?? 0) * 100).toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Dwell Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.avgDwellTimeMs != null
                    ? `${(data.avgDwellTimeMs / 1000).toFixed(1)}s`
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Zero-Result Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(data?.zeroResultCount ?? 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Position Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Position Distribution</CardTitle>
            <CardDescription>Which result positions receive clicks</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data?.positionDistribution?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.positionDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="position" tickFormatter={(v: number) => `#${v}`} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    labelFormatter={((v: number) => `Position #${v}`) as never}
                    formatter={((value: number) => [value.toLocaleString(), 'Clicks']) as never}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} name="Clicks" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Relevance Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Relevance Grade Distribution</CardTitle>
            <CardDescription>Distribution of relevance judgments by grade</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data?.relevanceGradeDistribution?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.relevanceGradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="relevanceGrade"
                    tickFormatter={(v: number) => `Grade ${v}`}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip
                    labelFormatter={((v: number) => `Grade ${v}`) as never}
                    formatter={((value: number) => [value.toLocaleString(), 'Count']) as never}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Queries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Queries</CardTitle>
          <CardDescription>Most frequent search queries and their performance</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data?.topQueries?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">CTR %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topQueries.map((q: SearchAnalytics['topQueries'][number]) => {
                  const queryCtr =
                    q.impressionCount > 0 ? (q.clickCount / q.impressionCount) * 100 : 0;
                  return (
                    <TableRow key={q.query}>
                      <TableCell className="max-w-[300px] truncate font-medium">
                        {q.query}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {q.impressionCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {q.clickCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">{queryCtr.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No search data available yet
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
