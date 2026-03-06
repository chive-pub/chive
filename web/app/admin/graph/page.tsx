'use client';

import Link from 'next/link';
import { ArrowLeft, GitBranch, Circle, Link2, BookOpen, Layers, Clock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminGraphStats } from '@/lib/hooks/use-admin';

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({
  title,
  description,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  description: string;
  value: number | null;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
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
 * Knowledge graph administration page.
 *
 * @remarks
 * Displays graph statistics including node counts, edge counts,
 * authority records, facets, and pending proposals.
 */
export default function AdminGraphPage() {
  const { data, isLoading } = useAdminGraphStats();

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
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Graph</h1>
          <p className="text-muted-foreground">Graph statistics and field taxonomy</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Nodes"
          description="All nodes in the graph"
          value={isLoading ? null : (data?.totalNodes ?? 0)}
          icon={Circle}
          loading={isLoading}
        />
        <StatCard
          title="Total Edges"
          description="Connections between nodes"
          value={isLoading ? null : (data?.totalEdges ?? 0)}
          icon={Link2}
          loading={isLoading}
        />
        <StatCard
          title="Field Nodes"
          description="Academic field classifications"
          value={isLoading ? null : (data?.fieldNodes ?? 0)}
          icon={GitBranch}
          loading={isLoading}
        />
        <StatCard
          title="Author Nodes"
          description="Author authority records"
          value={isLoading ? null : (data?.authorNodes ?? 0)}
          icon={BookOpen}
          loading={isLoading}
        />
        <StatCard
          title="Institution Nodes"
          description="Institutional authority records"
          value={isLoading ? null : (data?.institutionNodes ?? 0)}
          icon={Layers}
          loading={isLoading}
        />
        <StatCard
          title="Pending Proposals"
          description="Awaiting community review"
          value={isLoading ? null : (data?.pendingProposals ?? 0)}
          icon={Clock}
          loading={isLoading}
        />
      </div>

      {/* Empty state note */}
      {!isLoading && data && data.totalNodes === 0 && data.totalEdges === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">
              The knowledge graph is empty. Nodes and edges will appear as records are indexed from
              the firehose.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
