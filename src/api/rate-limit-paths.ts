/**
 * Paths that receive the relaxed autocomplete rate limit.
 *
 * @remarks
 * Exported so the XRPC entries can be checked against the registered method
 * NSIDs. One of them named `pub.chive.search.searchSubmissions`, a method that
 * does not exist — the real NSID is `pub.chive.eprint.searchSubmissions` — so
 * search never matched the relaxed tier and every anonymous search was billed
 * against the low tier instead. A stale name in a list like this is invisible:
 * it fails by silently not matching.
 *
 * @public
 */
export const AUTOCOMPLETE_RATE_LIMIT_PATHS: readonly string[] = [
  '/xrpc/pub.chive.eprint.searchSubmissions',
  '/xrpc/pub.chive.actor.autocompleteOrcid',
  '/xrpc/pub.chive.actor.autocompleteAffiliation',
  '/xrpc/pub.chive.actor.autocompleteKeyword',
  '/xrpc/pub.chive.actor.autocompleteOpenReview',
  '/xrpc/pub.chive.claiming.autocomplete',
  '/api/v1/search', // REST search endpoint
];
