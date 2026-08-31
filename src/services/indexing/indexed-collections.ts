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
 * The PDS scanner now derives its backfill list from here too, so a repository
 * scan covers exactly what the firehose covers. It had its own copy, which had
 * drifted in both directions: it scanned `pub.chive.review.entityLink`, which
 * the processor does not index, and missed both `collaboration` collections, so
 * a backfill could never recover a co-author invitation.
 *
 * `pub.chive.eprint.tag` used to appear here. There is no such lexicon — the
 * record type is `pub.chive.eprint.userTag`, and the processor keeps a
 * fall-through case for the old name. Listing it here let `sync.indexRecord`
 * accept a manual index request for a collection with no schema at all.
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
  'pub.chive.actor.mute',
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

/**
 * Foreign collections Chive observes but does not index.
 *
 * @remarks
 * These are other applications' lexicons. Chive never stores them as its own
 * records: `createEventProcessor` forwards them to the plugin event bus as
 * `firehose.<collection>`, and the backlink plugins turn the ones that
 * reference an eprint into backlink rows. A backlink is derived data,
 * rebuildable by replaying the firehose, so this stays inside the AppView
 * rules — Chive is still authoritative for nothing but `pub.chive.*`.
 *
 * The plugins subscribing to these were dormant for a different reason than
 * anyone assumed. They were constructed and listening, and the processor was
 * already forwarding foreign records; `EventFilter` rejected every collection
 * outside `pub.chive.*` before the processor ever saw one. Five registered
 * plugins were therefore subscribed to events that could not fire.
 *
 * `app.bsky.feed.post` is deliberately absent. It is the entire Bluesky
 * timeline — millions of records a day against Chive's thousands — and
 * admitting it changes the indexer from something that reads a niche namespace
 * into something that reads the whole network. That may well be worth doing for
 * the timeline-card backlinks it would enable, but it is a capacity decision
 * with a cost attached, not a filter entry. `OBSERVED_COLLECTIONS_HIGH_VOLUME`
 * holds it, and `FIREHOSE_OBSERVE_HIGH_VOLUME=true` opts in.
 *
 * @public
 */
export const OBSERVED_COLLECTIONS: readonly string[] = [
  // Cosmik — collection cards, connections, follows, and link removals.
  'network.cosmik.card',
  'network.cosmik.collectionLinkRemoval',
  'network.cosmik.connection',
  'network.cosmik.follow',
  // Margin — annotations and replies on eprints.
  'at.margin.note',
  'at.margin.reply',
  // WhiteWind — blog entries that may cite an eprint.
  'com.whtwnd.blog.entry',
] as const;

// Leaflet is deliberately absent. `leaflet-backlinks.ts` still points at
// `xyz.leaflet.list`, an NSID that does not exist, and its parser expects an
// invented record shape. Admitting `pub.leaflet.document` here would deliver
// records to a plugin that cannot read them, and repointing the plugin without
// Leaflet's published lexicon would turn "indexes nothing" into "indexes wrong
// backlinks". This list names collections a subscriber can actually consume.

/**
 * Foreign collections whose volume makes observing them a capacity decision.
 *
 * @remarks
 * Enabled by `FIREHOSE_OBSERVE_HIGH_VOLUME=true`. Off by default: a deployment
 * should choose to read the whole Bluesky timeline rather than discover it did.
 *
 * @public
 */
export const OBSERVED_COLLECTIONS_HIGH_VOLUME: readonly string[] = ['app.bsky.feed.post'] as const;

/**
 * Reports whether a collection is one Chive observes for backlinks.
 *
 * @param collection - Collection NSID
 * @param includeHighVolume - Whether the high-volume set is enabled
 * @returns True when the collection should reach the plugin bus
 *
 * @public
 */
export function isObservedCollection(collection: string, includeHighVolume = false): boolean {
  if (OBSERVED_COLLECTIONS.includes(collection)) {
    return true;
  }
  return includeHighVolume && OBSERVED_COLLECTIONS_HIGH_VOLUME.includes(collection);
}
