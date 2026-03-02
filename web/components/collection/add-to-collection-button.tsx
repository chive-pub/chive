'use client';

/**
 * Button for adding an item to a user's collection via a dropdown menu.
 *
 * @remarks
 * Renders either an icon-only button or a full text button that opens a
 * dropdown listing the user's collections. Collections already containing
 * the item are visually marked with a checkmark. Clicking a marked
 * collection shows an "already added" toast. A "Create new collection"
 * option at the bottom navigates to the collection creation wizard with
 * the item pre-filled.
 *
 * Items are wrapped in personal graph nodes before being added to the
 * collection, matching the behavior of the collection wizard.
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
  type CollectionView,
} from '@/lib/hooks/use-collections';
import { createLogger } from '@/lib/observability/logger';
import { useAddItemToCollection } from './use-add-to-collection';

const logger = createLogger({ context: { component: 'add-to-collection-button' } });

/**
 * Props for the AddToCollectionButton component.
 */
export interface AddToCollectionButtonProps {
  /** AT-URI of the item to add */
  itemUri: string;
  /** Type of the item (e.g., 'eprint', 'review') */
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
  itemType,
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

  const { addItem, isPending } = useAddItemToCollection();

  const collections = useMemo(
    () => collectionsData?.collections ?? [],
    [collectionsData?.collections]
  );

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
        logger.info('Item already in collection', {
          itemUri,
          collectionUri: collection.uri,
        });
        toast.info(`"${itemLabel}" is already in "${collection.label}"`);
        return;
      }

      await addItem({ collection, itemUri, itemType, itemLabel, allCollections: collections });
    },
    [addItem, containingUris, itemUri, itemType, itemLabel, collections]
  );

  const handleCreateNew = useCallback(() => {
    logger.info('Navigating to create new collection with item', { itemUri, itemType });
    const params = new URLSearchParams({
      item: itemUri,
      type: itemType,
      label: itemLabel,
    });
    router.push(`/collections/new?${params.toString()}`);
  }, [router, itemUri, itemType, itemLabel]);

  // Only render for authenticated users
  if (!isAuthenticated || !currentUser) {
    return null;
  }

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
                disabled={isPending}
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
