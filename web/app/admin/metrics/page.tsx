'use client';

/**
 * Admin metrics and trending dashboard page.
 *
 * @remarks
 * Displays top viewed eprints, trending velocity data,
 * and view/download time series charts for a configurable period.
 */

import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Separator } from '@/components/ui/separator';
import { useTrendingVelocity, useViewDownloadTimeSeries } from '@/lib/hooks/use-admin';

const CHART_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#0891b2'];

/**
 * Returns an icon for the velocity trend direction.
 *
 * @param trend - Trend direction string
 * @returns React element for the trend icon
 */
function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'rising':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'falling':
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Maps the period selector value to a granularity for the time series endpoint.
 *
 * @param period - Period string from the selector
 * @returns Granularity string for the API
 */
function periodToGranularity(period: string): string {
  switch (period) {
    case '24h':
      return 'hour';
    case '7d':
      return 'day';
    case '30d':
      return 'day';
    case '90d':
      return 'week';
    default:
      return 'day';
  }
}

export default function MetricsPage() {
  const [period, setPeriod] = useState('7d');

  const { data: trending, isLoading: trendingLoading } = useTrendingVelocity(period);
  const { data: timeSeries, isLoading: timeSeriesLoading } = useViewDownloadTimeSeries(
    undefined,
    periodToGranularity(period)
  );

  const accelerating = trending?.items?.filter((item) => item.trend === 'rising') ?? [];
  const decelerating = trending?.items?.filter((item) => item.trend === 'falling') ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metrics & Trending</h1>
          <p className="text-muted-foreground">Content analytics and trending data</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24h</SelectItem>
            <SelectItem value="7d">7d</SelectItem>
            <SelectItem value="30d">30d</SelectItem>
            <SelectItem value="90d">90d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top Viewed Eprints Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Viewed Eprints</CardTitle>
          <CardDescription>Highest viewed eprints in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {trendingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : trending?.items?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Downloads</TableHead>
                  <TableHead className="text-right">Velocity</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trending.items.map((item) => (
                  <TableRow key={item.uri}>
                    <TableCell className="max-w-[300px] truncate font-medium">
                      {item.title}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.downloads.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.velocity.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TrendIcon trend={item.trend} />
                        <Badge
                          variant="outline"
                          className={
                            item.trend === 'rising'
                              ? 'text-green-700 border-green-200'
                              : item.trend === 'falling'
                                ? 'text-red-700 border-red-200'
                                : ''
                          }
                        >
                          {item.trend}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No metrics data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trending Panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Accelerating
            </CardTitle>
            <CardDescription>Eprints with the fastest rising velocity</CardDescription>
          </CardHeader>
          <CardContent>
            {trendingLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : accelerating.length ? (
              <div className="space-y-3">
                {accelerating.slice(0, 5).map((item) => (
                  <div key={item.uri} className="flex items-center justify-between text-sm">
                    <span className="max-w-[250px] truncate">{item.title}</span>
                    <span className="font-mono text-green-600">+{item.velocity.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[100px] items-center justify-center text-muted-foreground">
                No accelerating eprints
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Top Decelerating
            </CardTitle>
            <CardDescription>Eprints with the fastest declining velocity</CardDescription>
          </CardHeader>
          <CardContent>
            {trendingLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : decelerating.length ? (
              <div className="space-y-3">
                {decelerating.slice(0, 5).map((item) => (
                  <div key={item.uri} className="flex items-center justify-between text-sm">
                    <span className="max-w-[250px] truncate">{item.title}</span>
                    <span className="font-mono text-red-600">{item.velocity.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[100px] items-center justify-center text-muted-foreground">
                No decelerating eprints
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* View/Download Time Series Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Views & Downloads Over Time</CardTitle>
          <CardDescription>
            Aggregate view and download trends ({period} window, {periodToGranularity(period)}{' '}
            granularity)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeSeriesLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : timeSeries?.buckets?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeries.buckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return periodToGranularity(period) === 'hour'
                      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  }}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  labelFormatter={((v: string) => new Date(v).toLocaleString()) as never}
                  formatter={
                    ((value: number, name: string) => [value.toLocaleString(), name]) as never
                  }
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke={CHART_COLORS[0]}
                  fill={CHART_COLORS[0]}
                  fillOpacity={0.15}
                  name="Views"
                />
                <Area
                  type="monotone"
                  dataKey="downloads"
                  stroke={CHART_COLORS[1]}
                  fill={CHART_COLORS[1]}
                  fillOpacity={0.15}
                  name="Downloads"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
