'use client';

/**
 * Share to Bluesky dialog component.
 *
 * @remarks
 * Full-featured dialog for composing and posting to Bluesky.
 * Uses custom dialog implementation to avoid React 19 + Radix infinite loop issue.
 * Composer uses TipTap for industry-standard mention handling.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

import { BlueskyComposer } from './bluesky-composer';
import { GraphemeCounter, isOverLimit } from './grapheme-counter';
import { BlueskyPostPreview } from './bluesky-post-preview';
import { BlueskyLogo } from './share-menu';
import type { ShareContent } from '@/lib/bluesky';

/**
 * Current user info for the dialog.
 */
interface CurrentUser {
  did: string;
  displayName: string;
  handle: string;
  avatar?: string;
}

/**
 * Props for ShareToBlueskyDialog.
 */
interface ShareToBlueskyDialogProps {
  /** Dialog open state */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Content being shared */
  content: ShareContent;
  /** Current user info */
  user: CurrentUser;
  /** Called when post is submitted */
  onSubmit: (text: string, ogImageBlob: Uint8Array | undefined) => Promise<{ rkey: string }>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Share to Bluesky dialog component.
 *
 * @example
 * ```tsx
 * <ShareToBlueskyDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   content={shareContent}
 *   user={currentUser}
 *   onSubmit={handlePost}
 * />
 * ```
 */
export function ShareToBlueskyDialog({
  open,
  onOpenChange,
  content,
  user,
  onSubmit,
  className,
}: ShareToBlueskyDialogProps) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ogImageBlob, setOgImageBlob] = useState<Uint8Array | undefined>();
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fetch OG image when dialog opens
  useEffect(() => {
    if (!open) return;

    const fetchImage = async () => {
      setIsLoadingImage(true);
      try {
        // Build full URL for OG image
        const ogUrl = content.ogImageUrl.startsWith('http')
          ? content.ogImageUrl
          : `${window.location.origin}${content.ogImageUrl}`;

        const response = await fetch(ogUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          setOgImageBlob(new Uint8Array(arrayBuffer));
        }
      } catch (error) {
        console.error('Failed to fetch OG image:', error);
      } finally {
        setIsLoadingImage(false);
      }
    };

    fetchImage();
  }, [open, content.ogImageUrl]);

  // Handle escape key (TipTap handles Escape for its own popover)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only close dialog on Escape if not in a TipTap popover
      // Check if there's a mention popover open (TipTap adds it to body)
      const mentionPopover = document.querySelector('[role="listbox"]');
      if (e.key === 'Escape' && !mentionPopover) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setText('');
    }
  }, [open]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (isOverLimit(text) || isLoading) return;

    setIsLoading(true);
    try {
      const result = await onSubmit(text, ogImageBlob);

      // Success toast with link to view post
      const postUrl = `https://bsky.app/profile/${user.did}/post/${result.rkey}`;
      toast.success('Posted to Bluesky', {
        action: {
          label: 'View',
          onClick: () => window.open(postUrl, '_blank'),
        },
      });

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to post';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [text, ogImageBlob, isLoading, onSubmit, onOpenChange, user.did]);

  // Don't render if not open
  if (!open) return null;

  const canPost = text.trim().length > 0 && !isOverLimit(text) && !isLoading;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog content */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]',
          'border bg-background p-6 shadow-lg sm:rounded-lg max-h-[90vh] overflow-y-auto',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <BlueskyLogo className="h-5 w-5 text-blue-500" />
          <h2 id="share-dialog-title" className="text-lg font-semibold">
            Share to Bluesky
          </h2>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-10 w-10">
            {user.avatar ? <AvatarImage src={user.avatar} alt={user.displayName} /> : null}
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{user.displayName}</p>
            <p className="text-sm text-muted-foreground">@{user.handle}</p>
          </div>
        </div>

        {/* Composer - TipTap handles mention autocomplete internally */}
        <div className="relative mb-2">
          <BlueskyComposer
            value={text}
            onChange={setText}
            placeholder="What's on your mind?"
            disabled={isLoading}
          />
        </div>

        {/* Character counter */}
        <div className="flex justify-end mb-4">
          <GraphemeCounter text={text} max={300} />
        </div>

        {/* Preview */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">Preview</p>
          {isLoadingImage ? (
            <div className="rounded-lg border p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <BlueskyPostPreview
              author={user}
              text={text || 'Your post text will appear here...'}
              linkCard={{
                url: content.url,
                title: content.title,
                description: content.description,
                thumbUrl: content.ogImageUrl,
              }}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canPost} className="gap-2">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <BlueskyLogo className="h-4 w-4" />
                Post
              </>
            )}
          </Button>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
