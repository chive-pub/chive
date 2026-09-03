/**
 * Writes sifa.id records to the signed-in researcher's own repository.
 *
 * @remarks
 * sifa.id (`did:plc:2f2ahswozqy4v5lvu676375y`) keeps its records in each user's
 * own repository under `id.sifa.*`. A researcher who submits an eprint to Chive
 * and also keeps a sifa profile would otherwise enter the same publication
 * twice; this lets them write the sifa record at the moment they have the
 * details in hand.
 *
 * Two things this is careful about:
 *
 * 1. **The record is the researcher's, not Chive's.** It is written by their
 *    own agent to their own repository, exactly as their `pub.chive.*` records
 *    are. Chive's backend never writes to a user PDS, and nothing here changes
 *    that.
 * 2. **It is opt-in.** Writing to a namespace another service owns is not
 *    something to do on a researcher's behalf without asking, so the wizard
 *    offers it and defaults to off.
 *
 * `sameAs` is what ties the two together: it is sifa's own field for "this
 * record refers to a record elsewhere", and pointing it at the Chive eprint's
 * AT-URI means a sifa consumer can resolve the publication back to the eprint.
 * Its CID is deliberately omitted — the lexicon describes it as an integrity
 * hint that pins one version, and an eprint that is later edited should still
 * resolve.
 *
 * The schemas here were read from the lexicons sifa.id publishes, resolved
 * through the `_lexicon.sifa.id` DNS TXT record.
 *
 * @packageDocumentation
 */

import type { Agent } from '@atproto/api';

/**
 * Collection for publication records.
 *
 * @public
 */
export const SIFA_PUBLICATION_COLLECTION = 'id.sifa.profile.publication';

/**
 * Collection for talk and presentation records.
 *
 * @public
 */
export const SIFA_PRESENTATION_DELIVERY_COLLECTION = 'id.sifa.profile.presentationDelivery';

/**
 * A co-author, as `id.sifa.profile.publication#author` describes one.
 *
 * @public
 */
export interface SifaAuthor {
  /** Display name; required by the lexicon */
  name: string;
  /** The author's DID, when they have an account */
  did?: string;
}

/**
 * What a sifa publication record needs.
 *
 * @public
 */
export interface SifaPublicationInput {
  /** Publication title; required by the lexicon */
  title: string;
  /** AT-URI of the Chive eprint this describes */
  eprintUri: string;
  /** Canonical web URL of the eprint */
  url?: string;
  /** Co-authors */
  authors?: SifaAuthor[];
  /** Abstract or summary */
  description?: string;
  /** ISO date of publication */
  publishedAt?: string;
  /** Publisher or venue */
  publisher?: string;
}

/**
 * What a sifa talk record needs.
 *
 * @public
 */
export interface SifaTalkInput {
  /** Talk title */
  title?: string;
  /** AT-URI of the related Chive eprint */
  eprintUri?: string;
  /** Event the talk was given at */
  eventName?: string;
  /** ISO date it was given */
  date?: string;
  /** Where it was given */
  location?: string;
  /** Speaking role */
  role?: string;
}

/**
 * The result of writing a record.
 *
 * @public
 */
export interface SifaRecordResult {
  uri: string;
  cid: string;
}

/**
 * Drops keys whose value is undefined or an empty string.
 *
 * @remarks
 * A lexicon-validating PDS rejects a record carrying a property set to
 * `undefined`, and an empty string is not a value a reader wants either.
 */
function compact<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== '')
  );
}

/**
 * Writes an `id.sifa.profile.publication` for an eprint.
 *
 * @param agent - The researcher's authenticated agent
 * @param input - Publication details
 * @returns The created record's URI and CID
 *
 * @throws When the agent has no session, or the PDS rejects the record
 *
 * @remarks
 * `createdAt` is required by the lexicon and means when the record was made,
 * which is not the same as `publishedAt` — when the work came out.
 *
 * @public
 */
export async function createSifaPublication(
  agent: Agent,
  input: SifaPublicationInput
): Promise<SifaRecordResult> {
  const did = agent.did;
  if (!did) {
    throw new Error('Cannot write a sifa record without an authenticated session');
  }

  const record = compact({
    $type: SIFA_PUBLICATION_COLLECTION,
    title: input.title,
    createdAt: new Date().toISOString(),
    url: input.url,
    description: input.description,
    publishedAt: input.publishedAt,
    publisher: input.publisher,
    // No `cid`: the lexicon calls it an integrity hint pinning one version, and
    // a reference to an eprint should follow the eprint's edits.
    sameAs: { uri: input.eprintUri },
    ...(input.authors && input.authors.length > 0
      ? { authors: input.authors.map((a) => compact({ name: a.name, did: a.did })) }
      : {}),
  });

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: SIFA_PUBLICATION_COLLECTION,
    record,
    // A foreign lexicon: a PDS that cannot resolve this NSID rejects the write
    // outright rather than storing it, so validation is left to this module.
    validate: false,
  });

  return { uri: response.data.uri, cid: response.data.cid };
}

/**
 * Writes an `id.sifa.profile.presentationDelivery` for a talk.
 *
 * @param agent - The researcher's authenticated agent
 * @param input - Talk details
 * @returns The created record's URI and CID
 *
 * @throws When the agent has no session, or the PDS rejects the record
 *
 * @remarks
 * `presentationDelivery` is one occasion on which a talk was given — the
 * lexicon separates the talk itself (`presentation`) from each delivery of it,
 * because the same talk is given at several venues. A researcher recording a
 * conference presentation of their eprint means a delivery.
 *
 * Only `createdAt` is required, so a talk with nothing but an event name is a
 * valid record.
 *
 * @public
 */
export async function createSifaTalk(
  agent: Agent,
  input: SifaTalkInput
): Promise<SifaRecordResult> {
  const did = agent.did;
  if (!did) {
    throw new Error('Cannot write a sifa record without an authenticated session');
  }

  const record = compact({
    $type: SIFA_PRESENTATION_DELIVERY_COLLECTION,
    createdAt: new Date().toISOString(),
    title: input.title,
    eventName: input.eventName,
    date: input.date,
    location: input.location,
    role: input.role,
    ...(input.eprintUri ? { sameAs: { uri: input.eprintUri } } : {}),
  });

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: SIFA_PRESENTATION_DELIVERY_COLLECTION,
    record,
    // A foreign lexicon: a PDS that cannot resolve this NSID rejects the write
    // outright rather than storing it, so validation is left to this module.
    validate: false,
  });

  return { uri: response.data.uri, cid: response.data.cid };
}
