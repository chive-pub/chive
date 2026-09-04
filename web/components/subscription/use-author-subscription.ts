/**
 * Subscribing to an author, as an ordinary collection.
 *
 * @remarks
 * A subscription is not a separate kind of thing. Subscribing to an author
 * creates a collection in the reader's own personal graph holding exactly one
 * item — that author — and the activity feed collections already have does the
 * rest. Every branch a subscription needs (their papers, reviews of their
 * papers, reviews they write, papers citing them) is a branch the collection
 * feed already computes for any collection that holds a person.
 *
 * The consequence worth stating plainly, because the interface has to say it
 * too: a subscription is visible and editable as a collection. A reader can
 * open it, rename it, add a second author to it, or delete it, and nothing
 * about it is hidden from them.
 *
 * The chosen activity types live on the collection node's metadata in the
 * reader's own repository, not in Chive. Chive is an AppView; a preference it
 * owned would be a preference that could not be rebuilt from the firehose.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAgent, useCurrentUser } from '@/lib/auth';
import {
  findSubscription,
  subscribeToPublication,
  unsubscribe as unsubscribeFromPublication,
} from '@/lib/atproto/subscription-records';
import {
  useCreateCollection,
  useDeleteCollection,
  useMyCollections,
  useUpdateCollection,
  type CollectionView,
} from '@/lib/hooks/use-collections';
import { useAddItemToCollection } from '@/components/collection/use-add-to-collection';

/** One kind of activity a reader can choose to follow. */
export interface AuthorActivityType {
  /** Feed event type, as `pub.chive.collection.getFeed` names it. */
  readonly id: string;
  /** Checkbox label. */
  readonly label: string;
  /** One line saying what arrives when this is on. */
  readonly description: string;
}

/**
 * The activity a reader can follow from one author.
 *
 * @remarks
 * These are exactly the collection feed branches that key off a person, so
 * each maps to one event type with no translation.
 *
 * @public
 */
export const AUTHOR_ACTIVITY_TYPES: readonly AuthorActivityType[] = [
  {
    id: 'eprint_by_author',
    label: 'New papers',
    description: 'Papers they post',
  },
  {
    id: 'review_on_authored_eprint',
    label: 'Reviews of their papers',
    description: 'When someone else reviews a paper they wrote',
  },
  {
    id: 'endorsement_on_authored_eprint',
    label: 'Endorsements of their papers',
    description: 'When someone else endorses a paper they wrote',
  },
  {
    id: 'annotation_on_authored_eprint',
    label: 'Annotations on their papers',
    description: 'When someone else annotates a paper they wrote',
  },
  {
    id: 'review_by_author',
    label: 'Reviews they write',
    description: 'Reviews they leave on other people’s papers',
  },
  {
    id: 'endorsement_by_author',
    label: 'Endorsements they give',
    description: 'Papers they endorse',
  },
  {
    id: 'eprint_referencing_person',
    label: 'Papers citing them',
    description: 'New papers that cite their work',
  },
] as const;

/**
 * What a reader gets when they subscribe without choosing.
 *
 * @remarks
 * Their output and the response to it. The rest are opt-in because a feed
 * that turns everything on by default is a feed people mute.
 */
export const DEFAULT_ACTIVITY_TYPES: readonly string[] = [
  'eprint_by_author',
  'review_on_authored_eprint',
  'endorsement_on_authored_eprint',
];

/** What the hook reports about a reader's subscription to one author. */
export interface AuthorSubscriptionState {
  /** Whether the signed-in reader subscribes to this author. */
  readonly subscribed: boolean;
  /** The backing collection, when they do. */
  readonly collection?: CollectionView;
  /** Activity types currently followed. */
  readonly activityTypes: readonly string[];
  /** True while the reader's collections are being read. */
  readonly isLoading: boolean;
  /** True while a subscribe, unsubscribe, or edit is being written. */
  readonly isPending: boolean;
  /** How many readers Chive has observed following this author. */
  readonly subscriberCount: number;
  /** The author's standard.site publication, when they hold one. */
  readonly publicationUri?: string;
  readonly error?: string;
  /** Creates the backing collection and adds the author to it. */
  readonly subscribe: (activityTypes?: readonly string[]) => Promise<void>;
  /** Deletes the backing collection. */
  readonly unsubscribe: () => Promise<void>;
  /** Rewrites which activity types the collection surfaces. */
  readonly setActivityTypes: (activityTypes: readonly string[]) => Promise<void>;
}

/**
 * Tracks and edits a reader's subscription to one author.
 *
 * @param authorDid - The author being followed
 * @param authorName - Their display name, used to label the collection
 * @returns Subscription state and the actions that change it
 *
 * @public
 */
export function useAuthorSubscription(
  authorDid: string,
  authorName: string
): AuthorSubscriptionState {
  const currentUser = useCurrentUser();
  const myDid = currentUser?.did;

  const { data, isLoading } = useMyCollections(myDid ?? '', { enabled: Boolean(myDid) });
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const updateCollection = useUpdateCollection();
  const { addItem } = useAddItemToCollection();

  const agent = useAgent();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [publicationUri, setPublicationUri] = useState<string | undefined>();
  const [subscriberCount, setSubscriberCount] = useState(0);

  // An author who publishes through standard.site can also be followed in the
  // wider ecosystem's own terms. That record is written alongside the
  // collection, never instead of it: the collection is what drives the feed,
  // and following has to work for the great majority of authors who hold no
  // publication at all.
  useEffect(() => {
    let cancelled = false;
    async function loadPublication(): Promise<void> {
      try {
        const response = await fetch(
          `/xrpc/pub.chive.subscription.getStatus?did=${encodeURIComponent(authorDid)}`
        );
        if (!response.ok) return;
        const body = (await response.json()) as {
          subscriberCount?: number;
          publicationUri?: string;
        };
        if (cancelled) return;
        setSubscriberCount(body.subscriberCount ?? 0);
        setPublicationUri(body.publicationUri);
      } catch {
        // A profile must render whether or not this could be read.
      }
    }
    void loadPublication();
    return () => {
      cancelled = true;
    };
  }, [authorDid]);

  // The reader may hold more than one collection naming this author if they
  // built one by hand as well. The oldest wins, so that repeatedly pressing
  // subscribe cannot fork the subscription.
  const collection = useMemo(() => {
    const matches = (data?.collections ?? []).filter((c) => c.subscriptionDid === authorDid);
    return matches.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  }, [data, authorDid]);

  const activityTypes = useMemo(
    () => collection?.activityTypes ?? DEFAULT_ACTIVITY_TYPES,
    [collection]
  );

  const subscribe = useCallback(
    async (types: readonly string[] = DEFAULT_ACTIVITY_TYPES) => {
      if (!myDid || isPending || collection) return;
      setIsPending(true);
      setError(undefined);
      try {
        const created = await createCollection.mutateAsync({
          name: `Following ${authorName}`,
          description: `Activity from ${authorName}, followed from their profile.`,
          // Unlisted keeps the collection out of Chive's public listings. It
          // is not privacy: the node and its edge are ordinary records in the
          // reader's repository, readable by anyone off the firehose, and
          // ATProto has no private record to offer instead. The setting only
          // says this is a working list rather than something the reader is
          // publishing.
          visibility: 'unlisted',
          subscriptionDid: authorDid,
          activityTypes: [...types],
        });

        await addItem({
          collection: created,
          itemUri: authorDid,
          itemType: 'author',
          itemLabel: authorName,
        });

        // Best effort: the follow already works without it, so a standard.site
        // that is unreachable must not read to the user as a failed follow.
        if (agent && publicationUri) {
          try {
            await subscribeToPublication(agent, publicationUri);
            setSubscriberCount((n) => n + 1);
          } catch {
            // The collection is the subscription; this only widens its reach.
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not subscribe');
      } finally {
        setIsPending(false);
      }
    },
    [
      myDid,
      isPending,
      collection,
      createCollection,
      addItem,
      authorDid,
      authorName,
      agent,
      publicationUri,
    ]
  );

  const unsubscribe = useCallback(async () => {
    if (!myDid || !collection || isPending) return;
    setIsPending(true);
    setError(undefined);
    try {
      await deleteCollection.mutateAsync({
        uri: collection.uri,
        ownerDid: myDid,
        ...(collection.cosmikCollectionUri
          ? { cosmikCollectionUri: collection.cosmikCollectionUri }
          : {}),
        ...(collection.cosmikItems ? { cosmikItems: collection.cosmikItems } : {}),
      });

      if (agent && publicationUri) {
        try {
          const existing = await findSubscription(agent, publicationUri);
          if (existing) {
            await unsubscribeFromPublication(agent, existing);
            setSubscriberCount((n) => Math.max(0, n - 1));
          }
        } catch {
          // The collection is gone, which is what unfollowing means here.
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unsubscribe');
    } finally {
      setIsPending(false);
    }
  }, [myDid, collection, isPending, deleteCollection, agent, publicationUri]);

  const setActivityTypes = useCallback(
    async (types: readonly string[]) => {
      if (!myDid || !collection || isPending) return;
      setIsPending(true);
      setError(undefined);
      try {
        await updateCollection.mutateAsync({
          uri: collection.uri,
          ownerDid: myDid,
          activityTypes: [...types],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update the subscription');
      } finally {
        setIsPending(false);
      }
    },
    [myDid, collection, isPending, updateCollection]
  );

  return {
    subscribed: Boolean(collection),
    ...(collection ? { collection } : {}),
    activityTypes,
    isLoading,
    isPending,
    subscriberCount,
    ...(publicationUri !== undefined ? { publicationUri } : {}),
    ...(error !== undefined ? { error } : {}),
    subscribe,
    unsubscribe,
    setActivityTypes,
  };
}
