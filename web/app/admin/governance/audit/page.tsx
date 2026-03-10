'use client';

import Link from 'next/link';
import { ArrowLeft, ScrollText } from 'lucide-react';

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
import { useAdminAuditLog } from '@/lib/hooks/use-admin';

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
 * Truncates a URI to a shorter display form.
 */
function truncateUri(uri: string): string {
  if (uri.length <= 40) return uri;
  return uri.slice(0, 36) + '...';
}

// =============================================================================
// PAGE
// =============================================================================

/**
 * Audit log page.
 *
 * @remarks
 * Displays a table of administrative actions with actor, action type,
 * target collection, URI, and timestamp.
 */
export default function AdminAuditLogPage() {
  const { data, isLoading } = useAdminAuditLog();

  const entries = data?.entries ?? [];

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
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">Administrative action history</p>
        </div>
      </div>

      {/* Audit Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Entries
            {data?.total !== undefined && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({data.total} total)
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
          ) : entries.length === 0 ? (
            <div className="p-8 text-center">
              <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No audit log entries.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Editor DID</TableHead>
                    <TableHead>Target URI</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.action}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {entry.actorHandle ?? truncateDid(entry.actorDid)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[250px] truncate">
                        {entry.targetUri
                          ? truncateUri(entry.targetUri)
                          : entry.targetDid
                            ? truncateDid(entry.targetDid)
                            : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
