'use client';

/**
 * Delete confirmation dialog for eprints.
 *
 * @remarks
 * Provides a confirmation dialog before deleting an eprint. Shows
 * warnings about the consequences of deletion and any related data
 * that will be affected.
 *
 * @packageDocumentation
 */

import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
import { Button } from '@/components/ui/button';

/**
 * Props for DeleteEprintDialog.
 */
export interface DeleteEprintDialogProps {
  /** Eprint title for display */
  title: string;
  /** Eprint URI */
  uri: string;
  /** Whether the user can delete (has permissions) */
  canDelete: boolean;
  /** Whether the delete operation is pending */
  isPending?: boolean;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
  /** Optional children to use as trigger */
  children?: React.ReactNode;
}

/**
 * Delete confirmation dialog for eprints.
 *
 * @param props - component props
 * @param props.title - eprint title displayed in the confirmation message
 * @param props.uri - AT-URI of the eprint being deleted
 * @param props.canDelete - whether the user has permission to delete
 * @param props.isPending - whether a delete operation is in progress
 * @param props.onConfirm - callback invoked when deletion is confirmed
 * @param props.children - optional trigger element (defaults to a delete button)
 * @returns React element rendering the alert dialog
 *
 * @example
 * ```tsx
 * <DeleteEprintDialog
 *   title={eprint.title}
 *   uri={eprint.uri}
 *   canDelete={canModify}
 *   isPending={isPending}
 *   onConfirm={handleDelete}
 * >
 *   <Button variant="destructive" size="sm">
 *     <Trash2 className="h-4 w-4 mr-2" />
 *     Delete
 *   </Button>
 * </DeleteEprintDialog>
 * ```
 */
export function DeleteEprintDialog({
  title,
  uri: _uri,
  canDelete,
  isPending = false,
  onConfirm,
  children,
}: DeleteEprintDialogProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" disabled={!canDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Eprint</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">&quot;{title}&quot;</span>?
              </p>
              <p>This action cannot be undone. The following will be permanently removed:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>The eprint record and document</li>
                <li>All endorsements associated with this eprint</li>
                <li>All reviews and comments on this eprint</li>
                <li>View and download metrics</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Note: The deletion will be propagated from your PDS to all indexers, including
                Chive.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Eprint
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
