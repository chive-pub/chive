'use client';

import Link from 'next/link';
import { ArrowLeft, Ban } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminViolations } from '@/lib/hooks/use-admin';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Truncates a DID to a shorter display form.
 */
function truncateDid(did: string): string {
  if (did.length <= 24) return did;
  return did.slice(0, 20) + '...';
}

/**
 * Truncates a string to a shorter display form.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Returns badge styling for a violation severity level.
 */
function severityBadge(severity: string): { className: string; label: string } {
  switch (severity) {
    case 'low':
      return { className: 'bg-yellow-500/15 text-yellow-700 border-yellow-200', label: 'Low' };
    case 'medium':
      return { className: 'bg-orange-500/15 text-orange-700 border-orange-200', label: 'Medium' };
    case 'high':
      return { className: 'bg-red-500/15 text-red-700 border-red-200', label: 'High' };
    case 'critical':
      return { className: 'bg-red-600/20 text-red-800 border-red-300', label: 'Critical' };
    default:
      return { className: 'bg-gray-500/15 text-gray-700 border-gray-200', label: severity };
  }
}

// =============================================================================
// PAGE
// =============================================================================

/**
 * Violations administration page.
 *
 * @remarks
 * Displays a table of user violations with type, severity,
 * context, and creation date.
 */
export default function AdminViolationsPage() {
  const { data, isLoading } = useAdminViolations();

  const violations = data?.violations ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/governance"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Violations</h1>
          <p className="text-muted-foreground">User violation records</p>
        </div>
      </div>

      {/* Violations Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Violations
            {violations.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({violations.length} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : violations.length === 0 ? (
            <div className="p-8 text-center">
              <Ban className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No violations recorded.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((violation) => {
                  const badge = severityBadge(violation.severity);
                  return (
                    <TableRow key={violation.id}>
                      <TableCell className="font-mono text-xs">
                        {violation.targetHandle ?? truncateDid(violation.targetDid)}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{violation.type}</TableCell>
                      <TableCell>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {truncateText(violation.description, 80)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(violation.detectedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
