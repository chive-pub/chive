'use client';

/**
 * Following an author.
 *
 * @remarks
 * Following creates a collection in the reader's own repository holding that
 * one author, and the feed collections already have does the rest. The control
 * says so in as many words rather than presenting following as a separate
 * mechanism, because the collection is not an implementation detail the reader
 * is meant to be shielded from: it appears in their library, and they can open,
 * rename, extend, or delete it like any other.
 *
 * Which activity arrives is a property of that collection, stored on the
 * collection record in the reader's repository. Chive indexes the choice; it
 * does not own it.
 *
 * @packageDocumentation
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Rss, Check, Loader2, FolderOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useIsAuthenticated } from '@/lib/auth';
import { cn } from '@/lib/utils';

import {
  activityGroupsFor,
  activityTypesFor,
  AUTHOR_ACTIVITY_TYPES,
  DEFAULT_ACTIVITY_GROUPS,
  useAuthorSubscription,
} from './use-author-subscription';

/**
 * Props for {@link SubscribeButton}.
 *
 * @public
 */
export interface SubscribeButtonProps {
  /** DID of the author being followed */
  authorDid: string;
  /** The author's display name, used to label the collection */
  authorName: string;
  /** `icon` sits in a row of icon buttons; `default` stands alone */
  variant?: 'icon' | 'default';
  className?: string;
}

/**
 * A follow control for an author, with the activity choice attached.
 *
 * @param props - Component props
 * @returns The control
 *
 * @public
 */
export function SubscribeButton({
  authorDid,
  authorName,
  variant = 'default',
  className,
}: SubscribeButtonProps) {
  const isAuthenticated = useIsAuthenticated();
  const {
    subscribed,
    collection,
    activityTypes,
    subscriberCount,
    isLoading,
    isPending,
    error,
    subscribe,
    unsubscribe,
    setActivityTypes,
  } = useAuthorSubscription(authorDid, authorName);

  const [open, setOpen] = useState(false);
  // Held locally so a reader can tick several boxes before anything is
  // written. Re-synced whenever the stored choice changes underneath.
  // Held as group ids, which is what the checkboxes are. They expand to feed
  // event types only on the way out; the record and the API speak event types.
  const [draft, setDraft] = useState<string[]>([...DEFAULT_ACTIVITY_GROUPS]);

  useEffect(() => {
    setDraft(activityGroupsFor([...activityTypes]));
  }, [activityTypes]);

  const toggleType = (id: string): void => {
    setDraft((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  };

  const handleOpenChange = (next: boolean): void => {
    if (!isAuthenticated) {
      window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    // Closing an open editor commits the pending choice. A separate Save is a
    // step that exists only to be forgotten.
    if (!next && subscribed) {
      const current = activityGroupsFor([...activityTypes]);
      const changed = draft.length !== current.length || draft.some((g) => !current.includes(g));
      if (changed) void setActivityTypes(activityTypesFor(draft));
    }
    setOpen(next);
  };

  const Icon = isPending ? Loader2 : subscribed ? Check : Rss;
  const label = subscribed ? 'Following' : 'Follow';
  const title = subscribed
    ? `Following ${authorName}. Choose what appears in your feed.`
    : `Follow ${authorName}`;

  const trigger =
    variant === 'icon' ? (
      <Button
        variant="ghost"
        size="icon"
        className={className}
        title={title}
        aria-label={title}
        aria-pressed={subscribed}
        disabled={isLoading || isPending}
      >
        <Icon className={cn('h-4 w-4', isPending && 'animate-spin')} />
      </Button>
    ) : (
      <Button
        variant={subscribed ? 'secondary' : 'outline'}
        size="sm"
        className={className}
        title={title}
        aria-pressed={subscribed}
        disabled={isLoading || isPending}
      >
        <Icon className={cn('h-4 w-4 mr-2', isPending && 'animate-spin')} />
        {label}
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="p-3">
          <p className="text-sm font-medium">
            {subscribed ? `Following ${authorName}` : `Follow ${authorName}`}
          </p>
          {subscriberCount > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {subscriberCount} {subscriberCount === 1 ? 'follower' : 'followers'}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {subscribed
              ? 'This is a collection in your library holding one person. Everything you can do to a collection, you can do to this.'
              : 'Following creates a collection in your library holding this one person. Your feed is that collection’s activity, so you can open, rename, or extend it later.'}
          </p>
        </div>

        <Separator />

        <fieldset className="p-3">
          <legend className="sr-only">Activity to include</legend>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Show me</p>
          <div className="space-y-2">
            {AUTHOR_ACTIVITY_TYPES.map((type) => (
              <label
                key={type.id}
                htmlFor={`activity-${authorDid}-${type.id}`}
                className="flex items-start gap-2 cursor-pointer"
              >
                <Checkbox
                  id={`activity-${authorDid}-${type.id}`}
                  aria-label={type.label}
                  checked={draft.includes(type.id)}
                  onCheckedChange={() => {
                    toggleType(type.id);
                  }}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-sm leading-tight">{type.label}</span>
                  <span className="block text-xs text-muted-foreground leading-tight">
                    {type.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Separator />

        <div className="flex flex-wrap items-center gap-2 p-3">
          {subscribed ? (
            <>
              {collection && (
                <Button variant="ghost" size="sm" asChild className="min-w-0">
                  <Link href={`/collections/${encodeURIComponent(collection.uri)}`}>
                    <FolderOpen className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate">Open collection</span>
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive ml-auto"
                disabled={isPending}
                onClick={() => {
                  void unsubscribe().then(() => {
                    setOpen(false);
                  });
                }}
              >
                Unfollow
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="w-full"
              disabled={isPending || draft.length === 0}
              onClick={() => {
                void subscribe(activityTypesFor(draft)).then(() => {
                  setOpen(false);
                });
              }}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <span className="truncate">
                {draft.length === 0 ? 'Choose at least one' : `Follow ${authorName}`}
              </span>
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="px-3 pb-3 text-xs text-destructive">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
