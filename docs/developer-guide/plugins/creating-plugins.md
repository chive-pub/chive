# Creating plugins

This guide walks through creating a Chive plugin from scratch.

## Prerequisites

- Node.js 22+
- TypeScript 5.5+
- Understanding of the plugin system (see [Plugin overview](./README.md))

## Project setup

Create a new plugin project:

```bash
mkdir chive-plugin-example
cd chive-plugin-example
npm init -y
npm install typescript @chive/plugin-sdk
npx tsc --init
```

## Plugin manifest

Create `plugin.json` with your plugin metadata:

```json
{
  "id": "pub.chive.plugin.example",
  "name": "Example Plugin",
  "version": "1.0.0",
  "description": "Demonstrates plugin structure",
  "author": "Your Name",
  "license": "MIT",
  "entrypoint": "dist/index.js",
  "permissions": {
    "network": {
      "allowedDomains": ["api.example.com"]
    },
    "storage": {
      "maxSize": "10MB"
    },
    "hooks": ["eprint.indexed", "system.startup"]
  }
}
```

### Manifest fields

| Field          | Required | Description                                   |
| -------------- | -------- | --------------------------------------------- |
| `id`           | Yes      | Reverse domain notation (pub.chive.plugin.\*) |
| `name`         | Yes      | Human-readable name                           |
| `version`      | Yes      | Semantic version                              |
| `description`  | Yes      | What the plugin does                          |
| `author`       | Yes      | Author or organization                        |
| `license`      | Yes      | SPDX license identifier                       |
| `entrypoint`   | Yes      | Compiled JS file path                         |
| `permissions`  | Yes      | Required permissions                          |
| `dependencies` | No       | Other plugin IDs this depends on              |

## Basic plugin

Create `src/index.ts`:

```typescript
import { BasePlugin, PluginContext, Eprint } from '@chive/plugin-sdk';

export default class ExamplePlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.example';
  readonly name = 'Example Plugin';

  private cache: Map<string, unknown> = new Map();

  async initialize(context: PluginContext): Promise<void> {
    this.logger = context.logger;
    this.http = context.httpClient;

    // Subscribe to events
    context.eventBus.on('eprint.indexed', this.onEprintIndexed.bind(this));

    this.logger.info('Example plugin initialized');
  }

  async shutdown(): Promise<void> {
    // Cleanup resources
    this.cache.clear();
    this.logger.info('Example plugin shut down');
  }

  private async onEprintIndexed(event: { eprint: Eprint }): Promise<void> {
    const { eprint } = event;

    // Fetch additional data from external API
    const metadata = await this.fetchMetadata(eprint.doi);
    if (metadata) {
      this.cache.set(eprint.uri, metadata);
    }
  }

  private async fetchMetadata(doi: string | undefined): Promise<unknown> {
    if (!doi) return null;

    try {
      const response = await this.http.get(
        `https://api.example.com/works/${encodeURIComponent(doi)}`
      );
      return response.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch metadata for ${doi}`, { error });
      return null;
    }
  }
}
```

## Importing plugin

Create a plugin that imports eprints from an external source:

```typescript
import { ImportingPlugin, ImportedEprint, PluginContext } from '@chive/plugin-sdk';

export default class ExampleImporter extends ImportingPlugin {
  readonly id = 'pub.chive.plugin.example-importer';
  readonly name = 'Example Importer';

  protected rateLimitDelayMs = 1000; // 1 request per second

  async initialize(context: PluginContext): Promise<void> {
    await super.initialize(context);
    this.logger.info('Importer initialized');
  }

  async *fetchEprints(): AsyncIterable<ImportedEprint> {
    const response = await this.http.get('https://api.example.com/papers');

    for (const paper of response.data.papers) {
      yield this.transformPaper(paper);

      // Respect rate limits
      await this.delay(this.rateLimitDelayMs);
    }
  }

  async search(query: string): Promise<ImportedEprint[]> {
    const response = await this.http.get(
      `https://api.example.com/search?q=${encodeURIComponent(query)}`
    );

    return response.data.results.map(this.transformPaper);
  }

  private transformPaper(paper: unknown): ImportedEprint {
    return {
      externalId: paper.id,
      source: 'example',
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors.map((a: unknown) => ({
        name: a.name,
        orcid: a.orcid,
      })),
      doi: paper.doi,
      pdfUrl: paper.pdfUrl,
      publishedAt: new Date(paper.publishedAt),
      categories: paper.subjects,
    };
  }
}
```

## Backlink tracking plugin

Create a plugin that tracks references from an ATProto app:

```typescript
import { BacklinkTrackingPlugin, Backlink, PluginContext, RepoEvent } from '@chive/plugin-sdk';

export default class ExampleBacklinks extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.example-backlinks';
  readonly name = 'Example Backlinks';
  readonly collection = 'com.example.post';

  async initialize(context: PluginContext): Promise<void> {
    await super.initialize(context);
    this.logger.info('Backlink tracker initialized');
  }

  async extractBacklinks(record: unknown, event: RepoEvent): Promise<Backlink[]> {
    const backlinks: Backlink[] = [];

    // Check for Chive eprint references
    if (record.embed?.uri?.startsWith('at://') && record.embed.uri.includes('pub.chive.eprint')) {
      backlinks.push({
        sourceUri: `at://${event.repo}/${event.path}`,
        targetUri: record.embed.uri,
        sourceType: 'example',
        createdAt: new Date(),
      });
    }

    return backlinks;
  }

  async handleDeletion(sourceUri: string): Promise<void> {
    // Mark backlink as deleted
    await this.backlinkService.deleteBacklink(sourceUri);
  }
}
```

## Using the plugin context

The plugin context provides access to shared resources:

```typescript
interface PluginContext {
  // Logging
  logger: ILogger;

  // HTTP client (permission-restricted)
  httpClient: IHttpClient;

  // Key-value cache (permission-restricted)
  cache: ICache;

  // Event subscription
  eventBus: IScopedEventBus;

  // Configuration values
  config: PluginConfig;
}
```

### Logging

Use structured logging:

```typescript
this.logger.info('Processing eprint', {
  uri: eprint.uri,
  title: eprint.title,
});

this.logger.warn('Rate limited', {
  retryAfter: 60,
});

this.logger.error('Failed to fetch', {
  error: error.message,
  doi: eprint.doi,
});
```

### HTTP client

The HTTP client respects declared domain permissions:

```typescript
// GET request
const response = await this.http.get('https://api.example.com/data', {
  headers: { Accept: 'application/json' },
});

// POST request
const result = await this.http.post('https://api.example.com/submit', {
  data: { key: 'value' },
  headers: { 'Content-Type': 'application/json' },
});
```

### Caching

Use the cache for frequently accessed data:

```typescript
// Store with TTL
await this.cache.set('key', value, { ttl: 3600 });

// Retrieve
const cached = await this.cache.get<MyType>('key');

// Delete
await this.cache.delete('key');
```

## Testing plugins

Create tests for your plugin:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MockPluginContext } from '@chive/plugin-sdk/testing';
import ExamplePlugin from '../src/index';

describe('ExamplePlugin', () => {
  let plugin: ExamplePlugin;
  let context: MockPluginContext;

  beforeEach(() => {
    context = new MockPluginContext();
    plugin = new ExamplePlugin();
  });

  it('initializes without errors', async () => {
    await expect(plugin.initialize(context)).resolves.not.toThrow();
  });

  it('fetches metadata for eprints with DOI', async () => {
    context.mockHttp.get.mockResolvedValue({
      data: { citations: 42 },
    });

    await plugin.initialize(context);

    // Simulate eprint indexed event
    await context.eventBus.emit('eprint.indexed', {
      eprint: {
        uri: 'at://did:plc:abc.../pub.chive.eprint.submission/123',
        doi: '10.1234/example',
      },
    });

    expect(context.mockHttp.get).toHaveBeenCalledWith(expect.stringContaining('10.1234%2Fexample'));
  });
});
```

## Building and packaging

Add build scripts to `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "package": "npm run build && npm pack"
  }
}
```

Build the plugin:

```bash
npm run build
```

## Installation

Install plugins in the Chive plugins directory:

```bash
# Copy plugin files
cp -r dist/ $CHIVE_PLUGIN_DIR/example-plugin/
cp plugin.json $CHIVE_PLUGIN_DIR/example-plugin/

# Or install from npm
npm install @your-org/chive-plugin-example --prefix $CHIVE_PLUGIN_DIR
```

## Next steps

- See [Builtin plugins](./builtin-plugins.md) for reference implementations
- Review the plugin SDK documentation for advanced features
