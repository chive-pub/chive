/**
 * Reading and writing a reader's subscription to an author.
 *
 * @remarks
 * A subscription is a `site.standard.graph.subscription` record in the
 * *reader's* own repository. Chive indexes them from the firehose but does not
 * own them, so the write goes straight to the reader's PDS and only the count
 * comes from Chive.
 *
 * Subscription state is read from the reader's repository rather than from
 * Chive's index. The index lags the firehose by a moment, and a control that
 * flips back to "Subscribe" immediately after being pressed reads as a failure
 * even though the record was written.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useState } from 'react';

import { useAgent, useIsAuthenticated } from '@/lib/auth';
import {
  findSubscription,
  subscribeToPublication,
  unsubscribe,
} from '@/lib/atproto/subscription-records';

/** What the hook reports about a subscription. */
export interface SubscriptionState {
  /** Whether the signed-in reader subscribes. */
  readonly subscribed: boolean;
  /** How many distinct readers subscribe, as Chive has observed. */
  readonly subscriberCount: number;
  /** True while the initial read is in flight. */
  readonly isLoading: boolean;
  /** True while a subscribe or unsubscribe is being written. */
  readonly isPending: boolean;
  /** The author's publication, when they hold one. */
  readonly publicationUri?: string;
  readonly error?: string;
  readonly toggle: () => Promise<void>;
}

/**
 * Tracks a reader's subscription to one author.
 *
 * @param authorDid - The author whose publications are subscribed to
 * @param publicationUri - The author's publication record, when they have one
 * @returns The subscription state and a toggle
 */
export function useSubscription(authorDid: string): SubscriptionState {
  const agent = useAgent();
  const isAuthenticated = useIsAuthenticated();

  const [subscriptionUri, setSubscriptionUri] = useState<string | undefined>();
  const [publicationUri, setPublicationUri] = useState<string | undefined>();
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await fetch(
          `/xrpc/pub.chive.subscription.getStatus?did=${encodeURIComponent(authorDid)}`
        );
        if (response.ok) {
          const body = (await response.json()) as {
            subscriberCount?: number;
            publicationUri?: string;
          };
          if (!cancelled) {
            setSubscriberCount(body.subscriberCount ?? 0);
            setPublicationUri(body.publicationUri);
          }
        }

        // The reader's own repository is authoritative for whether they
        // subscribe; Chive's index only counts.
        const publication = publicationUri;
        if (agent && isAuthenticated && publication) {
          const existing = await findSubscription(agent, publication);
          if (!cancelled) setSubscriptionUri(existing);
        }
      } catch {
        // A profile must render whether or not this could be read.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authorDid, publicationUri, agent, isAuthenticated]);

  const toggle = useCallback(async () => {
    if (!agent || !publicationUri || isPending) return;

    setIsPending(true);
    setError(undefined);

    // Moved before the write and rolled back on failure: a control that does
    // nothing until the PDS answers reads as broken on a slow connection.
    const wasSubscribed = Boolean(subscriptionUri);
    setSubscriptionUri(wasSubscribed ? undefined : 'pending');
    setSubscriberCount((n) => (wasSubscribed ? Math.max(0, n - 1) : n + 1));

    try {
      if (wasSubscribed && subscriptionUri && subscriptionUri !== 'pending') {
        await unsubscribe(agent, subscriptionUri);
        setSubscriptionUri(undefined);
      } else {
        const created = await subscribeToPublication(agent, publicationUri);
        setSubscriptionUri(created.uri);
      }
    } catch (err) {
      setSubscriptionUri(wasSubscribed ? subscriptionUri : undefined);
      setSubscriberCount((n) => (wasSubscribed ? n + 1 : Math.max(0, n - 1)));
      setError(err instanceof Error ? err.message : 'Could not update the subscription');
    } finally {
      setIsPending(false);
    }
  }, [agent, publicationUri, subscriptionUri, isPending]);

  return {
    subscribed: Boolean(subscriptionUri),
    subscriberCount,
    ...(publicationUri !== undefined ? { publicationUri } : {}),
    isLoading,
    isPending,
    ...(error !== undefined ? { error } : {}),
    toggle,
  };
}
