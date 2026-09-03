/**
 * Writing standard.site subscriptions.
 *
 * @remarks
 * A subscription is a `site.standard.graph.subscription` record naming a
 * publication. It is written into the *subscriber's* own repository, not the
 * author's and not Chive's: following someone is a statement the follower
 * makes, and it stays theirs to withdraw.
 *
 * Chive learns about it the same way it learns about any foreign record — from
 * the firehose — so nothing here talks to Chive's API.
 *
 * @packageDocumentation
 */

import type { Agent } from '@atproto/api';

/**
 * The collection a subscription lives in.
 */
export const SUBSCRIPTION_COLLECTION = 'site.standard.graph.subscription';

/** Result of writing a record. */
export interface SubscriptionResult {
  readonly uri: string;
  readonly cid: string;
}

/**
 * Reads the DID an agent is authenticated as.
 */
function agentDid(agent: Agent): string | undefined {
  return agent.did ?? undefined;
}

/**
 * Subscribes the signed-in reader to a publication.
 *
 * @param agent - The reader's authenticated agent
 * @param publicationUri - AT-URI of the `site.standard.publication`
 * @returns The subscription record that was written
 *
 * @remarks
 * Validation is skipped for the same reason as every other foreign lexicon: a
 * PDS that cannot resolve the NSID rejects the write outright rather than
 * storing it, and resolution is a fact about the writer's PDS rather than about
 * the record.
 */
export async function subscribeToPublication(
  agent: Agent,
  publicationUri: string
): Promise<SubscriptionResult> {
  const did = agentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: SUBSCRIPTION_COLLECTION,
    record: {
      $type: SUBSCRIPTION_COLLECTION,
      publication: publicationUri,
      createdAt: new Date().toISOString(),
    },
    validate: false,
  });

  return { uri: response.data.uri, cid: response.data.cid };
}

/**
 * Withdraws a subscription.
 *
 * @param agent - The reader's authenticated agent
 * @param subscriptionUri - AT-URI of the subscription record to delete
 *
 * @remarks
 * The record belongs to the reader, so this deletes from their own repository
 * and refuses to touch anyone else's — a guard against a mis-plumbed URI
 * reaching a delete call.
 */
export async function unsubscribe(agent: Agent, subscriptionUri: string): Promise<void> {
  const did = agentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const match = /^at:\/\/(did:[^/]+)\/([^/]+)\/(.+)$/.exec(subscriptionUri);
  if (!match) {
    throw new Error(`Not an AT-URI: ${subscriptionUri}`);
  }

  const [, recordDid, collection, rkey] = match;
  if (recordDid !== did) {
    throw new Error('Cannot delete a subscription belonging to another repository');
  }
  if (collection !== SUBSCRIPTION_COLLECTION) {
    throw new Error(`Not a subscription record: ${collection ?? ''}`);
  }

  await agent.com.atproto.repo.deleteRecord({
    repo: did,
    collection: SUBSCRIPTION_COLLECTION,
    rkey: rkey ?? '',
  });
}

/**
 * Finds the reader's existing subscription to a publication, if any.
 *
 * @param agent - The reader's authenticated agent
 * @param publicationUri - The publication to look for
 * @returns The subscription's AT-URI, or undefined
 *
 * @remarks
 * Read from the reader's own repository rather than from Chive's index. The
 * index lags the firehose by a moment, and a control that flips back to
 * "Subscribe" immediately after being pressed reads as a failure.
 */
export async function findSubscription(
  agent: Agent,
  publicationUri: string
): Promise<string | undefined> {
  const did = agentDid(agent);
  if (!did) return undefined;

  let cursor: string | undefined;
  do {
    const response = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: SUBSCRIPTION_COLLECTION,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });

    for (const record of response.data.records) {
      const value = record.value as { publication?: unknown };
      if (value.publication === publicationUri) {
        return record.uri;
      }
    }

    cursor = response.data.cursor;
  } while (cursor);

  return undefined;
}
