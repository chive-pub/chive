# Builtin plugins

Chive includes 24 builtin plugins for metadata enrichment, author verification, and backlink tracking.

## Metadata enrichment

### Semantic Scholar

**ID:** `pub.chive.plugin.semantic-scholar`

Fetches citation data, author profiles, and SPECTER2 recommendations from Semantic Scholar.

```typescript
// Available methods
await plugin.getPaper(s2Id);
await plugin.getPaperByDoi(doi);
await plugin.getPaperByArxiv(arxivId);
await plugin.getAuthor(authorId);
await plugin.searchAuthors(query);
await plugin.searchPapers(query);
await plugin.getCitations(paperId, { limit: 100 });
await plugin.getReferences(paperId, { limit: 100 });
await plugin.getRecommendations(paperId, { limit: 10 });
```

**Configuration:**

| Variable        | Default  | Description                    |
| --------------- | -------- | ------------------------------ |
| `S2_API_KEY`    | (none)   | API key for higher rate limits |
| `S2_CACHE_TTL`  | `604800` | Cache TTL (7 days)             |
| `S2_RATE_LIMIT` | `3000`   | Delay between requests (ms)    |

### OpenAlex

**ID:** `pub.chive.plugin.openalex`

Fetches work metadata, concepts, and institution affiliations from OpenAlex.

```typescript
await plugin.getWork(openAlexId);
await plugin.getWorkByDoi(doi);
await plugin.getAuthorByOrcid(orcid);
await plugin.autocompleteAuthors(query);
await plugin.searchWorks(query, { filters });
await plugin.classifyText(text);
await plugin.getRelatedWorks(workId);
await plugin.getWorksBatch(ids); // Up to 50
```

**Configuration:**

| Variable             | Default    | Description           |
| -------------------- | ---------- | --------------------- |
| `OPENALEX_EMAIL`     | (required) | Email for polite pool |
| `OPENALEX_CACHE_TTL` | `604800`   | Cache TTL (7 days)    |

### CrossRef

**ID:** `pub.chive.plugin.crossref`

Fetches DOI metadata and reference lists from CrossRef.

```typescript
await plugin.getWork(doi);
await plugin.searchWorks(query);
await plugin.getReferences(doi);
await plugin.getCitationCount(doi);
```

**Configuration:**

| Variable             | Default    | Description           |
| -------------------- | ---------- | --------------------- |
| `CROSSREF_EMAIL`     | (required) | Email for polite pool |
| `CROSSREF_CACHE_TTL` | `2592000`  | Cache TTL (30 days)   |

### Wikidata

**ID:** `pub.chive.plugin.wikidata`

Links entities to Wikidata for multilingual labels and external identifiers.

```typescript
await plugin.getEntity(qid);
await plugin.search(query, { language: 'en' });
await plugin.getSparqlResults(sparqlQuery);
```

## Author verification

### ORCID

**ID:** `pub.chive.plugin.orcid`

Verifies author identity by checking ORCID profiles.

```typescript
await plugin.fetchOrcidProfile(orcidId);
await plugin.searchAuthors(name);
await plugin.isValidOrcid(orcidId); // Validates format and checksum
```

The plugin validates ORCIDs using the Luhn checksum algorithm.

**Configuration:**

| Variable          | Default | Description          |
| ----------------- | ------- | -------------------- |
| `ORCID_CACHE_TTL` | `86400` | Cache TTL (24 hours) |

### ROR

**ID:** `pub.chive.plugin.ror`

Verifies institution affiliations using the Research Organization Registry.

```typescript
await plugin.getOrganization(rorId);
await plugin.search(query);
await plugin.autocomplete(prefix);
```

## Preprint archives

### arXiv

**ID:** `pub.chive.plugin.arxiv`

Imports preprints from arXiv using OAI-PMH and the Atom API.

```typescript
// Bulk import via OAI-PMH
for await (const preprint of plugin.fetchPreprints()) {
  // Process preprints
}

// Search via Atom API
const results = await plugin.search(query);

// Get single paper
const paper = await plugin.fetchPaperDetails(arxivId);
```

**Configuration:**

| Variable           | Default             | Description                 |
| ------------------ | ------------------- | --------------------------- |
| `ARXIV_CATEGORIES` | `cs.CL,cs.AI,cs.LG` | Default categories          |
| `ARXIV_RATE_LIMIT` | `3000`              | Delay between requests (ms) |

### LingBuzz

**ID:** `pub.chive.plugin.lingbuzz`

Imports linguistics preprints from LingBuzz.

```typescript
for await (const preprint of plugin.fetchPreprints()) {
  // Process preprints
}

const results = await plugin.search(query);
```

Uses RSS feed and web scraping with a 10-second delay between requests.

### Semantics Archive

**ID:** `pub.chive.plugin.semanticsarchive`

Imports semantics preprints from Semantics Archive.

```typescript
for await (const preprint of plugin.fetchPreprints()) {
  // Process preprints
}
```

Uses web scraping with a 5-second delay between requests.

### PsyArXiv

**ID:** `pub.chive.plugin.psyarxiv`

Imports psychology preprints from PsyArXiv via the OSF API.

### OpenReview

**ID:** `pub.chive.plugin.openreview`

Imports conference papers from OpenReview with peer review metadata.

```typescript
for await (const preprint of plugin.fetchPreprints({ venue })) {
  // Process submissions
}

const results = await plugin.search(query);
```

Supports OAuth authentication for author profile verification.

## Data and software

### Zenodo

**ID:** `pub.chive.plugin.zenodo`

Links preprints to software and datasets archived on Zenodo.

```typescript
await plugin.getRecord(doi);
await plugin.search(query, { type: 'dataset' });
```

### Figshare

**ID:** `pub.chive.plugin.figshare`

Links preprints to supplementary materials on Figshare.

### Dryad

**ID:** `pub.chive.plugin.dryad`

Links preprints to research data on Dryad.

### Software Heritage

**ID:** `pub.chive.plugin.software-heritage`

Links preprints to archived source code on Software Heritage.

### OSF

**ID:** `pub.chive.plugin.osf`

Links preprints to Open Science Framework projects.

## Code repositories

### GitHub

**ID:** `pub.chive.plugin.github`

Detects and links GitHub repositories mentioned in preprints.

```typescript
await plugin.getRepositoryInfo(owner, repo);
await plugin.detectRepositories(preprint);
```

Extracts repository metadata including stars, forks, license, and language.

### GitLab

**ID:** `pub.chive.plugin.gitlab`

Links preprints to GitLab repositories.

## Subject classification

### FAST

**ID:** `pub.chive.plugin.fast`

Searches FAST (Faceted Application of Subject Terminology) headings.

```typescript
await plugin.searchSubjects(query);
await plugin.getSubject(fastId);
```

FAST provides 1.7 million controlled vocabulary terms from OCLC.

## DOI registration

### DOI Registration

**ID:** `pub.chive.plugin.doi`

Registers DOIs for preprints via DataCite.

```typescript
await plugin.registerDoi(preprint);
await plugin.updateDoi(doi, metadata);
```

Requires DataCite credentials.

## Backlink tracking

These plugins track references to Chive preprints from ATProto apps.

### Bluesky Backlinks

**ID:** `pub.chive.plugin.bluesky-backlinks`

Tracks references from Bluesky posts (`app.bsky.feed.post`).

Detects embedded preprint links and external URLs pointing to Chive.

### Semble Backlinks

**ID:** `pub.chive.plugin.semble-backlinks`

Tracks references from Semble notes and discussions.

### Leaflet Backlinks

**ID:** `pub.chive.plugin.leaflet-backlinks`

Tracks references from Leaflet semantic annotations.

### WhiteWind Backlinks

**ID:** `pub.chive.plugin.whitewind-backlinks`

Tracks references from WhiteWind research notes.

## Plugin dependencies

Some plugins depend on others:

```
DiscoveryService
├── semantic-scholar (optional)
├── openalex (optional)
└── crossref (optional)

ClaimingService
├── orcid (for verification)
├── semantic-scholar (for author matching)
├── openalex (for author matching)
└── openreview (for profile verification)
```

If optional plugins are unavailable, the service falls back to local data.
