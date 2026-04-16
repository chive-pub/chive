'use client';

/**
 * Collection detail header component.
 *
 * @remarks
 * Displays the collection name, description, owner, visibility, item count,
 * and action buttons (share, edit, delete, clone, Semble link).
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Link as LinkIcon,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  Calendar,
  User as UserIcon,
  Package,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ShareMenu } from '@/components/share/share-menu';
import { createLogger } from '@/lib/observability/logger';
import { formatDate } from '@/lib/utils/format-date';
import type { CollectionView } from '@/lib/hooks/use-collections';

const logger = createLogger({ context: { component: 'collection-header' } });

/**
 * Visibility configuration mapping.
 */
const VISIBILITY_CONFIG = {
  listed: { icon: Globe, label: 'Listed', variant: 'secondary' as const },
  unlisted: { icon: LinkIcon, label: 'Unlisted', variant: 'outline' as const },
} as const;

/**
 * Props for the CollectionHeader component.
 */
interface CollectionHeaderProps {
  collection: CollectionView;
  isOwner: boolean;
  subcollectionNames?: string[];
  onDelete: (deleteSubcollections: boolean) => void;
  isDeleting?: boolean;
  /**
   * Called when the owner clicks "Repair mirror". When provided AND the
   * collection has an active Semble mirror, a repair button is shown next
   * to the "View on Semble" action.
   */
  onRepairMirror?: () => void;
  /** Whether the repair-mirror request is in flight. */
  isRepairing?: boolean;
}

/**
 * Header for the collection detail page.
 *
 * Renders collection metadata, visibility badge, and action buttons.
 * The delete button shows a confirmation dialog warning about subcollections
 * that will be affected.
 */
export function CollectionHeader({
  collection,
  isOwner,
  subcollectionNames,
  onDelete,
  isDeleting,
  onRepairMirror,
  isRepairing,
}: CollectionHeaderProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSubcollections, setDeleteSubcollections] = useState(false);
  const hasSubcollections = !!subcollectionNames && subcollectionNames.length > 0;

  const {
    icon: VisibilityIcon,
    label: visibilityLabel,
    variant: visibilityVariant,
  } = VISIBILITY_CONFIG[collection.visibility];

  const shareContent = {
    type: 'eprint' as const,
    url: `${typeof window !== 'undefined' ? window.location.origin : ''}/collections/${encodeURIComponent(collection.uri)}`,
    title: collection.label,
    description: collection.description ?? `A collection with ${collection.itemCount} items`,
    ogImageUrl: '/api/og?type=default',
  };

  return (
    <header className="space-y-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{collection.label}</h1>
          {collection.description && (
            <p className="mt-2 text-lg text-muted-foreground">{collection.description}</p>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {/* Owner */}
        <Link
          href={`/authors/${collection.ownerDid}`}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <UserIcon className="h-4 w-4" />
          <span>{collection.ownerHandle ?? collection.ownerDid}</span>
        </Link>

        <Separator orientation="vertical" className="h-4" />

        {/* Created date */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(collection.createdAt)}</span>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Visibility */}
        <Badge variant={visibilityVariant} className="gap-1">
          <VisibilityIcon className="h-3 w-3" />
          {visibilityLabel}
        </Badge>

        <Separator orientation="vertical" className="h-4" />

        {/* Item count */}
        <div className="flex items-center gap-1.5">
          <Package className="h-4 w-4" />
          <span>
            {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* Tags */}
      {collection.tags && collection.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {collection.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <ShareMenu
          content={shareContent}
          onShareToBluesky={() => {
            toast.info('Bluesky sharing for collections coming soon');
          }}
          size="sm"
        />

        {isOwner && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/collections/${encodeURIComponent(collection.uri)}/edit`}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Link>
            </Button>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete collection</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <span className="block">
                        Are you sure you want to delete &ldquo;{collection.label}&rdquo;? This
                        action cannot be undone.
                      </span>
                      {hasSubcollections && (
                        <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-3">
                          <span className="block">
                            This collection has subcollections:{' '}
                            <span className="font-medium">{subcollectionNames.join(', ')}</span>
                          </span>
                          <RadioGroup
                            value={deleteSubcollections ? 'delete' : 'relink'}
                            onValueChange={(v) => setDeleteSubcollections(v === 'delete')}
                            className="gap-3"
                          >
                            <div className="flex items-start gap-2">
                              <RadioGroupItem value="relink" id="relink" className="mt-0.5" />
                              <Label
                                htmlFor="relink"
                                className="font-normal cursor-pointer leading-snug"
                              >
                                Relink to parent (or make top-level)
                              </Label>
                            </div>
                            <div className="flex items-start gap-2">
                              <RadioGroupItem value="delete" id="delete-subs" className="mt-0.5" />
                              <Label
                                htmlFor="delete-subs"
                                className="font-normal cursor-pointer leading-snug"
                              >
                                Delete subcollections and all their items
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      logger.info('Deleting collection', {
                        collectionUri: collection.uri,
                        deleteSubcollections,
                        subcollectionCount: subcollectionNames?.length ?? 0,
                      });
                      onDelete(deleteSubcollections);
                    }}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {!isOwner && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/collections/new?cloneFrom=${encodeURIComponent(collection.uri)}`}>
              <Copy className="h-4 w-4 mr-1.5" />
              Clone Collection
            </Link>
          </Button>
        )}

        {collection.cosmikCollectionUri &&
          (() => {
            const m = /^at:\/\/([^/]+)\/[^/]+\/(.+)$/.exec(collection.cosmikCollectionUri);
            const handle = collection.ownerHandle;
            const rkey = m?.[2];
            const cosmikUrl =
              handle && rkey
                ? `https://semble.so/profile/${handle}/collections/${rkey}`
                : `https://semble.so/profile/${collection.ownerDid}/collections/${rkey ?? encodeURIComponent(collection.cosmikCollectionUri)}`;
            return (
              <Button variant="ghost" size="sm" asChild>
                <a href={cosmikUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  View on Semble
                </a>
              </Button>
            );
          })()}

        {isOwner && collection.cosmikCollectionUri && onRepairMirror && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRepairMirror}
            disabled={isRepairing}
            title="Reconcile the Semble mirror with the current collection: create missing connections, prune orphans."
          >
            <Wrench className="h-4 w-4 mr-1.5" />
            {isRepairing ? 'Repairing…' : 'Repair mirror'}
          </Button>
        )}
      </div>
    </header>
  );
}

/**
 * Loading skeleton for the collection header.
 */
export function CollectionHeaderSkeleton() {
  return (
    <header className="space-y-4">
      <div className="h-9 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-5 w-full animate-pulse rounded bg-muted" />
      <div className="flex gap-3">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      </div>
    </header>
  );
}
