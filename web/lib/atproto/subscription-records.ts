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

/**
 * The collection a publication lives in.
 */
export const PUBLICATION_COLLECTION = 'site.standard.publication';

/** What a publication needs to exist. */
export interface PublicationInput {
  /** Name readers see, e.g. the author's own name */
  readonly name: string;
  /** Canonical address for the publication's documents */
  readonly url: string;
  readonly description?: string;
}

/**
 * Creates a publication in the author's own repository.
 *
 * @param agent - The author's authenticated agent
 * @param input - The publication's name, url and optional description
 * @returns The publication record that was written
 *
 * @remarks
 * A publication is the thing a reader subscribes to, and it belongs to the
 * author rather than to Chive: it lives in their repository, they can edit or
 * delete it, and it keeps working if Chive stops existing. That is also why it
 * cannot be created on their behalf — only the holder of a repository can write
 * to it.
 *
 * `url` is required by the schema and is the base address documents hang off,
 * so it is the author's page on Chive rather than the site root: a reader
 * following the publication should arrive at that author's papers.
 */
export async function createPublication(
  agent: Agent,
  input: PublicationInput
): Promise<SubscriptionResult> {
  const did = agentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: PUBLICATION_COLLECTION,
    record: {
      $type: PUBLICATION_COLLECTION,
      name: input.name,
      url: input.url,
      ...(input.description ? { description: input.description } : {}),
    },
    validate: false,
  });

  return { uri: response.data.uri, cid: response.data.cid };
}

/**
 * Finds the publication an author already holds for their Chive papers.
 *
 * @param agent - The author's authenticated agent
 * @param url - The publication url to match on
 * @returns Its AT-URI, or undefined
 *
 * @remarks
 * Matched on `url` rather than on name, because a name is the author's to
 * change and matching on it would mint a second publication the moment they
 * renamed the first -- splitting their subscribers across two records.
 */
export async function findPublication(agent: Agent, url: string): Promise<string | undefined> {
  const did = agentDid(agent);
  if (!did) return undefined;

  let cursor: string | undefined;
  do {
    const response = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: PUBLICATION_COLLECTION,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });

    for (const record of response.data.records) {
      const value = record.value as { url?: unknown };
      if (value.url === url) {
        return record.uri;
      }
    }

    cursor = response.data.cursor;
  } while (cursor);

  return undefined;
}

/**
 * Updates a publication's editable fields.
 *
 * @param agent - The author's authenticated agent
 * @param uri - The publication to update
 * @param input - The new values
 *
 * @remarks
 * `url` is preserved rather than taken from the input: it is what
 * {@link findPublication} matches on and what existing subscriptions were
 * written against, so changing it would orphan every subscriber.
 */
export async function updatePublication(
  agent: Agent,
  uri: string,
  input: { name: string; description?: string }
): Promise<void> {
  const did = agentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const match = /^at:\/\/(did:[^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) {
    throw new Error(`Not an AT-URI: ${uri}`);
  }

  const [, recordDid, collection, rkey] = match;
  if (recordDid !== did) {
    throw new Error('Cannot edit a publication belonging to another repository');
  }
  if (collection !== PUBLICATION_COLLECTION) {
    throw new Error(`Not a publication record: ${collection ?? ''}`);
  }

  const existing = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: PUBLICATION_COLLECTION,
    rkey: rkey ?? '',
  });

  const current = existing.data.value as Record<string, unknown>;

  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: PUBLICATION_COLLECTION,
    rkey: rkey ?? '',
    record: {
      ...current,
      $type: PUBLICATION_COLLECTION,
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    validate: false,
  });
}

/**
 * The publication url for an author's papers on Chive.
 *
 * @param did - The author's DID
 * @param origin - Site origin, defaulting to the canonical one
 * @returns The url a publication for their papers is keyed by
 *
 * @remarks
 * Their author page rather than the site root: a publication's `url` is the
 * base its documents hang off, and a reader arriving from a subscription should
 * land on that author's papers rather than on Chive's front page.
 *
 * It is also what {@link findPublication} matches on, so it must not depend on
 * anything the author can change — a handle can move, a display name is theirs
 * to edit, and either would mint a second publication and split the
 * subscribers. The DID cannot.
 */
export function publicationUrlFor(did: string, origin = 'https://chive.pub'): string {
  return `${origin.replace(/\/+$/, '')}/authors/${did}`;
}

/**
 * Finds the author's publication for their Chive papers, creating it if absent.
 *
 * @param agent - The author's authenticated agent
 * @param displayName - Name readers see; falls back to their handle
 * @param origin - Site origin, for tests and non-production deployments
 * @returns The publication's AT-URI
 *
 * @remarks
 * A `site.standard.document` names a publication, and a reader can only
 * subscribe to a publication that exists. Creating one on demand is what turns
 * a Subscribe control from a promise into a working thing — but it is still the
 * author's record, in the author's repository, and theirs to rename or delete.
 */
export async function ensurePublication(
  agent: Agent,
  displayName: string,
  origin?: string
): Promise<string> {
  const did = agentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const url = publicationUrlFor(did, origin);

  const existing = await findPublication(agent, url);
  if (existing) return existing;

  const created = await createPublication(agent, {
    name: displayName,
    url,
    description: `Papers by ${displayName} on Chive.`,
  });

  return created.uri;
}
