/**
 * The single list of collections Chive indexes.
 *
 * @remarks
 * Three allow-lists used to describe "the collections we index" and had drifted
 * apart: the firehose event processor's dispatch, `sync.indexRecord`'s manual
 * reindex list, and the PDS scanner's backfill filter. A collection present in
 * one and absent from another produces a different index depending on the path
 * a record arrives by — a live firehose event indexes it, a manual reindex of
 * the same record rejects it as unsupported, and a backfill skips it silently.
 *
 * `sync.indexRecord` accepted 13 collections while the event processor handled
 * 20. Seven were unreachable by manual reindex, `pub.chive.graph.edgeProposal`
 * among them, so an edge proposal that the firehose missed could not be
 * recovered by force-indexing it.
 *
 * The list is derived from what the event processor actually dispatches on,
 * because that is the live path and therefore the authoritative definition of
 * "indexed". A test asserts the two agree, so adding a `case` without adding it
 * here fails rather than silently reintroducing the divergence.
 *
 * The PDS scanner's governance subset is deliberately out of scope here; it is
 * owned separately (G-04).
 *
 * @packageDocumentation
 * @public
 */

/**
 * Collections indexed from the firehose and reachable by manual reindex.
 *
 * @public
 */
export const INDEXED_COLLECTIONS: readonly string[] = [
  'pub.chive.actor.profile',
  'pub.chive.actor.profileConfig',
  'pub.chive.annotation.comment',
  'pub.chive.annotation.entityLink',
  'pub.chive.collaboration.invite',
  'pub.chive.collaboration.inviteAcceptance',
  'pub.chive.eprint.changelog',
  'pub.chive.eprint.citation',
  'pub.chive.eprint.relatedWork',
  'pub.chive.eprint.submission',
  'pub.chive.eprint.tag',
  'pub.chive.eprint.userTag',
  'pub.chive.eprint.version',
  'pub.chive.graph.edge',
  'pub.chive.graph.edgeProposal',
  'pub.chive.graph.node',
  'pub.chive.graph.nodeProposal',
  'pub.chive.graph.vote',
  'pub.chive.review.comment',
  'pub.chive.review.endorsement',
] as const;

/**
 * Reports whether a collection is one Chive indexes.
 *
 * @param collection - Collection NSID
 * @returns True when the collection is indexed
 *
 * @public
 */
export function isIndexedCollection(collection: string): boolean {
  return INDEXED_COLLECTIONS.includes(collection);
}
