# Known gaps

This replaces `STUB_IMPLEMENTATIONS.md` and `REMAINING_STUB_IMPLEMENTATIONS.md`,
1,350 lines between them that catalogued placeholders which no longer exist.
Both described a `createPlaceholderRepository` that is not in the codebase and a
`getPublicURL` stub that has been replaced, and they cross-referenced each other
and nothing else. A stale catalogue of gaps is worse than none: it sends a
reader looking for problems that were fixed, and lends false confidence that
anything absent from it is done.

Exactly one item from those documents is still real.

## Blob CDN (L2 cache) is never configured

`src/index.ts` builds the real CDN adapter only when five `R2_*` variables are
set, and no checked-in configuration sets any of them. Production therefore
always takes `createNoOpCDNAdapter()`, and the L2 blob cache is permanently off.
Nothing fails; blob reads simply always go to the origin PDS.

Whether to wire this or delete the R2 path is a product decision, not a
mechanical one, and it has to be squared with the compliance rule that Chive is
never an upload destination for blob data — an R2 bucket holding cached blobs is
a cache, but the line wants writing down before the code is wired.

Tracked as DEAD-3 in the 0.8.0 backlog, together with DEAD-2 (the blob-proxy
route that is injected everywhere and registered nowhere) and DEAD-4 (governance
PDS writing, gated on `GRAPH_PDS_*` variables that no configuration sets).

## Where gaps are tracked now

In the backlog, not here. A file like this drifts the moment something is fixed
without someone remembering to edit it, which is how its predecessors came to
describe a codebase that had moved on.
