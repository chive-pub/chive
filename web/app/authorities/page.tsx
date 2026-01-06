'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, BookOpen, User, Building, Lightbulb, MapPin } from 'lucide-react';

import {
  useAuthoritySearch,
  AUTHORITY_TYPE_LABELS,
  AUTHORITY_STATUS_LABELS,
  type AuthorityType,
  type AuthorityStatus,
} from '@/lib/hooks/use-authority';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Authority browser page.
 *
 * @remarks
 * Allows searching and browsing authority records with type filtering.
 */
export default function AuthoritiesPage() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AuthorityType | 'all'>('all');

  const { data, isLoading, error } = useAuthoritySearch(
    query,
    {
      type: typeFilter === 'all' ? undefined : typeFilter,
      limit: 50,
    },
    { enabled: query.length >= 2 }
  );

  const getTypeIcon = (type: AuthorityType) => {
    switch (type) {
      case 'person':
        return User;
      case 'organization':
        return Building;
      case 'concept':
        return Lightbulb;
      case 'place':
        return MapPin;
      default:
        return User;
    }
  };

  const getStatusColor = (status: AuthorityStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'proposed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'deprecated':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
  };

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Authority Records</h1>
        <p className="text-muted-foreground">
          Browse standardized terms for fields, concepts, organizations, and people
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search authority records..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Type Tabs */}
      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as AuthorityType | 'all')}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <BookOpen className="h-4 w-4" />
            All
          </TabsTrigger>
          <TabsTrigger value="concept" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Concepts
          </TabsTrigger>
          <TabsTrigger value="person" className="gap-2">
            <User className="h-4 w-4" />
            People
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2">
            <Building className="h-4 w-4" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="place" className="gap-2">
            <MapPin className="h-4 w-4" />
            Places
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results */}
      {query.length < 2 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Search Authority Records</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter at least 2 characters to search for authority records
          </p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">Failed to search authorities</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data?.authorities && data.authorities.length > 0 ? (
        <div className="space-y-3">
          {data.authorities.map((authority) => {
            const TypeIcon = getTypeIcon(authority.type);
            return (
              <Link
                key={authority.id}
                href={`/authorities/${authority.id}`}
                className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    <TypeIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{authority.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {AUTHORITY_TYPE_LABELS[authority.type]}
                      </Badge>
                      <Badge className={getStatusColor(authority.status)}>
                        {AUTHORITY_STATUS_LABELS[authority.status]}
                      </Badge>
                    </div>

                    {authority.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {authority.description}
                      </p>
                    )}

                    {(authority.alternateNames ?? []).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Also known as: {(authority.alternateNames ?? []).slice(0, 3).join(', ')}
                        {(authority.alternateNames ?? []).length > 3 && '...'}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{authority.linkedPreprints ?? 0} preprints</span>
                      <span>{(authority.externalIds ?? []).length} external sources</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {data.total > data.authorities.length && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Showing {data.authorities.length} of {data.total} results
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No results found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different search term or filter
          </p>
        </div>
      )}
    </div>
  );
}
