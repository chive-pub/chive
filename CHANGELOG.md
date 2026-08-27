# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.0] - 2026-08-27

Third tranche of the 0.8.0 backlog remediation. The theme of this one is signals that were reporting something other than what was happening: tests that asserted nothing, a coverage number measured against a subset of itself, manifests nobody had ever built, and an audit log that had never returned a row.

### Security

- Anonymous rate limits cannot be bypassed by setting a header. `getClientIP` read the **first** `X-Forwarded-For` entry. That header is append-only — entries the client sent arrive first, and each proxy appends the address it saw — so the first entry is always a value the client wrote, and varying it per request gave every request a fresh window. It now counts back `TRUSTED_PROXY_COUNT` (default 1, matching Traefik) from the right, and discards the header entirely when it is shorter than the proxy chain rather than guessing. `X-Real-IP` and `CF-Connecting-IP` are gone as fallbacks for the same reason: single-value headers with no chain, indistinguishable from a client setting them.
- The rate-limit window is evaluated atomically. `redis.pipeline()` batches commands over the connection without making them atomic, so two concurrent requests could each read a count below the limit and each be admitted. `zadd` also ran unconditionally _before_ the check, so a client already over its limit kept writing entries: its window never drained, its `Retry-After` kept moving out, and the sorted set grew for as long as it kept knocking. Both are now one Lua script, with the write inside the admit branch. Verified against a real Redis: fifty concurrent requests against a limit of ten admit exactly ten.
- Only the account whose repository holds a record may alter or delete it. `deleteSubmission` and `updateSubmission` authorised anyone listed in the record's `authors[]` — an array written by whoever submitted the eprint, so a submitter could hand delete rights to an arbitrary DID by typing it in. The narrower rule is also the only coherent one for an AppView: ATProto forbids cross-repository writes, so a co-author cannot change the record itself, and letting them change Chive's copy would leave the index disagreeing with the PDS that owns it.
- A Content-Security-Policy is served on both sides. Neither had one, which is what let the stored-XSS hole fixed in 0.8.0 reach as far as it did. The API answers JSON only, so its policy is absolute. The frontend policy still carries `'unsafe-inline'` for scripts, because Next.js inlines its own bootstrap and removing it requires per-request nonces threaded through the app — that work is not done here. Everything else is enforced, closing the injection paths that do not require running script.
- `/ready` no longer publishes the internals of every datastore. Each failing check returned the driver's message verbatim — connection strings, hosts, ports, index names — from an endpoint that is unauthenticated, exempt from rate limiting, and reachable from the internet. The real error still reaches the log with its stack.
- The external-PDF proxy re-checks its allowlist at every redirect and bounds what it reads. The allowlist was checked once, on the URL the caller named, while `fetch` followed redirects itself, so an allowlisted host could redirect the request to an address inside the cluster and have Chive fetch it and return the body. Bodies are now read through a counting reader that abandons the stream past 50MB, so a server that lies about its `Content-Length` cannot exhaust memory.
- `DISABLE_RATE_LIMITING=true` is ignored in production. One stray environment variable removed every limit from a live deployment — the same shape as the end-to-end auth bypass fixed in 0.8.0, with a comment as its only guard.
- Administrative actions reach the audit log. Role grants wrote a Redis key; content deletions published to a channel with no subscriber. Neither reached `governance_audit_log`, so the two actions an admin audit log exists for were the two it could not show.

### Fixed

- **`pub.chive.admin.getAuditLog` failed on every call.** The query selected `g.target_did` and `g.ip_address`; neither column existed. A catch swallowed the error, returned an empty result, and logged that the _table_ was unavailable — so the endpoint reported an empty audit log forever and sent anyone investigating to look for a table that was there all along. A second, independent fault in the same method: the count query had no `g` alias while sharing a `WHERE` clause written against one, so any call filtering by actor failed as well. Both paths to a row were broken.
- **All three Kubernetes overlays failed `kubectl kustomize` outright** and had never been applicable to a cluster. Each declared a `configMapGenerator` with `behavior: merge` naming a ConfigMap present in no base, and the development overlay additionally used deprecated multi-document strategic-merge deletes. Nothing in CI built them, so nothing said so.
- Even rendering, the overlays pointed every pod at an address that did not resolve: service names were fully qualified into the `chive` namespace while each overlay deploys into its own, and `namePrefix` renamed every Service while the addresses in the ConfigMap stayed unprefixed. Addresses are now bare names, which resolve through the pod's search path; `namePrefix` is removed, since each overlay's namespace already isolates it and the prefix was what broke the names.
- Citation extraction was silently disabled on Kubernetes. There was no GROBID manifest anywhere, though docker-compose has always run one and the indexer skips extraction when `GROBID_URL` is unset — no failure, no log an operator would notice.
- **Three lexicon schema errors that `@ts-nocheck` had been hiding.** The generator prepended it to all 436 generated files, exempting the entire lexicon type surface from `tsc`. Removing it surfaced: `pub.chive.actor.profile` constraining `orcid` with a `pattern`, which the Lexicon spec does not define, so the field accepted any string; `pub.chive.eprint.submission` putting `default` on a ref, which the spec allows only on primitives, so a record omitting `publicationStatusSlug` got nothing rather than a preprint; and ten defs across `pub.chive.richtext.*` declaring `$type` themselves, producing a duplicate-identifier error in every file they touched.
- `pub.chive.graph.getCommunities` answers with an empty list on every request. 0.9.0 constructed the `graphAlgorithmCache` the handler reads, which was previously undefined; `GraphAlgorithmJob`, the only producer that writes into it, is still never constructed or scheduled. The endpoint is therefore served, successful, and empty. Not fixed here — scheduling the job or withdrawing the endpoint is a decision about whether community detection is a feature Chive offers.
- The PDS scanner backfilled a different set of collections than the firehose indexes. Its hard-coded list had drifted both ways: it scanned `pub.chive.review.entityLink`, which the event processor does not index, and omitted both `collaboration` collections — so a repository scan could never recover a co-author invitation the firehose had missed, which is the failure a backfill exists to fix.
- `pub.chive.eprint.tag` was in the indexed set, the event processor's dispatch and the scanner's, and there is no such lexicon anywhere. The record type is `pub.chive.eprint.userTag`. Listing the old name let `sync.indexRecord` accept a manual index request for a collection with no schema to validate against.
- An eprint's abstract could not be edited from the frontend. `useUpdateEprint` re-listed the twelve fields it forwarded while the lexicon accepts fourteen; `abstract` and `document` were missing, with no error and no type failure to show it. The hook now takes its parameter type from the lexicon and forwards whatever it is given.
- `toAtUri` rejected the project's own record types. Its collection pattern was lowercase-only, so every camelCase NSID failed — `pub.chive.eprint.userTag`, `pub.chive.graph.nodeProposal`, `pub.chive.collaboration.inviteAcceptance` among them. The record-key charset also widens to the spec's, which includes `:` and `~`.
- XRPC schema validation is no longer opt-in. The body parse and `validateXrpcInput` sat together inside the JSON content-type check, so sending any other content type skipped both: `input` stayed undefined and validation never ran. A method whose lexicon declares a JSON body is now rejected without one, and validation runs unconditionally.
- Endorsement pages can no longer be empty while claiming more results. `contributionType` was applied in the handler _after_ pagination, so a page could return nothing while `total`, `hasMore` and `cursor` described the unfiltered set. It is now applied in SQL, to both the count and the page.
- Seven collection handlers report an unconfigured feature instead of an empty one. Returning `[]` is indistinguishable from a genuine empty result: a client rendered "no collections", and a searcher was told the query found nothing when nothing had been searched.
- Every 500 is logged with the error that caused it. The request middleware passed a hardcoded `undefined` in the error slot, so server errors were recorded with a status and a duration and nothing else.
- 400s are logged and 404s are not logged as errors. The XRPC error handler branched on error class: `ValidationError` matched no branch, so every 400 went unlogged, while `NotFoundError` matched the generic branch and filled the error dashboards with routine misses. It now branches on the status the client receives, which cannot develop the same gap when a class is added.
- The metrics endpoint reports a failure instead of an empty registry. An empty catch around the `prom-client` import returned `metrics: []`, indistinguishable from a registry with nothing in it.
- Integration cards show "unavailable" rather than zero during an outage. GitHub, GitLab and Zenodo fetch failures produced zero-valued placeholders rendered exactly like real figures.
- The submission wizard keeps a draft. Nine steps of input — title, abstract, every author, fields, facets, funding — were discarded by a refresh, a back-navigation or a closed tab, with no way back. Files are deliberately not persisted, and the restore banner names what needs re-attaching.
- Canonical and Open Graph URLs come from the deployment origin. Every page staging served carried a canonical pointing at production.
- Four documented health endpoints did not exist, one of them inside a copy-pasteable Kubernetes probe snippet — following the documentation produced pods whose readiness probe could never pass.
- The test stack no longer reports success after a failed migration. It connected to a database the compose file does not create, discarded the error, and printed "✓ Migrations complete" regardless, leaving a running stack with no schema.
- `pnpm test:performance` invoked a script that has never existed in this repository, so the performance workflow failed on its first command every time and the four k6 scenarios that do exist had never run.
- The Docker `deps` stage copies `pnpm-workspace.yaml`, without which pnpm resolves as a single package against a workspace lockfile.
- `vitest.pre-deployment.config.ts` used `poolOptions.forks.singleFork`, which Vitest 4 removed. Nothing typechecked the config files, so the key sat there being ignored and the suite ran in parallel forks against shared state — exactly what the setting existed to prevent.

### Changed

- **Coverage is measured over all of `src/`.** The v8 provider counted only files a test imported, so a module with no test simply left the denominator: coverage could rise by deleting a test and fall by writing the first one for a large file. Measured properly, the same suite covers 46% of lines rather than the 70% reported, and the full suite 52% rather than 80%. Nothing got worse; the figure was always this. The thresholds are now a ratchet set just under the real numbers, and the 80% bar in CLAUDE.md remains the target rather than a description.
- **Twenty-four compliance tests whose body was `expect(true).toBe(true)`** now check what their titles claim, mostly by reading the source and asserting the absence of a repository write — a claim about absence, awkward to demonstrate by executing code and exact to check by reading it. Where source is the wrong instrument they read the real artifact: the OTEL collector manifest must hold no ClusterRole, every verb on Promtail's must be a read, alert rules must contain nothing credential-shaped.
- **The rebuildability rule has an executable test for the first time.** It replays a fixed firehose log through the real event processor against a real PostgreSQL index, snapshots it, deletes the index, replays the same log and requires the snapshots to match. The log contains an update and a delete, not only creates; the empty case is excluded; and the three columns normalised out are asserted to exist, so a rename cannot widen the exemption.
- The published OpenAPI specification is generated from the served one, and CI fails when they disagree. It was five months stale, missing fifteen handlers including the whole `com.atproto.repo` group and documenting six endpoints that no longer exist.
- REST endpoints honour the `auth` and `rateLimit` they declare, and all five HTTP methods the type admits. PUT, DELETE and PATCH were silently dropped — registered nowhere, a 404 at runtime with nothing said at startup.
- PDS endpoints resolve through the shared, cached `DIDResolver` rather than two hand-rolled `plc.directory` fetches with no cache and no timeout.
- The test suites default to the Docker test stack's database. The documented local flow failed at migration time with `role "chive" does not exist`, a message that points at authentication rather than at the database name responsible.
- CI skips build-tool installation when the compilers are already present (30–60s in every job, six times over) and keys the Turbo cache on the lockfile and branch rather than the commit SHA, which could never hit.
- Unit tests for the three modules that decide whether firehose events survive — the cursor manager, the event queue and the dead letter queue — and for the four on the trust boundary: the service-auth verifier, the DID verifier, and the OAuth state and session stores. None had a test. The verifier is the same file whose missing lexicon-method check was accepted for four months.

### Removed

- The OpenAPI type generation: a 648KB `schema.generated.ts` that nothing imported, was gitignored, and required a live server on port 3001 to produce — so CI could neither generate it nor notice it was missing, while contributors were told to run it after every API change.
- The dependencies and type interfaces the 0.9.0 second-factor removal left behind — `otplib`, `@otplib/*`, `@simplewebauthn/server`, and 720 lines of interfaces exported from the barrel and imported by nothing.
- The `vm2 → isolated-vm` pnpm override. `vm2` is not in the dependency tree, so it was inert — and actively harmful if a transitive dependency ever pulled it in, since the APIs are incompatible and a version conflict would have become a runtime crash.
- The second Redis client. `redis` was a production dependency used by one script while thirty modules use `ioredis`.
- Two exported builtin-plugin registries, neither referenced, each listing eight of twenty-eight plugins — and a different eight from the five `src/index.ts` actually instantiates.
- 1,350 lines of stub-implementation catalogues describing code that no longer exists, replaced by a note recording the one gap that is still real.

### Upgrade notes

1. **`TRUSTED_PROXY_COUNT` defaults to 1.** That matches every current deployment. A deployment behind a different number of proxies must set it, or anonymous rate limiting buckets all traffic under one key.
2. **`NEXT_PUBLIC_SITE_URL` should be set on staging.** It defaults to the production origin, which is the previous behaviour.
3. **One migration.** `1742000000000_admin-audit-log-columns` adds two nullable columns and widens a CHECK constraint. Its `down` deletes rows carrying the new actions before restoring the narrower constraint, so rolling back loses audit history.
4. **The lexicons need republishing** to the governance PDS. `scripts/publish-lexicons.ts --dry-run` reports seven changes against the live PDS: `pub.chive.actor.profile`, `pub.chive.discovery.settings`, `pub.chive.eprint.submission`, `pub.chive.richtext.defs` and `pub.chive.richtext.facets` updated; `pub.chive.actor.profileConfig` and `pub.chive.claiming.dismissSuggestion` created. Editing a lexicon file in this repository does not update the records the PDS serves.

## [0.9.0] - 2026-08-27

Second tranche of the 0.8.0 backlog remediation: fourteen further changes.

### Security

- Plugin loading refuses third-party code rather than importing it into the host process. `loadPlugin` dynamically imported `manifest.entrypoint`, where it ran with the service's full privileges — filesystem, network, and the database credentials in the environment — while the plugin interfaces described isolated-vm isolation and permission enforcement. Both `executeInSandbox` and `enforceNetworkAccess` are implemented and have zero call sites: no plugin code has ever run inside an isolate. Nothing called `loadPlugin`, so this was a trap rather than a live vulnerability, and it is now sprung loudly instead of left armed. `CHIVE_ALLOW_UNSANDBOXED_PLUGINS=true` overrides it, named for what it grants.
- The frontend no longer offers its end-to-end authentication bypass in a production build. Setting one `localStorage` key made the client send `X-E2E-Auth-Did`, which the API turns into an identity — and `X-E2E-Auth-Admin` into an administrative one — so a console one-liner on the live site was enough. The API stopped honouring those headers in 0.8.0, but a bypass that depends on the other side refusing it is not a control.

### Fixed

- `getCommunities` has a cache to read from. Two handlers read `services.graphAlgorithmCache`, which `ServerConfig` had no field for and nothing constructed, so it was always undefined and the endpoint returned an empty list on every request — while the graph algorithm job wrote precomputed results into the same cache that nothing read. **Corrected in 0.10.0:** this fixed the plumbing and not the supply. `GraphAlgorithmJob` is the only thing that writes into that cache and is still never constructed or scheduled, so the endpoint reads a cache nothing fills and returns an empty list — a well-formed, successful, empty answer instead of an undefined-service one. Saying it "returns data" was too strong.
- Endorsement views carry the record CID. Handlers returned the literal string `'placeholder'` for a field the lexicon marks required, with a comment claiming the CID was not stored; it has always been stored and the queries simply did not select it, so optimistic-concurrency writes were comparing against a constant that could never match.
- Seven fields the search mapper emits are mapped explicitly, as `nested` where they are arrays of objects. Elasticsearch inferred `object` for them, which flattens: a query for one funder's grant number matched across the whole array, so an eprint funded by A with grant X and B with grant Y matched a search for "A's grant Y". Wrong answers indistinguishable from right ones.
- Mapping changes can reach a live index. `bootstrapIndex` returns early when the alias exists, and the only path that applied a change deleted `eprints-v1` outright — full search downtime for the length of a reindex, no prompt, nothing to fall back to. `migrateIndexToCurrentMapping` builds the next index version, copies the documents, and moves the alias in a single atomic action; the previous index is kept, so the migration is reversible.
- The trending page is fetched in one query and its authors hydrated once. It issued a `getEprint` and a separate call to the public Bluesky appview per entry — 40 network round trips for 20 entries — and silently dropped authors past the first 25 of each eprint.
- KaTeX loads only when LaTeX is rendered. Roughly 280KB was imported at the top of the rich-text renderer, so browse, search, trending and author listings all shipped a typesetting library for content that rarely contains a formula.
- The Kubernetes manifests reference images that exist. They named bare `chive` and `chive-frontend`, which resolve against Docker Hub, while CI publishes to `ghcr.io/chive-pub/chive`; overlays set only `newTag`, never `newName`; and the base pinned `latest`, which CI does not produce. No environment could pull an image.

### Changed

- The XRPC method verb is resolved once, so the OpenAPI specification and the runtime router cannot disagree. They decided it from different sources, and because the frontend client is generated from the spec, a disagreement became a 404 at runtime rather than a build error.
- Profile lookups go through one cached hydrator. Handle, display name and avatar were fetched from the public Bluesky appview at fourteen call sites, two of them byte-identical private methods, none of them cached — so a page of reviews re-fetched the same authors on every request.
- The pre-deployment suite skips when the external services it verifies cannot be reached, rather than failing. That job is a required check, so a third-party outage previously blocked every merge in this repository however unrelated the change. A service that responds _incorrectly_ still fails the build; only unreachability skips, and the skip says loudly that nothing was verified.
- Every environment variable the code reads is documented — 75 of 103 were not. Three clusters are marked as inert rather than presented as working configuration: the R2/CDN variables select an adapter that is never chosen, the governance PDS writer is never constructed, and the SMTP path is never invoked.

### Removed

- The second-factor authentication layer: WebAuthn, TOTP and JWT session management, 2,334 lines plus a 688-line authentication service, and the two tables built for it. It was unreachable — no route, handler or service imported it, and credentials lived in Redis under TTLs rather than in those tables — so no user could enrol, because no endpoint existed to enrol through. Chive does not offer 2FA.
- `document_base64` from the search document, an implemented and tested path for putting a base64 document body into Elasticsearch, contradicting the rule that only BlobRefs are stored. Nothing populated it.
- The `repo:pub.chive.graph.fieldProposal` OAuth scope, for a record type renamed to node/edgeProposal that has no lexicon.

## [0.8.1] - 2026-08-26

### Security

- The Prometheus scrape endpoint is no longer reachable from the public internet. `/metrics` shipped in 0.8.0 unauthenticated by default, which is the usual arrangement for a metrics port on a private network — but Chive's API is fronted by two public Traefik routers, so on this deployment it was world-readable: request rates, per-endpoint latencies and error counts, and queue depths. It was serving 200 to anonymous requests after 0.8.0 deployed. Both public routes now deny the path at the edge, which holds whether or not `METRICS_TOKEN` is configured, and Prometheus scrapes the API directly over the compose network where it never traverses Traefik.

## [0.8.0] - 2026-08-25

Remediation sweep against the 0.8.0 backlog. Fourteen changes, each with tests
pinning the specific failure. A recurring shape runs through them: work that
ran, reported success, and had no effect — telemetry recording into an SDK that
was never started, metrics nothing could scrape, deletions announced to a
subscriber that was never written, precomputed graph results with no reader.

### Security

- Service auth tokens are verified against the method being called. A JWT's `lxm` claim scopes it to one lexicon method, and the verifier has always accepted a method to check against — the middleware passed none. The claim was decoded, copied into `user.scopes`, which nothing reads, and never enforced, so a token minted for `pub.chive.metrics.recordView` was accepted at `pub.chive.admin.deleteContent`. Any holder of any valid token could call any endpoint their roles allowed.
- PDS registration requires authentication and is bound to the caller's own identity. The handler was `auth: 'optional'`, and a registered host is later enumerated by the scanner, which indexes whatever repos that host claims to hold. The ownership check resolves the caller's DID document and fails open when resolution is inconclusive, which is recorded rather than hidden.
- Server-side request forgery through PDS registration and `did:web` resolution is blocked. Both fetched caller-supplied hosts with no scheme allowlist, no private-address block and no redirect cap, reaching cloud metadata at `169.254.169.254`, loopback and RFC 1918 services. Every resolved address is checked, not just the hostname, and redirects are refused.
- The E2E authentication bypass cannot be enabled in production. `X-E2E-Auth-Did` supplies an identity and `X-E2E-Auth-Admin: true` grants administrative access, with both header names in the production CORS allowlist; an unset environment variable was the only thing between a deploy and an open admin door. It is now gated on `NODE_ENV` as well, and the process refuses to start if the flag is set in production.
- Stored cross-site scripting through JSON-LD is closed. The Schema.org payload is rendered with `dangerouslySetInnerHTML` and carries eprint titles, abstracts and author names taken from user-controlled PDS records; `JSON.stringify` does not escape `<`, so a title containing `</script>` closed the element and everything after it parsed as markup.
- CodeQL, a dependency audit and a Trivy filesystem scan now run on every pull request and weekly. The repository had no scanning of any kind despite the architecture overview describing some. CodeQL gates; the dependency audit reports without failing, because the tree carries 343 known advisories (8 critical, 141 high) and a gate nobody can satisfy is one that gets disabled. Dependabot opens the update pull requests.

### Fixed

- `/ready` reports the state of its dependencies. Each probe was raced against a timeout with `.catch(() => undefined)` applied to the racer, so a dependency refusing connections rejected fast, resolved to `undefined`, and was recorded as passing. The endpoint answered 200 with PostgreSQL, Elasticsearch or Neo4j down, and Kubernetes kept routing to the pod. Only a probe that hung past the timeout could ever trip it.
- The admin full reindex no longer destroys indexed fields. It rebuilt each search document from a hand-rolled nine-field projection, and Elasticsearch replaces whole documents rather than merging, so DOIs, publication status, external identifiers, funding, repositories, related works, supplementary materials, licence and document metadata were wiped from every eprint the reindex touched. It now uses the same mapper as the reindex script. Facets remain empty, because they live on the PDS record and not in the index.
- Records deleted from their PDS are removed from the index. The freshness worker emitted `record.deletion_detected` and returned success; no subscriber to that event was ever written, so the scan reported a deletion and deleted nothing. `PDSSyncService.markAsDeleted` was already among the worker's own dependencies.
- Telemetry is started. `initTelemetry` was referenced only in its own documentation, so the OpenTelemetry SDK never initialised, every `withSpan` executed its callback recording nothing, and no OTLP export happened. Both the API and the firehose indexer start it, since they are separate processes.
- Request rate, latency and error metrics exist and can be scraped. The counter and histogram had no emission site — the middleware computed status and duration and only logged them — and the only exposure was an admin-authenticated XRPC method returning JSON, which Prometheus can neither authenticate against nor parse. `GET /metrics` now serves the exposition format, exempt from rate limiting, with optional bearer-token protection.
- Cancelling a long-running admin operation cancels it. `startOperation` returns an `AbortSignal` that all seven trigger handlers discarded, so `cancelBackfill` flipped the operation's state in Redis while the loop ran to completion. The four handlers driving a loop locally now honour it, including both loops of the reindex and citation extraction.
- Soft-deleted eprints no longer appear in author profiles, the counts beside them, field browse, or tag and keyword browse. The partial index the soft-delete migration created for exactly this filter was never used by any read path. The tag lookup needed a join rather than a predicate, since a tag row carries only the eprint URI.
- Eprint deletion is reversible and reconcilable. It hard-deleted the PostgreSQL row and then removed the Elasticsearch document best-effort; when that failed the row was already gone, so nothing recorded that a document still needed removing and no sweep could find it. Deletion now marks the row, and `reconcileDeletedFromSearch` re-issues the removal.
- A verified ORCID iD survives indexing. Verification wrote only to `authors_index`, which is rebuilt from the firehose, and both profile upserts assigned `orcid` straight from the incoming record — so a verified value was overwritten, usually with null, on the next profile update. An author who verified before being indexed lost it outright. Verification is now stored in its own table and seeded into new rows.
- The child-facet hierarchy resolves. `getChildFacets` asked Cypher for `*1..$maxDepth`; a parameter is not accepted as a variable-length bound, so the query was a syntax error and the method threw on every call.
- Recommendation and collaboration queries match the labels the write side creates. Fields are created as `(:Node:Field)` and were read as `(:FieldNode)`; authors are created as `(:Node:Object:Person)` keyed on `metadata.did` and were read as `(:Author {did})`, so collaboration strength was null for every pair of authors who had in fact collaborated. Cypher returns no rows for a label that matches nothing, so both read as "no data yet". Interest-based paths remain empty: nothing creates `INTERESTED_IN` at all.
- Precomputed community and trending results have somewhere to be read from. Two handlers looked for `services.graphAlgorithmCache`, which `ServerConfig` had no field for and nothing constructed, so `getCommunities` returned an empty list on every request while the graph algorithm job wrote results nobody read. **Corrected in 0.10.0:** the cache was wired up in 0.9.0, not here, and `GraphAlgorithmJob` still runs nowhere, so `getCommunities` remains empty. Both this entry and 0.9.0's claimed more than was done.
- Trending pagination advances. The cursor was parsed only to build the next cursor and never passed to either data source, so every page returned the same entries while the cursor climbed.
- The ORCID verification flow resolves. The callback is registered at `/v1/auth/orcid/callback` while the default redirect URI pointed at `/api/v1/...`, a prefix only one Traefik router strips.
- Methods declared as procedures are served on POST. The router ignored a handler's `type` when no lexicon was registered, so a `procedure` was mounted as GET and its POST callers received 404. `pub.chive.claiming.dismissSuggestion`, the concrete victim, also gains the lexicon it never had.
- Author autocomplete issues one query per page instead of one per hit — up to 75 sequential round trips per keystroke — and faceted browse one query per facet instead of one per edge.
- Search is billed against the relaxed rate-limit tier. The autocomplete list named `pub.chive.search.searchSubmissions`, a method that does not exist; the real NSID is `pub.chive.eprint.searchSubmissions`, so search never matched and every anonymous request took the low tier.
- Endorsement views carry the record CID. Handlers returned the literal string `'placeholder'` for a field the lexicon marks required, with a comment claiming the CID was not stored — it has always been stored, and the queries simply did not select it. Optimistic-concurrency writes were comparing against a constant that could never match.
- The WhiteWind backlink plugin tracks `com.whtwnd.blog.entry`, the collection that exists. It subscribed to `com.whitewind.blog.entry` and so could never have matched a post.
- The governance PDS DID is validated at load. Every environment file set `did:plc:chive-governance`, which is not a PLC identifier, overriding the correct default — so the governance sync resolved nothing and imported an empty graph. An ill-formed value now fails startup rather than being carried.
- Thread loads no longer scan the whole review table. `parent_comment` carries a foreign key with no index, and PostgreSQL does not index foreign keys automatically.
- A second paper login within five minutes no longer hangs. The popup's poll interval and timeout lived only in the promise closure, so the success path could not clear them and a stale timeout closed the next attempt's popup, leaving its promise unsettled.

### Changed

- Manual reindex accepts every collection the firehose indexes. Three lists described "the collections we index" and disagreed; `sync.indexRecord` accepted 13 while the event processor handled 20, so seven were unrecoverable by manual reindex — `pub.chive.graph.edgeProposal` among them. One list now serves both, derived from the event processor's own dispatch and asserted by test.
- The scheduled health check probes `/ready` as well as `/api/health`. The latter is a static 200 that reports nothing about dependencies, so a datastore outage was invisible to monitoring.
- `pnpm test` runs the backend suite. The root package is not a workspace member, so `turbo test` reached only the frontend and the command exited zero having run none of the 4,000-plus backend tests.
- The developer test stack no longer collides with production containers, and the deploy sweep excludes it. Both used `chive-` names — `chive-grobid` identically — and `docker ps --filter "name=chive-"` matched the test stack, so a deploy could delete it mid-run.
- Frontend coverage is measured and enforced. The config declared no thresholds and CI ran the suite without `--coverage`, so the stated 70% bar was unenforced end to end; the real figure is 41%. Thresholds are set just below current levels as a ratchet, and both configs now record the gap to the documented bar rather than a bare TODO.
- Every environment variable the code reads is documented — 75 of 103 were not. Three clusters are marked as inert rather than presented as working configuration: the R2/CDN variables select an adapter that is never chosen, the governance PDS writer is never constructed, and the SMTP path is never invoked.
- The XRPC method verb is resolved once, so the OpenAPI specification and the router cannot disagree and generate a client for a verb the server does not serve.

### Removed

- The second-factor authentication layer. WebAuthn, TOTP and JWT session management — 2,334 lines plus a 688-line authentication service — were unreachable: no route, handler or service imported them, and credentials were held in Redis under TTLs rather than in the tables built for them. No user could enrol, because no endpoint existed. Chive does not offer 2FA; the code and its two tables are gone rather than completed.
- `document_base64` from the search document. It carried a base64 document body into Elasticsearch — implemented, typed and tested — which contradicts the rule that only BlobRefs are stored. Nothing populated it.
- The `repo:pub.chive.graph.fieldProposal` scope, for a record type renamed to node/edgeProposal that has no lexicon.

## [0.7.1] - 2026-08-24

### Fixed

- Node subkinds are validated before being interpolated into Cypher. `subkindToLabel` only capitalised the hyphen-separated parts, so parentheses, whitespace and comment markers passed into `MATCH (n:Node:<label>)` unaltered, and `subkind` is caller-supplied on the unauthenticated `pub.chive.graph.listNodes` and `pub.chive.graph.getHierarchy`. The helper was also duplicated, unguarded, across two files feeding nine interpolation sites; both now route through `src/storage/neo4j/labels.ts`, which rejects anything that is not a plain identifier.
- Proposals resolve by record key, so proposal detail pages and votes load. `getProposalById` cast whatever identifier it received to an `AtUri` and matched on `uri`, while every route and list link carries the record key — a value that never equals a full AT-URI. No proposal page could load and `getUserVote` failed identically. `IGraphDatabase` gains `getProposalByRkey`, which falls back to the URI suffix so proposals indexed before the record key was persisted resolve without a migration. Closes #89.
- `pub.chive.governance.listVotes` returns the votes on a proposal. It synthesised `at://chive.governance/pub.chive.graph.fieldProposal/<id>` — an authority that is not a DID, and a collection that does not exist — so it matched no vote and always returned an empty list.
- New proposals are indexed immediately through `pub.chive.sync.indexRecord`, as every other user write already was. `pub.chive.graph.nodeProposal` and `pub.chive.graph.vote` were not accepted by that endpoint, so a proposal was only readable once the firehose delivered it.
- The governance sync no longer clears the knowledge graph before it has the records to replace it with. An undefined `GRAPH_PDS_DID` repository variable interpolated to an empty string, which overrode the correct built-in default and failed every request with `Params must have the property "repo"` — after the graph had already been wiped. Deploys therefore left Neo4j empty, and the eprint reindex that followed resolved every field label to a raw UUID.
- Field labels survive a reindex that cannot reach the knowledge graph. `resolveFieldLabels` returns the original UUID when Neo4j has no matching node and swallows the error that caused it, so a racing or failed lookup overwrote correct labels. The reindex now waits briefly for the graph to populate and preserves the label already stored in PostgreSQL rather than downgrading it.
- The field label resolution job mirrors repairs into Elasticsearch. It only ever wrote to PostgreSQL, while browse and search read from the search index, so repaired labels never reached the UI.
- The PDS scanner can reach relay-connected servers. `getPDSesForScan` required `is_relay_connected = FALSE` and every registered PDS is relay-connected, so the scheduler ran every 15 minutes and scanned nothing. Records from those servers normally arrive over the firehose, but a relay outage longer than the relay's backfill window skips events permanently, and this scan is the only mechanism that can find them. They are now ranked last rather than excluded.
- A PDS wedged in `scanning` by a crashed scan is reclaimed after an hour. Nothing cleared that status and it was absent from the selection query, so such a server was excluded from every future cycle.
- Backend services report their real release version. `npm_package_version` is unset when a container starts Node directly, so `/health`, structured logs and OpenTelemetry resources reported `0.0.0` in every deployed environment.

### Changed

- The production deploy no longer re-injects database credentials into the reindex and governance sync steps, using the container's own environment instead. Re-interpolating them risked drift from the values the running service uses, and an undefined variable silently overrode a correct default.
- A failed Elasticsearch reindex or governance sync now fails the deploy instead of emitting a warning and reporting success.

## [0.7.0] - 2026-08-24

### Added

- Firehose consumer reconnects indefinitely with capped backoff and a WebSocket keepalive heartbeat, so a relay outage or a half-open socket can no longer wedge ingestion permanently. A single relay `503` on 2026-05-18 killed the production consumer for three weeks without surfacing anywhere.
- Indexer health endpoint on `INDEXER_HEALTH_PORT` (default 3001) reporting per-relay connection state, with a watchdog that exits the process when the consumer stays unhealthy past its tolerance. The container healthcheck probes it instead of running `true`.
- `scripts/publish-lexicons.ts` publishes the `pub.chive.*` lexicon schemas idempotently, so permission-set edits reach the PDS that resolves them.

### Changed

- The lexicon publisher targets the dedicated lexicon account on the governance PDS (`lexicons.governance.chive.pub`) rather than the `chive.pub` Bluesky bot account, which exists only for posts. `LEXICON_PDS_URL` and `LEXICON_PUBLISH_IDENTIFIER` still override both.
- `transition:generic` is no longer requested anywhere. Scope resolution fails closed to the ATProto base scope when session scopes are unavailable, leaving authorization entirely on the `pub.chive.*` permission sets. Existing sessions keep their old scopes, so users must re-authenticate.

### Fixed

- Deleting an eprint removes it from Chive's index immediately rather than waiting on the firehose, and the frontend deletes the dual-written `site.standard.document` records alongside it.
- The deploy's Elasticsearch reindex prunes eprints that are gone from their PDS instead of failing on orphaned index rows, which had made the production deploy unrunnable.
- Backend services report their real release version. `npm_package_version` is unset when a container starts Node directly, so `/health`, structured logs, and OpenTelemetry resources had all reported `0.0.0` in every deployed environment.

## [0.6.3] - 2026-05-12

### Fixed

- OAuth permission sets now grant the rpc lexicons backing ORCID verification, admin endpoints, claiming flows, and profile-config writes. Production had been silently rejecting every `getServiceAuthToken` call since 0.6.0 dropped `transition:generic` without enumerating the rpc grants the corresponding lxm need. Closes #85.
- Resolved the audience-format contradiction between `@atproto/oauth-scopes` (whose `isAtprotoAudience` validator requires `<did>#fragment`) and `com.atproto.server.getServiceAuth` (whose lexicon rejects an `aud` containing a fragment) by setting `aud: "*"` on the rpc permissions inside the four `pub.chive.{basicReader,authorAccess,reviewerAccess,fullAccess}` permission-set lexicons. Frontend now requests `getServiceAuth` with the plain DID and matches the wildcard rpc grant at the PDS.
- Retry `com.atproto.server.getServiceAuth` once when the user's PDS responds with `use_dpop_nonce`. The OAuth client's auto-retry occasionally leaks the nonce-mismatch error through to caller code on the first request against a previously-unseen origin; the explicit retry consumes the freshly-issued `DPoP-Nonce` header on the second attempt.

### Changed

- Bumped `@atproto/oauth-client-browser` from 0.3.37 to 0.3.42 to pick up DPoP-handling fixes from `@atproto/oauth-client` 0.5.12–0.6.1.
- Production now emits `include:pub.chive.*` permission-set references instead of individual `repo:pub.chive.*` scopes (`NEXT_PUBLIC_USE_PERMISSION_SETS=true`). The consent screen shows one named entry per Chive permission set rather than one row per collection.

## [0.6.2] - 2026-05-07

### Added

- Hybrid OAuth scope layout: client metadata now emits `include:` scopes for cooperating apps that publish a covering permission-set lexicon (Margin's `at.margin.authFull`, Standard.site's `site.standard.authFull`, Semble's `network.cosmik.authFull`), and falls back to individual `repo:` scopes only for gaps Semble's authFull omits (`network.cosmik.connection`, `network.cosmik.follow`) and for Bluesky (which publishes no covering set). Collapses the consent screen from a wall of opaque collection names to one named entry per cooperating app, each with publisher-authored title and detail copy.

### Changed

- Renamed Chive's permission-set lexicons from `pub.chive.auth.{basicReader,authorAccess,reviewerAccess,fullAccess}` to `pub.chive.{basicReader,authorAccess,reviewerAccess,fullAccess}`. ATProto's `IncludeScope.isAllowedPermission` only honors `lxm`/`collection` references that share the permission set's group prefix (everything up to its last dot). The four-segment names had a group prefix of `pub.chive.auth.` and silently dropped every referenced collection; the three-segment names authorize the full `pub.chive.*` namespace, matching Bluesky's `chat.bsky.authFullChatClient` precedent. Permission set records now live in `lexicons/permission-sets/` (excluded from `@atproto/lex-cli` codegen, which can't generate types for `permission-set` definitions).
- Conformed Chive's Margin dual-write to Margin's actual published lexicons: a single `at.margin.note` collection (W3C Web Annotation Data Model) with the `motivation` field distinguishing comment, highlight, and bookmark. Replaces the Chive-fictional `at.margin.annotation` and `at.margin.bookmark` collections that Margin's AppView never indexed. `MarginAnnotationsPlugin`, `MarginHighlightsPlugin`, and `MarginBookmarksPlugin` consolidated into a single `MarginNotesPlugin`. The `record-creator.ts` `MarginAnnotation*` types/functions renamed to `MarginNote*`; `createMarginBookmark` / `deleteMarginBookmark` collapse to thin wrappers that forward to the note machinery with `motivation: 'bookmarking'`.
- Lead permission-set detail strings with eprints (the primary Chive use case) instead of knowledge-graph governance.
- Owner-private collection reads in the dashboard hooks (`useMyCollections`, `useCollection`, `useCollectionsContaining`, `useSubcollections`, `useParentCollection`, `useCollectionFeed`) now use the authenticated client. The owner-side visibility filter on `pub.chive.collection.listByOwner` and friends gates `unlisted` collections to the authenticated owner; the unauthenticated client masked the viewer as anonymous and hid their own collections after reload.
- `pub.chive.collaboration.listInvites` now requires authentication and rejects queries that aren't scoped to the caller (`invitee = me`, `inviter = me`, or `subjectUri` authored by me). Closes an enumeration gap.

### Fixed

- "Created a new community/collection but it disappears on reload" (#79) for users who picked the `unlisted` visibility option in the wizard.

## [0.6.1] - 2026-05-04

### Added

- `NEXT_PUBLIC_USE_PERMISSION_SETS` build-time env var. When set, both client metadata and the OAuth login request emit `include:pub.chive.auth.*` permission-set references instead of individual `repo:pub.chive.*` scopes. Staging ships with the flag on so we can validate the permission-set flow against the now-live `_lexicon.<sub>.chive.pub` DNS TXT records.

### Changed

- Handle resolution falls back to the public Bluesky AppView's `com.atproto.identity.resolveHandle` XRPC when DNS-over-HTTPS returns no record. Direct browser fetches of `https://<handle>/.well-known/atproto-did` are blocked by CORS in nearly every case (most identity-publishing servers don't set `Access-Control-Allow-Origin`); the AppView runs both ATProto resolution methods server-side and serves a permissive CORS policy. Unblocks Eurosky users (`luismmontilla.com` and similar) who publish identity only via the HTTPS path.
- OAuth client metadata `logo_uri` now points at `/chive-logo.svg` (was pointing at `/logo.png` which 404'd), so the consent screen header renders the Chive logo instead of a generic placeholder.

### Fixed

- "Failed to resolve identity: <handle>" sign-in error for users whose handle is published only via `.well-known/atproto-did` rather than a DNS TXT record.

## [0.6.0] - 2026-04-24

### Added

#### ATProto Granular Scopes

- Individual `repo:pub.chive.*` scopes for all 22 Chive collections (eprint, actor, review, annotation, graph, discovery, collaboration namespaces)
- External cross-post scopes for `app.bsky.*`, `network.cosmik.*`, `at.margin.*`, and `site.standard.*` collections
- Permission-set lexicon schemas at `pub.chive.auth.{basicReader,authorAccess,reviewerAccess,fullAccess}` (served but not yet requested in the OAuth flow)
- `did:web:chive.pub` DID document at `/.well-known/did.json`, host-aware for staging vs production
- Minimal `com.atproto.repo.*` XRPC surface (`getRecord`, `listRecords`, `describeRepo`) that serves Chive's 219 lexicon JSON files as `com.atproto.lexicon.schema` records with real DAG-CBOR CIDs, enabling NSID resolution for any ATProto service

#### Collaboration

- `pub.chive.collaboration.invite` and `pub.chive.collaboration.inviteAcceptance` lexicons
- `CollaborationService` with full invite/acceptance lifecycle
- Firehose indexing and XRPC endpoints for collaboration records
- Collaboration invite flow in the submission wizard
- Invitations inbox page for pending invites
- `DidAutocompleteInput` component for collaborator selection (replaces raw DID text input)

#### Semble / Cosmik Integration

- Knowledge-graph-based Cosmik connection-type mapping
- Firehose plugin bridge for cross-AppView sync
- `syncEdgeToCosmik` wired through all edge paths
- Repair-mirror UI for fixing out-of-sync edges
- Enriched Cosmik card metadata (DOI, author, description, publishedDate, externalIds)
- Semble badge on relation-type autocomplete suggestions
- `pub.chive.*` lexicons and XRPC handlers for follow count, follow status, and Margin annotations

#### External Identifiers

- Canonical external-ID routes (`/doi/<id>`, `/arxiv/<id>`, `/orcid/<id>`, `/ror/<id>`, `/isbn/<id>`, `/pmid/<id>`, `/wikidata/<id>`)
- Zotero/Citoid-compatible server metadata endpoint

### Changed

- OAuth client metadata no longer declares `transition:generic` — the legacy scope short-circuited granular permissions and caused consent screens to display "any public record" instead of Chive's specific collections
- OAuth login requests use individual `repo:` scopes instead of `include:pub.chive.auth.fullAccess` references, because bsky.social cannot resolve permission-set lexicons until the DNS TXT records at `_lexicon.<sub>.chive.pub` are live
- User profile is now fetched from the public Bluesky AppView (`public.api.bsky.app`) rather than through the authenticated session, so avatars and handles resolve correctly under granular scopes (session-bound `agent.getProfile()` returns 403 without an explicit `rpc:app.bsky.actor.getProfile` grant)
- Container log rotation enabled across all services (JSON logs capped at 150 MB per container) to prevent unbounded disk growth
- Cosmik dual-write edges now emit HTTP URLs and resolve connection types through the AppView

### Fixed

- Wikidata URLs for properties use the `Property:` prefix
- Collaborators column migration no longer trips on dollar-quoting
- Plugin DI dependencies registered in the indexer entry point so the plugin manager can resolve `ILogger`
- Deploy App workflow no longer wipes `chive-docs` after a concurrent Deploy Docs (new step restores the container from `docker-compose.docs.yml` if a build exists)
- React hook placement and `useCurrentUser` destructuring errors
- Compliance test expected index/table counts updated for new collaboration tables

### Security

- Granular OAuth scopes limit Chive to writing only to its declared `pub.chive.*` collections plus the explicit external cross-post targets, instead of the blanket write access granted by `transition:generic`

## [0.5.1] - 2026-03-30

### Fixed

- Docs deploy workflow missing `environment: production` for secret access
- Rate limits too low for SPA usage patterns (Traefik raised to 2000 avg / 500 burst, backend authenticated raised to 1200 req/min)

## [0.5.0] - 2026-03-28

### Added

#### Open Alpha

- Public landing page with inline ATProto login and open alpha notice
- Bug report button in site header and mobile nav with pre-filled GitHub issue URL
- Open alpha banner for authenticated users (dismissable, localStorage-persisted)
- Onboarding prompt banner for new users to link academic accounts (auto-dismisses when ORCID is linked)
- Permanent redirects from `/apply` and `/pending` to `/`

#### Content Reporting

- `pub.chive.moderation.createReport` XRPC endpoint for user-submitted content reports
- `content_reports` database table with migration
- `ContentReportService` with atomic upsert, pagination, and admin review methods
- Report dialog on eprint detail pages with reason categories and description (2000 char limit)
- Lexicon schema for moderation createReport

#### ORCID OAuth Verification

- ORCID OAuth 2.0 authorization code flow for verifying researcher identity
- `pub.chive.author.initiateOrcidVerification` XRPC endpoint generating state and returning ORCID authorize URL
- `/api/v1/auth/orcid/callback` REST handler for token exchange
- `orcid_verified_at` column on `authors_index` for tracking verification status
- `orcidVerified` boolean field in `pub.chive.author.getProfile` response
- "Sign in with ORCID" button in onboarding wizard (replaces "Coming soon" placeholder)
- "Verify with ORCID" button in profile settings form
- Verified badge (ShieldCheck icon) on `OrcidBadge` component for OAuth-verified ORCIDs
- Popup-based OAuth flow with localStorage event fallback for cross-origin communication
- Writes verified ORCID to user's PDS profile record after OAuth completion
- Graceful fallback to "Coming soon" when ORCID OAuth credentials are not configured
- ORCID credentials wired into staging and production deploy workflows

### Changed

- All user-facing Bluesky references replaced with ATProto in login form, login dialog, and handle input
- Landing page restored to inline login style with ATProto handle input
- ConditionalHeader only hides on `/login` (was also hiding `/`, `/apply`, `/pending`)
- OAuth callback redirects to `/dashboard` directly instead of `/`

### Removed

- Alpha gate (`AlphaGate` component) removed from all 16 layout/page files
- Alpha application system: frontend components, hooks, pages, admin pages, scripts, E2E tests
- Alpha XRPC handlers (`pub.chive.alpha.apply`, `pub.chive.alpha.checkStatus`)
- Alpha admin handlers and lexicon schemas
- `AlphaApplicationService` and `requireAlphaTester` middleware
- Alpha type re-exports from `web/lib/api/schema.ts`

### Fixed

- Open redirect vulnerability in login page redirect parameter
- localStorage SSR safety guards in banner components
- Stale alpha references in admin nav, coming-soon page, and OAuth callback

### Security

- Login redirect parameter validated to prevent open redirects (blocks `//evil.com` and `https://...`)
- AT-URI and NSID format validation on content report submissions
- Description length limit (2000 chars) enforced on frontend and backend for content reports
- ORCID client secret kept server-side only; state parameter is crypto-random, single-use, Redis-backed with TTL

## [0.4.1] - 2026-03-19

### Fixed

- `pub.chive.eprint.listCitations` returned 500 when a citation carried structured author objects. Authors are formatted as strings, as the lexicon requires.

## [0.4.0] - 2026-03-18

### Added

#### Lexicon Versioning

- ATProto-standard `revision` field on all lexicon files and `schemaRevision` on record-type lexicons
- Central `lexicons/manifest.json` registry tracking revision, project version, and change date for every lexicon
- `lexicons/VERSIONING.md` documenting the versioning strategy, changelog, and migration table

#### Record Migration Service

- Backend migration service (`src/services/migration/`) that transforms old-format PDS records at index time
- Migration 0001: convert abstract string to rich text array, add titleRich for LaTeX titles, add license URI from slug mapping (submission rev 1 to 2)
- Migration 0002: replace flat `department` field on affiliations with recursive `children` tree (submission rev 2 to 3, profile rev 1 to 2)
- Migration chaining so records at any prior revision are brought up to current in a single pass

### Changed

#### Affiliations

- Replace flat `department` field with recursive tree structure (`children` array) supporting arbitrary institutional hierarchies (university, school, department, lab, etc.)
- Define canonical `pub.chive.defs#affiliation` shared type with `name`, `institutionUri`, `rorId`, and `children`
- All lexicons now reference the shared affiliation type via cross-lexicon ref instead of local definitions
- Each level in the affiliation tree can independently link to a knowledge graph node via `institutionUri`
- Eprint cards display only the top-level institution name; full hierarchy shown in author detail views

### Fixed

#### Admin

- Alpha dashboard returning 500 because `affiliations` and `researchKeywords` lexicon schemas defined items as strings but actual data contains objects

#### Frontend

- `institutionUri` dropped from affiliations in eprint card, edit sections, submission wizard Zod schemas, and sub-unit editing
- Profile record creator missing `institutionUri` and `children` fields, silently stripping tree structure on profile save
- Eprint submission Zod schema missing `institutionUri`, stripping institution graph links on submit

## [0.3.1] - 2026-03-11

### Fixed

#### Frontend

- Eprint card abstracts not rendering when API returns plain text string instead of rich text array (eprints page, field pages)

#### API

- Browse page missing author avatars because `browseFaceted` handler did not fetch profiles from Bluesky API

## [0.3.0] - 2026-03-10

### Added

#### Authors Page and Mute Feature

- Personalized authors page showing authors the user follows or has interacted with
- Mute author feature allowing users to hide papers from specific authors in feeds and discovery
- `pub.chive.actor.mute` lexicon record type for storing mute preferences in user PDSes

#### Discovery

- Configurable discovery weight settings allowing users to tune recommendation signal strengths (field affinity, citation overlap, recency, collaborative filtering)
- XRPC array parameter parsing for multi-value query parameters

#### Deployment

- GHCR image registry for CI-built Docker images, eliminating on-server builds during staging deploys
- Staging docs container added to CI/CD pipeline

### Changed

#### Types

- Consolidated rich text `$type` references to use `pub.chive.richtext.defs` namespace across all tests, lexicons, and frontend code
- Replaced `EprintsByAuthorResponse` with `ListByAuthorResponse` from generated types in `use-eprint.ts`
- Replaced `EprintChangelogsResponse` with `ListChangelogsOutput` from generated types in `use-eprint-mutations.ts`
- Replaced manual `Backlink`, `BacklinkCounts`, and `ListBacklinksResponse` with generated types in `use-backlinks.ts`
- Added backlink and changelog type re-exports to `schema.ts` from generated lexicon types
- Replaced `EdgesResponse` in `use-edges.ts` with generated `OutputSchema` from `pub.chive.graph.listEdges`
- Replaced `AuthorEprintsResponse` in `use-author.ts` with `ListByAuthorResponse` from generated types
- Derived `ProposalStatus` and `ProposalType` from generated `ProposalView` instead of manual string unions
- Derived `VoteAction` from generated `VoteView['vote']` instead of manual string union
- Derived `AlphaSector` and `AlphaCareerStage` from generated `alpha/apply` `InputSchema` instead of manual string unions

#### Frontend

- Comprehensive mobile responsiveness overhaul across the entire frontend
- Dashboard, admin, and governance sidebars collapse into Sheet drawers on mobile instead of stacking above content
- Mobile hamburger menu now includes dashboard navigation items for authenticated users
- Mobile search access via dedicated search icon button that opens a top Sheet
- Admin tables wrapped in horizontal scroll containers to prevent page overflow on narrow screens
- Grid layouts use progressive responsive breakpoints (`sm:grid-cols-2 md:grid-cols-3`) instead of jumping directly to multi-column
- Tab lists hide scrollbars for cleaner horizontal scrolling on mobile
- Popover widths constrained to viewport with `max-w-[calc(100vw-2rem)]`
- PDF viewer minimum height reduced on mobile (`min-h-[400px] md:min-h-[600px]`)
- New `useIsMobile` hook and shadcn Sheet component for consistent mobile patterns

#### Types

- Replace redundant annotation hook types (`AnnotationView`, `EntityLinkView`, `ListAnnotationsResponse`, `AnnotationThread`) with generated lexicon types from `pub.chive.annotation`
- Replace `ListUserEndorsementsResponse` with generated `OutputSchema` from `pub.chive.endorsement.listForUser`
- Derive `AnnotationMotivation` from generated `AnnotationView['motivation']` instead of manual string union
- Derive `ContributionType` from generated `EndorsementView['contributions'][number]` instead of manual string union

#### Discovery

- Related papers scoring: lowered combined score threshold from 0.2 to 0.05, reduced ES MLT discount from 0.6 to 0.85, and added author overlap to default signals
- Removed For You feed in favor of configurable discovery weights

#### API Validation

- Enabled server-side XRPC output validation (`validateOutput: true`) to catch schema mismatches at the source before responses reach clients

### Fixed

#### API

- `getHierarchy` handler missing default `relationSlug` value, causing 500 when output validation is enabled
- Authors page only showing search box instead of author grid due to incorrect conditional rendering

#### Tests

- Eprint integration tests failing due to stale PostgreSQL data from prior runs; added `beforeEach` cleanup

#### Admin Dashboard

- Field name mismatches between admin API responses and frontend expectations
- Role name references corrected from `moderator` to `admin` across admin endpoints
- Silent auth failures in admin routes now surface proper error messages

#### Authentication

- Paper PDS auth wired through all edit and delete flows, fixing unauthorized errors when modifying papers
- Unified auth error messages across all endpoints for consistent error handling

#### Frontend

- Removed broken "View all related papers" link pointing to nonexistent page
- Flaky mention-popover arrow key navigation test stabilized by replacing `fireEvent.keyDown` with `userEvent.keyboard`

#### Deployment

- Staging deploy workflow now builds web frontend image in CI and pins both API and web images to the exact commit SHA, preventing frontend-backend version skew
- Production deploy fixed to build web image with `docker build` instead of silent no-op `docker compose build` (compose file had no `build:` section for chive-web)
- Split Docker build and push steps to fix GHCR authentication failure
- Test expectations updated to match unified auth error messages
- Discovery test expectations updated for new default weights and weight normalization

## [0.2.0] - 2026-03-06

### Added

#### Admin Dashboard

- Admin dashboard with 15 pages: overview, health, alpha access, users, content, firehose, backfill, PDS, graph, metrics, search analytics, activity, endpoints, runtime, and governance
- AdminService for aggregating system health, content statistics, and user management operations
- BackfillManager for triggering and monitoring PDS record backfills from the admin UI
- XRPC handlers for all admin dashboard endpoints across health, content, users, firehose, PDS, graph, metrics, search, activity, and governance
- Frontend admin auth guard component that restricts dashboard access to users with admin roles
- Role-based access hooks (`useMyRoles`, `useIsAdmin`) and admin dashboard query hooks
- Admin role seeding from `ADMIN_DIDS` environment variable on server startup
- `pub.chive.actor.getMyRoles` XRPC endpoint for querying the authenticated user's roles
- Direct alpha access grant dialog on the admin alpha management page
- Lexicon schemas for admin and actor role endpoints

#### Granular ATProto OAuth Scopes

- Permission set lexicon schemas (`basicReader`, `authorAccess`, `reviewerAccess`, `fullAccess`) following the ATProto `permission-set` Lexicon type
- Hierarchical permission model: basicReader (read-only RPC) < authorAccess (eprint/profile writes + claiming + blobs) < reviewerAccess (reviews + annotations) < fullAccess (graph governance + proposals)
- Scope constants for all 19 `pub.chive.*` repo collections, 6 external namespace collections (Bluesky, Standard, Cosmik), and 5 blob MIME type wildcards
- `buildScopeString` utility for constructing space-separated OAuth scope strings with automatic `atproto` prefix and deduplication
- Intent-based login flow with `AuthIntent` type (`browse`, `submit`, `review`, `full`) that requests only the scopes needed for each activity
- Frontend `getScopesForIntent` and `hasScope` utilities with `transition:generic` backward compatibility
- `CLIENT_METADATA_SCOPE` constant combining full access permission set with all external namespace scopes
- OAuth client metadata updated to declare granular scopes alongside `transition:generic` for backward compatibility with PDSes that don't support granular scopes

#### Deployment

- Docker smoke tests and staging deployment workflow with environment branch strategy
- `NEXT_PUBLIC_CHIVE_SERVICE_DID` build arg for per-environment service DID configuration

#### Observability

- Prometheus metric groups for jobs, workers, auth, search, blob proxy, dead letter queue, admin, and backfill operations
- OpenTelemetry span instrumentation for auth verification, background jobs, worker processing, and blob proxy requests
- Faro error boundary around eprint detail page for rendering crash diagnostics with trace ID references

#### Indexing

- Field label resolution job and indexer retry for unresolved UUID field labels
- `makeJobId` utility for sanitizing AT URIs into valid BullMQ job identifiers

#### Documentation

- Admin dashboard documentation covering API endpoints, backfill operations, observability metrics, architecture, and role management
- OAuth scopes documentation covering permission set definitions, intent-based login, and backward compatibility
- Documentation suite overhaul with formatting improvements, accuracy corrections, and staging deploy workflow

#### Testing

- Unit tests for AdminService, BackfillManager, admin XRPC handlers, admin seed script, and observability Prometheus instrumentation
- Frontend unit tests for admin hooks, admin auth guard, and role hooks
- Backend and frontend unit tests for OAuth scope constants, permission sets, `buildScopeString`, `getScopesForIntent`, and `hasScope`

### Changed

- Collection visibility renamed from `public`/`private` to `listed`/`unlisted` across lexicon, backend, frontend, and tests to reflect ATProto semantics (visibility controls AppView listing, not data access)
- PostgreSQL migration to rename existing visibility column values with backward-compatible normalization for old values
- GitHub Actions CI workflows updated with `ADMIN_DIDS` environment variable, admin health check endpoints, and expanded Prometheus metrics collection targets
- Documentation accuracy: removed non-existent content moderation features, corrected role names, fixed contact emails, replaced Semble references with Cosmik
- OAuth scope requests fall back to `transition:generic` until PDSes support granular permission sets
- Grafana Alloy Faro log pipeline switched from JSON stage to regex stages for Faro's key=value log format

### Fixed

- React 19 + Radix UI infinite loop crash (error #185) when selecting endorsement types by replacing Radix Checkbox with native HTML input
- BullMQ job ID validation errors caused by colons in AT URIs by sanitizing job IDs in enrichment, freshness, and index-retry workers
- AlphaGate redirecting approved users to login on transient auth refetch failures
- Null reference crashes on eprint detail page from missing `abstract`, endorser display names, or contribution arrays
- ~90 incorrect Wikidata Q-IDs across governance seed data
- Invalid lexicon schemas for citation record and listCitations query
- Permission set scopes to cover all frontend writes including external namespaces and blob types
- Docker smoke test to use `/ready` endpoint instead of nonexistent `/xrpc/_health`
- Backend `SERVICE_DID` environment variable name to match deploy configuration
- Reindex script to use MERGE instead of CREATE to handle Neo4j uniqueness constraints
- Staging deploy to pull from `origin/staging` instead of `origin/main`
- Admin role reference from `moderator` to `admin` in getPendingClaims endpoint
- Alpha applications table sync when granting access via admin role assignment
- Permission-set lexicons excluded from codegen to prevent build errors
- Neo4j Cypher syntax error in recommendation queries that prevented related papers from loading (moved `UNION ALL` inside `CALL {}` blocks for Neo4j 5.x compatibility)

## [0.1.0] - 2026-03-03

Initial release of Chive, a decentralized eprint service built on AT Protocol.

### Added

#### Core Architecture

- ATProto-native AppView that indexes scholarly records from the relay firehose without writing to user PDSes
- Hono-based API framework serving both XRPC and REST endpoints (~130 XRPC endpoints across 19 service areas)
- Modular service architecture with all services behind abstract `I*` interfaces for dependency injection
- Multi-database storage layer: PostgreSQL (metadata indexes), Elasticsearch (full-text search), Neo4j (knowledge graph), Redis (caching and rate limiting)
- All database tables use `_index` suffix and track PDS source URLs for staleness detection and rebuild-from-firehose capability
- Plugin system with hybrid TSyringe (DI) and EventEmitter2 (hooks) architecture, isolated-vm sandboxing, and declared permissions
- Background worker system with enrichment, freshness, and index-retry workers
- Scheduled jobs for citation extraction, field promotion, governance sync, graph algorithms, PDS scanning, and tag sync
- OAuth-based authentication with DID resolution, session management, and ATProto identity verification
- Rate limiting with configurable fail-open/fail-closed behavior when Redis is unavailable

#### Firehose Indexing and PDS Discovery

- Firehose consumer with WebSocket connection to ATProto relay, filtering for all `pub.chive.*` collections
- Support for both full firehose events (CAR/CBOR parsing) and Jetstream events (pre-decoded JSON)
- Cursor management with batched persistence to PostgreSQL for resumption after restarts
- Dead letter queue for failed events with error classification (transient, permanent, rate limit) and exponential backoff retry
- Backpressure handling to prevent memory exhaustion when queue depth exceeds threshold
- Reconnection manager with exponential backoff and jitter for network failure recovery
- PDS Discovery system with three discovery sources: PLC directory enumeration, relay listHosts queries, and DID mention extraction
- PDS Scanner that backfills records from all 19 `pub.chive.*` collections on discovered PDSes
- PDS registry with scan priority scheduling (24h for active, 7d for inactive) and consecutive failure tracking
- User-facing `pub.chive.sync.registerPDS` endpoint for self-hosted PDS registration
- Graceful shutdown with queue draining and cursor flushing

#### Lexicon Schemas

- 164 lexicon JSON schemas across 21 namespaces under the `pub.chive.*` namespace
- Record types for eprints (`submission`, `version`, `changelog`, `tag`, `userTag`, `citation`, `relatedWork`)
- Record types for reviews (`comment`, `endorsement`, `entityLink`)
- Record types for annotations (`comment`, `entityLink`)
- Record types for the knowledge graph (`node`, `edge`, `nodeProposal`, `edgeProposal`, `vote`)
- Record types for actor profiles (`profile`, `profileConfig`)
- Query and procedure schemas for collections, discovery, governance, claiming, metrics, activity, tags, backlinks, sync, notifications, and import
- Lexicon code generation pipeline producing TypeScript types and runtime `isRecord` type guards
- Rich text facet definitions for cross-references

#### Eprint Management

- Eprint submission with structured metadata: title, abstract, keywords, authors with affiliations and contribution types, publication tracking
- Eprint versioning with version number tracking, previous version references, and change descriptions
- Eprint changelog tracking for edit history
- LaTeX-to-Unicode abstract migration with `needsAbstractMigration` schema hint detection
- License metadata with URI-based license identification
- PDF blob reference storage (CID pointers only, never blob data) with on-demand PDS fetching
- Eprint soft deletion support
- OG image generation for social media sharing

#### Search and Discovery

- Full-text search powered by Elasticsearch with KStem stemmer, `bool_prefix` queries, and field-specific boosting
- Faceted search filtering by field, author, date range, keywords, and publication status
- Search autocomplete with search-as-you-type suggestions
- Personalized discovery dashboard with multi-signal scoring (field affinity, citation overlap, recency, collaborative filtering)
- "For You" feed with personalized paper recommendations
- Similar papers with "More Like This" fallback when primary signals are insufficient
- Field-filtered trending eprints
- Citation-based paper discovery
- Dismiss flow for unwanted suggestions with `recordInteraction` tracking
- Elasticsearch index lifecycle management policies, ingest pipelines, and index templates

#### Knowledge Graph

- Community-governed taxonomy using SKOS/FAST faceted classification stored in Neo4j
- Node types: fields, methods, datasets, tools, platforms, licenses, and custom personal nodes
- Edge types with semantic relation labels (broader, narrower, related, applied-to, uses, etc.)
- Bidirectional edge support with configurable directionality
- Graph hierarchy browsing with faceted navigation
- Subgraph expansion for exploring node neighborhoods
- Community detection, PageRank, and centrality graph algorithms
- Wikidata integration via SPARQL for external identifier enrichment
- Node autocomplete with search-as-you-type across all node types
- Node proposals and community voting for Wikipedia-style moderation
- Governance PDS (`did:plc:chive-governance`) for storing community-approved authority records as ATProto-native portable data
- Governance sync job for periodic authority record synchronization
- Trusted editor elevation requests with approval/rejection workflow
- Role delegation system for governance authority distribution

#### Collections

- User-owned collections stored as personal graph nodes in user PDSes
- Collection wizard with multi-step creation flow (basics, items, edges, structure, cosmik integration, review)
- Subcollection nesting with `SUBCOLLECTION_OF` edges and automatic parent propagation on add
- Add-to-collection buttons on eprint, review, endorsement, and graph node cards throughout the UI
- Inter-item edge editing for creating relationships between items within a collection
- Collection activity feeds tracking changes to watched items
- Collection search, public listing, and owner listing
- Hierarchical collection dashboard with depth-based indentation and expand/collapse
- Direct-only vs all-items view toggle for subcollection content
- Delete propagation from subcollections to parent collections
- Drag-and-drop item reordering
- Cosmik dual-write integration for cross-platform collection mirroring
- Nine XRPC endpoints for collection management

#### Review System

- Inline review comments with threaded discussion support
- Formal endorsement records with contribution type classification (methodology, results, novelty, clarity, significance, overall)
- Endorsement summary aggregation per eprint
- Entity linking from review text spans to knowledge graph nodes
- Review listing by eprint and by author
- Thread context retrieval for navigating discussion hierarchies
- Notifications for new reviews and endorsements on authored papers

#### Annotation System

- Inline text annotations on eprint PDFs using W3C Web Annotation data model
- Text selection anchoring with highlight persistence
- Entity link annotations connecting selected text spans to knowledge graph entities
- Annotation sidebar with navigation and deletion
- Dedicated annotation lexicon schemas separated from review system
- Annotation listing by eprint, by page, and by author

#### Citation and Related Works

- Citation extraction pipeline with GROBID integration for parsing reference sections from PDFs
- Extracted citation indexing in PostgreSQL with eprint cross-referencing
- User-curated related works linking between eprints
- Related papers panel with unified display of extracted citations and curated links
- Citation-based discovery signals feeding into recommendation engine

#### Author Profiles and Claiming

- Actor profile records with display name, bio, ORCID identifier, and institutional affiliations
- Profile configuration with customizable display sections
- Featured collection display on author profile pages
- Author claiming workflow with coauthor verification for papers imported from external sources
- Coauthorship request and approval/rejection flow
- Autocomplete for ORCID, affiliations, keywords, and OpenReview profiles
- External paper claiming from arXiv, OpenReview, and other integrated sources
- Claimable paper suggestions with dismiss capability

#### Tags and Classification

- Author-assigned tags on eprint submission
- User-contributed tags (folksonomy) with quality scoring
- Tag trending with time-decay algorithms
- Tag search and autocomplete
- Tag detail pages showing tagged eprints
- Tag suggestions based on eprint content
- Tag sync job for periodic data consistency

#### Backlinks

- Cross-platform backlink aggregation from Bluesky, Cosmik, Whitewind, and Leaflet
- Backlink creation and deletion endpoints
- Backlink count aggregation per eprint
- Cosmik backlink source type support

#### Metrics and Activity

- View, download, and dwell time recording for eprints
- Search click and search download tracking
- Trending calculation based on engagement metrics
- Activity feed logging with correlation metrics
- Failed activity tracking for monitoring

#### Built-in Plugins

- arXiv plugin with paper search and metadata retrieval
- OpenReview plugin for conference paper search
- PsyArXiv plugin for psychology preprint search via OSF API
- LingBuzz plugin for linguistics preprint scraping with respectful rate limiting
- Semantics Archive plugin for semantic web publication scraping
- Plugin import scheduling with configurable intervals and run-on-start support
- Bluesky, Cosmik, Whitewind, and Leaflet backlink plugins
- Plugin framework with lifecycle management, hook system, and sandboxed execution

#### Frontend

- Next.js 15 application with React 19 and App Router
- 68 page routes covering search, eprints, authors, collections, governance, dashboard, submission, discovery, and authentication
- 350+ React components organized by domain
- TanStack Query data fetching with optimistic updates and cache management
- TipTap rich text editor with cross-reference `[[` autocomplete for knowledge graph entities
- PDF viewer with text selection, highlight anchoring, and annotation overlay
- Responsive design with mobile-friendly tab scrolling
- Radix UI component library with Tailwind CSS styling
- Grafana Faro frontend observability with configurable trace and session sampling

#### Observability and Monitoring

- OpenTelemetry instrumentation for distributed tracing across all services
- Grafana Alloy agent for receiving frontend Faro and backend OTLP telemetry
- Tempo for distributed trace storage and querying
- Loki for centralized log aggregation
- Prometheus metrics collection with custom Chive metrics (indexing events, queue depth, lag, PDS scan durations)
- Grafana dashboards for visualization
- Structured JSON logging with configurable log levels
- Health check endpoints (`/health`, `/readiness`) with detailed service status

#### Infrastructure

- Multi-stage Docker build with separate `production` and `development` targets
- Docker Compose configurations for production, local development, observability, and documentation
- Traefik reverse proxy with automatic Let's Encrypt SSL certificate management
- Governance PDS container running Bluesky PDS image for authority record storage
- GROBID container for PDF citation extraction with tuned memory limits and health check timing
- Kubernetes manifests with Helm charts, horizontal pod autoscaling, pod disruption budgets, and RBAC
- CI pipeline with 7 jobs: unit tests, type checking, lint and format, ATProto compliance, integration tests, build, and deploy
- Automated deployment via GitHub Actions with environment file generation, Docker image building, and post-deploy verification
- Build cache cleanup to prevent disk space accumulation from `--no-cache` Docker builds
- Separate indexer process for resource isolation from the API server

#### Documentation

- Docusaurus documentation site with auto-generated interactive API docs from OpenAPI specification
- User guide covering searching, submitting eprints, editing, peer review, endorsements, profiles, authorship claiming, tags, collections, discovery, and Bluesky sharing
- Developer guide covering API layer, authentication, core services, lexicon validation, frontend architecture, rich text, eprint lifecycle, and observability
- Service documentation for indexing, collections, discovery, claiming, and PDS discovery
- Plugin documentation with creation guide and built-in plugin reference
- Storage documentation for PostgreSQL, Elasticsearch, Neo4j, and Redis
- Architecture overview, concepts (AT Protocol, knowledge graph, data sovereignty), governance, operations, and reference documentation

#### Testing

- ATProto compliance test suite with 100% pass rate requirement validating data sovereignty principles
- End-to-end test suite with 42 Playwright test files covering all major user workflows
- Integration test suite with 32 test files covering API endpoints, services, and storage layers
- Unit test suite with 134 test files covering handlers, services, storage adapters, plugins, and utilities
- Test infrastructure with Docker test stack, seed data scripts, and cleanup utilities

[Unreleased]: https://github.com/chive-pub/chive/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/chive-pub/chive/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/chive-pub/chive/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/chive-pub/chive/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/chive-pub/chive/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/chive-pub/chive/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/chive-pub/chive/compare/v0.6.3...v0.7.0
[0.6.3]: https://github.com/chive-pub/chive/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/chive-pub/chive/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/chive-pub/chive/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/chive-pub/chive/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/chive-pub/chive/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/chive-pub/chive/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/chive-pub/chive/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/chive-pub/chive/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/chive-pub/chive/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/chive-pub/chive/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/chive-pub/chive/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/chive-pub/chive/releases/tag/v0.1.0
