'use client';

/**
 * Subscribe to an author's publication.
 *
 * @remarks
 * The record is written into the *reader's* own repository, not Chive's and not
 * the author's: following someone is a statement the follower makes, and it
 * stays theirs to withdraw. Chive observes it on the firehose and counts it.
 *
 * The control is hidden rather than disabled when the author has no
 * publication. A disabled Subscribe invites a reader to work out what they did
 * wrong, when the answer is that there is nothing on the other end yet.
 *
 * @packageDocumentation
 */

import { Rss, Check, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIsAuthenticated } from '@/lib/auth';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { cn } from '@/lib/utils';

/**
 * Props for {@link SubscribeButton}.
 *
 * @public
 */
export interface SubscribeButtonProps {
  /** DID of the author being subscribed to */
  authorDid: string;
  /** `icon` sits in a row of icon buttons; `default` stands alone */
  variant?: 'icon' | 'default';
  /** Whether to show the subscriber count beside the control */
  showCount?: boolean;
  className?: string;
}

/**
 * A subscribe control for an author.
 *
 * @param props - Component props
 * @returns The control, or null when there is nothing to subscribe to
 *
 * @public
 */
export function SubscribeButton({
  authorDid,
  variant = 'default',
  showCount = true,
  className,
}: SubscribeButtonProps) {
  const isAuthenticated = useIsAuthenticated();
  // The publication comes from the same call that gives the count: it is a
  // fact about the author, not something a caller should have to look up.
  const { subscribed, subscriberCount, publicationUri, isLoading, isPending, error, toggle } =
    useSubscription(authorDid);

  // Nothing to subscribe to. The count is still worth showing when there is
  // one, since it describes the author rather than the reader's options.
  if (!publicationUri) {
    if (!showCount || subscriberCount === 0) return null;
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        {subscriberCount} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
      </span>
    );
  }

  const label = subscribed ? 'Subscribed' : 'Subscribe';
  const title = isAuthenticated
    ? `${label} to this author's papers`
    : 'Sign in to subscribe to this author';

  const Icon = isPending ? Loader2 : subscribed ? Check : Rss;

  const handleClick = (): void => {
    if (!isAuthenticated) {
      window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    void toggle();
  };

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className}
        title={title}
        aria-label={title}
        aria-pressed={subscribed}
        disabled={isLoading || isPending}
        onClick={handleClick}
      >
        <Icon className={cn('h-4 w-4', isPending && 'animate-spin')} />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={subscribed ? 'secondary' : 'outline'}
        size="sm"
        className={className}
        title={title}
        aria-pressed={subscribed}
        disabled={isLoading || isPending}
        onClick={handleClick}
      >
        <Icon className={cn('h-4 w-4 mr-2', isPending && 'animate-spin')} />
        {label}
      </Button>
      {showCount && subscriberCount > 0 && (
        <span className="text-sm text-muted-foreground">
          {subscriberCount} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
        </span>
      )}
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
