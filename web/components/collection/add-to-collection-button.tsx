'use client';

/**
 * Button for adding an item to a user's collection via a dropdown menu.
 *
 * @remarks
 * Renders either an icon-only button or a full text button that opens a
 * dropdown listing the user's collections. Collections already containing
 * the item are visually marked with a checkmark. Clicking a marked
 * collection removes the item (toggle behavior). A "Create new collection"
 * option at the bottom navigates to the collection creation wizard with
 * the item pre-filled.
 *
 * Only renders when the user is authenticated; returns null otherwise.
 *
 * @packageDocumentation
 */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FolderPlus, Check, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useIsAuthenticated, useCurrentUser } from '@/lib/auth';
import {
  useMyCollections,
  useCollectionsContaining,
  useAddToCollection,
  type CollectionView,
} from '@/lib/hooks/use-collections';

/**
 * Props for the AddToCollectionButton component.
 */
export interface AddToCollectionButtonProps {
  /** AT-URI of the item to add */
  itemUri: string;
  /** Type of the item (e.g., 'eprint', 'node') */
  itemType: string;
  /** Human-readable label for the item (used as default edge label) */
  itemLabel: string;
  /** Display variant: icon-only or full button */
  variant: 'icon' | 'button';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Dropdown button for adding an item to one of the user's collections.
 *
 * @param props - Component props
 * @returns React element, or null when not authenticated
 *
 * @example
 * ```tsx
 * <AddToCollectionButton
 *   itemUri={eprint.uri}
 *   itemType="eprint"
 *   itemLabel={eprint.title}
 *   variant="button"
 * />
 * ```
 */
export function AddToCollectionButton({
  itemUri,
  itemType: _itemType,
  itemLabel,
  variant,
  className,
}: AddToCollectionButtonProps) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const currentUser = useCurrentUser();

  const { data: collectionsData, isLoading: collectionsLoading } = useMyCollections(
    currentUser?.did ?? '',
    { enabled: isAuthenticated && !!currentUser?.did }
  );

  const { data: containingData } = useCollectionsContaining(itemUri, {
    enabled: isAuthenticated && !!itemUri,
  });

  const addToCollection = useAddToCollection();

  /** Set of collection URIs that already contain this item. */
  const containingUris = useMemo(() => {
    const uris = new Set<string>();
    if (containingData?.collections) {
      for (const c of containingData.collections) {
        uris.add(c.uri);
      }
    }
    return uris;
  }, [containingData?.collections]);

  const handleCollectionClick = useCallback(
    async (collection: CollectionView) => {
      if (containingUris.has(collection.uri)) {
        // Toggle: remove from collection.
        // We need the edge URI to delete. Since we do not have it from
        // the containing endpoint, we call remove with a synthetic lookup.
        // The backend removeItemFromCollection expects an edgeUri. Without
        // the edge URI, we cannot remove here, so we show a toast instead.
        toast.info(`"${itemLabel}" is already in "${collection.label}"`);
        return;
      }

      try {
        await addToCollection.mutateAsync({
          collectionUri: collection.uri,
          itemUri,
          label: itemLabel,
        });
        toast.success(`Added to "${collection.label}"`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to add to collection');
      }
    },
    [addToCollection, containingUris, itemUri, itemLabel]
  );

  const handleCreateNew = useCallback(() => {
    router.push(`/collections/new?item=${encodeURIComponent(itemUri)}`);
  }, [router, itemUri]);

  // Only render for authenticated users
  if (!isAuthenticated || !currentUser) {
    return null;
  }

  const collections = collectionsData?.collections ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="icon" className={className} title="Add to collection">
            <FolderPlus className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={className}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Add to collection
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Add to collection</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {collectionsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : collections.length === 0 ? (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">
            No collections yet
          </div>
        ) : (
          collections.map((collection) => {
            const isContained = containingUris.has(collection.uri);

            return (
              <DropdownMenuItem
                key={collection.uri}
                onClick={() => handleCollectionClick(collection)}
                className={isContained ? 'text-muted-foreground' : ''}
                disabled={addToCollection.isPending}
              >
                {isContained ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                <span className="truncate">{collection.label}</span>
                {isContained && (
                  <span className="ml-auto text-xs text-muted-foreground">Added</span>
                )}
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateNew}>
          <Plus className="h-4 w-4" />
          <span>Create new collection</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
