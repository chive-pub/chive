'use client';

import { useState } from 'react';

import { FieldCard, FieldCardSkeleton } from '@/components/knowledge-graph';
import { InlineSearch } from '@/components/search';
import { useFields } from '@/lib/hooks/use-field';

/**
 * Client-side fields page content.
 *
 * @remarks
 * Displays top-level fields with search filtering.
 *
 * @returns React element with fields grid
 */
export function FieldsPageContent() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = useFields({
    status: 'approved',
    limit: 50,
  });

  if (isLoading) {
    return <FieldsGridSkeleton count={12} />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
        <p className="text-destructive">Failed to load fields</p>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  const fields = data?.fields ?? [];
  const filteredFields = searchQuery
    ? fields.filter(
        (f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : fields;

  return (
    <div className="space-y-6">
      {/* Search */}
      <InlineSearch placeholder="Filter fields..." onSearch={setSearchQuery} className="max-w-md" />

      {/* Fields grid */}
      {filteredFields.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery ? 'No fields match your search.' : 'No fields available.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFields.map((field) => (
            <FieldCard key={field.id} field={field} />
          ))}
        </div>
      )}

      {/* Total count */}
      {data && (
        <p className="text-center text-sm text-muted-foreground">
          Showing {filteredFields.length} of {data.total} fields
        </p>
      )}
    </div>
  );
}

/**
 * Grid skeleton for fields.
 */
function FieldsGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <FieldCardSkeleton key={i} />
      ))}
    </div>
  );
}
