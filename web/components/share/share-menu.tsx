'use client';

/**
 * Share menu dropdown component.
 *
 * @remarks
 * Provides a dropdown menu with options to copy link, share to Bluesky,
 * and use the native Web Share API (on supported devices).
 */

import { useState, useCallback } from 'react';
import { Share2, Copy, Check, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { ShareContent } from '@/lib/bluesky';

/**
 * Bluesky logo SVG component.
 */
function BlueskyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 568 501" fill="currentColor" className={className} aria-hidden="true">
      <path d="M123.121 33.6637C188.241 82.5526 258.281 181.681 284 234.873C309.719 181.681 379.759 82.5526 444.879 33.6637C491.866 -1.61183 568 -28.9064 568 57.9464C568 75.2916 558.055 203.659 552.222 224.501C531.947 296.954 458.067 315.434 392.347 304.249C507.222 323.8 536.444 388.56 473.333 453.32C353.473 576.312 301.061 422.461 287.631 381.547C285.169 373.121 284.049 369.921 284 369.921C283.951 369.921 282.831 373.121 280.369 381.547C266.939 422.461 214.527 576.312 94.6667 453.32C31.5556 388.56 60.7778 323.8 175.653 304.249C109.933 315.434 36.0525 296.954 15.7778 224.501C9.94525 203.659 0 75.2916 0 57.9464C0 -28.9064 76.1345 -1.61183 123.121 33.6637Z" />
    </svg>
  );
}

/**
 * Props for the ShareMenu component.
 */
interface ShareMenuProps {
  /** Content to share */
  content: ShareContent;
  /** Called when Share to Bluesky is clicked */
  onShareToBluesky: () => void;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'icon';
  /** Additional CSS classes for the trigger button */
  className?: string;
  /** Custom trigger element (replaces default button) */
  trigger?: React.ReactNode;
}

/**
 * Check if Web Share API is available.
 */
function isWebShareSupported(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

/**
 * Share menu dropdown component.
 *
 * @example
 * ```tsx
 * <ShareMenu
 *   content={{
 *     type: 'eprint',
 *     url: 'https://chive.pub/eprints/...',
 *     title: 'My Eprint',
 *     description: 'Abstract...',
 *     ogImageUrl: '/api/og?type=eprint&...'
 *   }}
 *   onShareToBluesky={() => setShowDialog(true)}
 * />
 * ```
 */
export function ShareMenu({
  content,
  onShareToBluesky,
  variant = 'outline',
  size = 'default',
  className,
  trigger,
}: ShareMenuProps) {
  const [copied, setCopied] = useState(false);
  const webShareSupported = isWebShareSupported();

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content.url);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }, [content.url]);

  // Native Web Share
  const handleWebShare = useCallback(async () => {
    try {
      await navigator.share({
        title: content.title,
        text: content.description,
        url: content.url,
      });
    } catch (error) {
      // User cancelled or share failed
      if ((error as Error).name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  }, [content]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button variant={variant} size={size} className={className}>
            <Share2 className="h-4 w-4" />
            {size !== 'icon' && <span className="ml-2">Share</span>}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          <span>Copy link</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onShareToBluesky}>
          <BlueskyLogo className="h-4 w-4" />
          <span>Share to Bluesky</span>
        </DropdownMenuItem>

        {webShareSupported && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleWebShare}>
              <MoreHorizontal className="h-4 w-4" />
              <span>More options...</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Simple share button for inline use (without dropdown).
 * Opens directly to Bluesky share dialog.
 */
interface ShareToBlueskyButtonProps {
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
}

export function ShareToBlueskyButton({
  onClick,
  variant = 'ghost',
  size = 'sm',
  className,
}: ShareToBlueskyButtonProps) {
  return (
    <Button variant={variant} size={size} onClick={onClick} className={className}>
      <BlueskyLogo className="h-4 w-4" />
      <span className="ml-1">Share</span>
    </Button>
  );
}

// Export the Bluesky logo for use in other components
export { BlueskyLogo };
