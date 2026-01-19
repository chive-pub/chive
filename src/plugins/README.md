# Plugin System

Extensible plugin architecture for Chive integrations.

## Overview

The plugin system enables external service integrations and custom functionality through a secure, isolated execution environment. Plugins run in `isolated-vm` sandboxes with declared permissions and resource limits.

## Directory Structure

```
plugins/
├── index.ts                     # Module exports
├── core/                        # Plugin infrastructure
│   ├── backlink-plugin.ts       # Base class for backlink plugins
│   ├── event-bus.ts             # Global event bus
│   ├── import-scheduler.ts      # Import job scheduling
│   ├── importing-plugin.ts      # Base class for import plugins
│   ├── manifest-schema.ts       # Plugin manifest validation
│   ├── paper-search.ts          # Paper search abstraction
│   ├── plugin-context.ts        # Plugin execution context
│   ├── plugin-loader.ts         # Dynamic plugin loading
│   ├── plugin-manager.ts        # Plugin lifecycle management
│   ├── plugin-registry.ts       # Plugin discovery and registration
│   └── scoped-event-bus.ts      # Plugin-scoped event bus
├── sandbox/                     # Security isolation
│   ├── isolated-vm-sandbox.ts   # V8 isolate sandbox
│   ├── permission-enforcer.ts   # Permission boundary enforcement
│   └── resource-governor.ts     # CPU/memory limits
└── builtin/                     # Built-in plugins
    ├── base-plugin.ts           # Base plugin class
    ├── arxiv.ts                 # arXiv paper import
    ├── bluesky-backlinks.ts     # Bluesky mention tracking
    ├── crossref.ts              # Crossref metadata enrichment
    ├── doi-registration.ts      # DOI registration
    ├── dryad.ts                 # Dryad data repository
    ├── fast.ts                  # OCLC FAST subject headings
    ├── figshare.ts              # Figshare integration
    ├── github-integration.ts    # GitHub repository linking
    ├── gitlab-integration.ts    # GitLab repository linking
    ├── leaflet-backlinks.ts     # Leaflet.social backlinks
    ├── lingbuzz.ts              # LingBuzz paper import
    ├── openalex.ts              # OpenAlex citation data
    ├── openreview.ts            # OpenReview paper import
    ├── orcid-linking.ts         # ORCID profile linking
    ├── osf.ts                   # Open Science Framework
    ├── psyarxiv.ts              # PsyArXiv paper import
    ├── ror.ts                   # ROR affiliation lookup
    ├── semantic-scholar.ts      # Semantic Scholar citations
    ├── semantics-archive.ts     # Semantics Archive import
    ├── semble-backlinks.ts      # Semble backlinks
    ├── software-heritage.ts     # Software Heritage archiving
    ├── whitewind-backlinks.ts   # WhiteWind backlinks
    ├── wikidata.ts              # Wikidata entity linking
    └── zenodo-integration.ts    # Zenodo deposit sync
```

## Plugin Types

### Import Plugins

Import papers from external sources:

- `arxiv.ts` - arXiv preprints
- `openreview.ts` - OpenReview papers
- `lingbuzz.ts` - Linguistics papers
- `psyarxiv.ts` - Psychology preprints
- `semantics-archive.ts` - Semantics papers

### Backlink Plugins

Track mentions across platforms:

- `bluesky-backlinks.ts` - Bluesky posts
- `leaflet-backlinks.ts` - Leaflet.social
- `whitewind-backlinks.ts` - WhiteWind blogs
- `semble-backlinks.ts` - Semble discussions

### Enrichment Plugins

Add metadata from external sources:

- `crossref.ts` - DOI metadata, citations
- `openalex.ts` - Citation counts, concepts
- `semantic-scholar.ts` - Citation graphs
- `wikidata.ts` - Entity linking
- `ror.ts` - Institution identifiers

### Integration Plugins

Connect with external services:

- `github-integration.ts` - Code repositories
- `gitlab-integration.ts` - Code repositories
- `zenodo-integration.ts` - Data archiving
- `orcid-linking.ts` - Author profiles
- `doi-registration.ts` - DOI minting

## Plugin Manifest

Each plugin declares its capabilities in a manifest:

```typescript
const manifest: PluginManifest = {
  id: 'com.example.my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'Plugin description',
  author: 'Author Name',
  license: 'MIT',
  permissions: {
    network: {
      allowedDomains: ['api.example.com'],
    },
    storage: {
      maxBytes: 1024 * 1024, // 1MB
    },
  },
  entrypoint: 'dist/index.js',
};
```

## Event System

Plugins communicate via events:

```typescript
// Subscribe to events
context.eventBus.on('eprint.indexed', async (eprint) => {
  // Enrich with external data
});

// Emit events
context.eventBus.emit('plugin.enrichment.complete', {
  eprintUri,
  source: 'crossref',
  data: enrichmentData,
});
```

## Security

Plugins run in isolated-vm with:

- Separate V8 isolates (memory isolation)
- CPU time limits
- Memory limits
- Network domain allowlists
- No filesystem access
- No process spawning

## Usage Example

```typescript
import { PluginManager } from './core/plugin-manager.js';

const manager = new PluginManager({ logger, redis });

// Load built-in plugins
await manager.loadBuiltins();

// Initialize all plugins
await manager.initializeAll();

// Handle events
manager.eventBus.on('eprint.indexed', async (eprint) => {
  // Plugins automatically process events
});

// Shutdown
await manager.shutdownAll();
```
