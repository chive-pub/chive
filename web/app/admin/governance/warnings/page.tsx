'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminWarnings } from '@/lib/hooks/use-admin';

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

// =============================================================================
// PAGE
// =============================================================================

/**
 * Warnings administration page.
 *
 * @remarks
 * Displays a table of active governance warnings issued to users,
 * including the reason, issuer, and expiry information.
 */
export default function AdminWarningsPage() {
  const { data, isLoading } = useAdminWarnings();

  const warnings = data?.warnings ?? [];

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
          <h1 className="text-3xl font-bold tracking-tight">Warnings</h1>
          <p className="text-muted-foreground">Active user warnings</p>
        </div>
      </div>

      {/* Warnings Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Active Warnings
            {warnings.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({warnings.length} total)
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
          ) : warnings.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No active warnings.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Issued At</TableHead>
                  <TableHead>Acknowledged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warnings.map((warning) => (
                  <TableRow key={warning.id}>
                    <TableCell className="font-mono text-xs">
                      {warning.targetHandle ?? truncateDid(warning.targetDid)}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <span className="line-clamp-2 text-sm">{warning.reason}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {truncateDid(warning.issuedBy)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(warning.issuedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {warning.acknowledged ? (
                        <span className="text-sm text-green-600">Yes</span>
                      ) : (
                        <span className="text-sm text-yellow-600">No</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
