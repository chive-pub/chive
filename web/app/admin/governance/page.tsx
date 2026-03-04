'use client';

import Link from 'next/link';
import { ArrowLeft, ScrollText, AlertTriangle, Ban } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAuditLog, useAdminWarnings, useAdminViolations } from '@/lib/hooks/use-admin';

// =============================================================================
// NAVIGATION CARD
// =============================================================================

function NavCard({
  title,
  description,
  href,
  icon: Icon,
  count,
  loading,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  count: number | null;
  loading: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/50 h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-10" />
          ) : (
            count !== null && (
              <Badge variant="secondary" className="text-sm">
                {count.toLocaleString()}
              </Badge>
            )
          )}
        </CardHeader>
        <CardContent>
          <span className="text-sm text-primary hover:underline">View details</span>
        </CardContent>
      </Card>
    </Link>
  );
}

// =============================================================================
// PAGE
// =============================================================================

/**
 * Governance overview page.
 *
 * @remarks
 * Provides navigation cards linking to the audit log, warnings,
 * and violations sub-pages with summary counts.
 */
export default function AdminGovernancePage() {
  const { data: auditData, isLoading: auditLoading } = useAdminAuditLog();
  const { data: warningsData, isLoading: warningsLoading } = useAdminWarnings();
  const { data: violationsData, isLoading: violationsLoading } = useAdminViolations();

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
          <h1 className="text-3xl font-bold tracking-tight">Governance</h1>
          <p className="text-muted-foreground">Audit logs, warnings, and violations</p>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard
          title="Audit Log"
          description="Administrative action history, including role changes, content moderation, and system operations."
          href="/admin/governance/audit"
          icon={ScrollText}
          count={auditLoading ? null : (auditData?.total ?? auditData?.entries?.length ?? null)}
          loading={auditLoading}
        />
        <NavCard
          title="Warnings"
          description="Active user warnings issued by moderators for policy guideline reminders."
          href="/admin/governance/warnings"
          icon={AlertTriangle}
          count={warningsLoading ? null : (warningsData?.warnings?.length ?? null)}
          loading={warningsLoading}
        />
        <NavCard
          title="Violations"
          description="User violation records for terms of service breaches and compliance issues."
          href="/admin/governance/violations"
          icon={Ban}
          count={violationsLoading ? null : (violationsData?.violations?.length ?? null)}
          loading={violationsLoading}
        />
      </div>
    </div>
  );
}
