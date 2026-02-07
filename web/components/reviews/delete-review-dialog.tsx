'use client';

/**
 * Delete confirmation dialog for reviews.
 *
 * @remarks
 * Provides a confirmation dialog before deleting a review. Explains
 * that deleted reviews with replies will be shown as tombstones.
 *
 * @packageDocumentation
 */

import { Loader2, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Props for DeleteReviewDialog.
 */
export interface DeleteReviewDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** Whether the review has replies */
  hasReplies?: boolean;
  /** Whether the delete operation is pending */
  isPending?: boolean;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
}

/**
 * Delete confirmation dialog for reviews.
 *
 * @param props - component props
 * @returns React element rendering the alert dialog
 *
 * @example
 * ```tsx
 * <DeleteReviewDialog
 *   open={deleteDialogOpen}
 *   onOpenChange={setDeleteDialogOpen}
 *   hasReplies={review.replyCount > 0}
 *   isPending={deleteReview.isPending}
 *   onConfirm={handleDelete}
 * />
 * ```
 */
export function DeleteReviewDialog({
  open,
  onOpenChange,
  hasReplies = false,
  isPending = false,
  onConfirm,
}: DeleteReviewDialogProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Comment</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Are you sure you want to delete this comment?</p>
              {hasReplies ? (
                <p>
                  This comment has replies. It will be replaced with a placeholder message to
                  preserve the thread structure.
                </p>
              ) : (
                <p>This action cannot be undone.</p>
              )}
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
                Delete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
