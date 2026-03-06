'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Library,
  Plus,
  GitFork,
  ChevronRight,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Globe,
  Link as LinkIcon,
  Hash,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils/format-date';
import { useCurrentUser } from '@/lib/auth';
import { useMyCollections, type CollectionView } from '@/lib/hooks/use-collections';

// =============================================================================
// TYPES
// =============================================================================

interface FlatCollection {
  uri: string;
  label: string;
  description?: string;
  visibility: 'listed' | 'unlisted';
  itemCount: number;
  tags?: string[];
  createdAt: string;
  depth: number;
  parentLabel?: string;
  hasChildren: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Builds a tree from flat collections and flattens back with depth info.
 */
function buildHierarchy(collections: CollectionView[]): FlatCollection[] {
  const byUri = new Map(collections.map((c) => [c.uri, c]));
  const childrenOf = new Map<string | undefined, CollectionView[]>();

  for (const c of collections) {
    const parentKey = c.parentCollectionUri ?? undefined;
    if (!childrenOf.has(parentKey)) {
      childrenOf.set(parentKey, []);
    }
    childrenOf.get(parentKey)!.push(c);
  }

  const result: FlatCollection[] = [];

  function walk(parentUri: string | undefined, depth: number, parentLabel?: string) {
    const children = childrenOf.get(parentUri) ?? [];
    for (const c of children) {
      const hasChildren = (childrenOf.get(c.uri) ?? []).length > 0;
      result.push({
        uri: c.uri,
        label: c.label,
        description: c.description,
        visibility: c.visibility,
        itemCount: c.itemCount,
        tags: c.tags,
        createdAt: c.createdAt,
        depth,
        parentLabel,
        hasChildren,
      });
      if (hasChildren) {
        walk(c.uri, depth + 1, c.label);
      }
    }
  }

  // Roots: collections whose parent is not in the set (or has no parent)
  walk(undefined, 0);

  // Also walk collections whose parent exists but is not owned by this user
  for (const c of collections) {
    if (c.parentCollectionUri && !byUri.has(c.parentCollectionUri)) {
      if (!result.some((r) => r.uri === c.uri)) {
        const hasChildren = (childrenOf.get(c.uri) ?? []).length > 0;
        result.push({
          uri: c.uri,
          label: c.label,
          description: c.description,
          visibility: c.visibility,
          itemCount: c.itemCount,
          tags: c.tags,
          createdAt: c.createdAt,
          depth: 0,
          hasChildren,
        });
        if (hasChildren) {
          walk(c.uri, 1, c.label);
        }
      }
    }
  }

  return result;
}

// =============================================================================
// VISIBILITY CONFIG
// =============================================================================

const VISIBILITY_CONFIG = {
  listed: { icon: Globe, label: 'Listed' },
  unlisted: { icon: LinkIcon, label: 'Unlisted' },
} as const;

// =============================================================================
// COMPONENTS
// =============================================================================

function CollectionGridSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed p-12 text-center">
      <Library className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">No collections yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a collection to organize eprints into reading lists, topic groups, or curated sets
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button asChild>
          <Link href="/collections/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Collection
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/collections/clone">
            <GitFork className="mr-2 h-4 w-4" />
            Clone from Graph
          </Link>
        </Button>
      </div>
    </div>
  );
}

function CollectionRow({ collection }: { collection: FlatCollection }) {
  const VisibilityIcon = VISIBILITY_CONFIG[collection.visibility].icon;
  const visibilityLabel = VISIBILITY_CONFIG[collection.visibility].label;

  const depthColors = [
    'bg-primary/10 border-primary/20',
    'bg-primary/5 border-primary/10',
    'bg-muted/50 border-muted',
    'bg-muted/30 border-muted/50',
  ];
  const depthColor = depthColors[Math.min(collection.depth, 3)];

  return (
    <Link
      href={`/collections/${encodeURIComponent(collection.uri)}`}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-md',
        depthColor
      )}
      style={{ marginLeft: `${collection.depth * 24}px` }}
    >
      {/* Icon with depth indication */}
      <div className="flex items-center gap-1">
        {collection.depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <FolderTree
          className={cn(
            'h-4 w-4',
            collection.depth === 0 ? 'text-primary' : 'text-muted-foreground'
          )}
        />
      </div>

      {/* Collection info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium truncate', collection.depth === 0 && 'text-primary')}>
            {collection.label}
          </span>
          {collection.parentLabel && (
            <span className="text-xs text-muted-foreground truncate">
              in {collection.parentLabel}
            </span>
          )}
        </div>
        {collection.description && (
          <p className="text-sm text-muted-foreground line-clamp-1">{collection.description}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" className="text-xs">
          {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
        </Badge>
        {collection.hasChildren && (
          <Badge variant="secondary" className="text-xs">
            has subcollections
          </Badge>
        )}
        {collection.tags && collection.tags.length > 0 && (
          <Badge variant="outline" className="text-xs font-normal">
            <Hash className="mr-0.5 h-2.5 w-2.5" />
            {collection.tags[0]}
            {collection.tags.length > 1 && ` +${collection.tags.length - 1}`}
          </Badge>
        )}
        <div
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title={visibilityLabel}
        >
          <VisibilityIcon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatRelativeDate(collection.createdAt)}
        </span>
      </div>
    </Link>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default function MyCollectionsPage() {
  const currentUser = useCurrentUser();
  const { data, isLoading, error } = useMyCollections(currentUser?.did ?? '', {
    enabled: !!currentUser?.did,
  });
  const [expandedOnly, setExpandedOnly] = useState(true);

  const flatCollections = useMemo(() => {
    if (!data?.collections) return [];
    return buildHierarchy(data.collections);
  }, [data?.collections]);

  const displayCollections = useMemo(() => {
    return expandedOnly ? flatCollections.filter((c) => c.depth === 0) : flatCollections;
  }, [flatCollections, expandedOnly]);

  const topLevelCount = flatCollections.filter((c) => c.depth === 0).length;
  const totalCount = flatCollections.length;
  const hasSubcollections = totalCount > topLevelCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Collections</h1>
          <p className="text-muted-foreground">
            Curated sets of eprints and resources
            {topLevelCount > 0 && ` (${topLevelCount})`}
          </p>
        </div>
        {data?.collections && data.collections.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button asChild size="sm">
              <Link href="/collections/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Collection
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/collections/clone">
                <GitFork className="mr-2 h-4 w-4" />
                Clone from Graph
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Expand/collapse toggle */}
      {hasSubcollections && !isLoading && !error && (
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedOnly(!expandedOnly)}
            className="gap-2"
          >
            {expandedOnly ? (
              <>
                <ChevronDown className="h-4 w-4" />
                Show all ({totalCount})
              </>
            ) : (
              <>
                <ChevronUp className="h-4 w-4" />
                Top-level only ({topLevelCount})
              </>
            )}
          </Button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <CollectionGridSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <h3 className="font-semibold text-destructive">Failed to load collections</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      ) : !data?.collections?.length ? (
        <EmptyState />
      ) : (
        <div className="space-y-1">
          {displayCollections.map((collection) => (
            <CollectionRow key={collection.uri} collection={collection} />
          ))}
        </div>
      )}
    </div>
  );
}
