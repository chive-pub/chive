# Plugin System

This guide covers Chive's plugin system architecture, development patterns, and security model. Plugins extend Chive's functionality through a hybrid TSyringe DI + EventEmitter2 hooks architecture.

## Overview

The plugin system provides:

- **PluginManager**: Lifecycle management (load, unload, reload)
- **PluginEventBus**: Async event emission with wildcard patterns
- **PermissionEnforcer**: Runtime permission validation
- **ResourceGovernor**: CPU and memory limits per plugin
- **IsolatedVmSandbox**: V8 isolate for untrusted plugin code

All plugins follow ATProto compliance rules: they can read events and cache computed results but never write to user PDSes.

## Architecture

### Component diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      PluginManager                          │
│              (lifecycle, dependency ordering)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │PluginLoader │   │ContextFact │   │PluginEvent  │
  │ (manifest   │   │ (scoped    │   │    Bus      │
  │  validation)│   │  context)  │   │ (hooks)     │
  └─────────────┘   └──────┬──────┘   └──────┬──────┘
                           │                 │
         ┌─────────────────┴─────────────────┤
         ▼                                   ▼
  ┌─────────────┐                     ┌─────────────┐
  │ Permission  │                     │  Resource   │
  │  Enforcer   │                     │  Governor   │
  └──────┬──────┘                     └──────┬──────┘
         │                                   │
  ┌──────┴──────┐                     ┌──────┴──────┐
  │ IsolatedVm  │                     │   Memory    │
  │   Sandbox   │                     │   Limits    │
  └─────────────┘                     └─────────────┘
```

### Data flow

1. User installs a plugin (places in `plugins/` directory or loads builtin)
2. PluginLoader validates the manifest using JSON Schema
3. PluginManager creates scoped context via PluginContextFactory
4. Plugin initializes with context (logger, cache, metrics, eventBus)
5. Plugin subscribes to permitted hooks (e.g., `preprint.indexed`)
6. When events fire, plugin handlers execute with resource limits
7. Plugin caches computed results (ephemeral, rebuildable)

## Creating a Plugin

### Plugin manifest

Every plugin requires a `manifest.json`:

```json
{
  "id": "pub.chive.plugin.my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "Adds custom functionality to Chive",
  "author": "Your Name",
  "license": "MIT",
  "permissions": {
    "hooks": ["preprint.indexed", "preprint.updated"],
    "network": {
      "allowedDomains": ["api.example.com"]
    },
    "storage": {
      "maxSize": 1048576
    }
  },
  "entrypoint": "dist/index.js",
  "dependencies": []
}
```

### Manifest fields

| Field                                | Required | Description                                              |
| ------------------------------------ | -------- | -------------------------------------------------------- |
| `id`                                 | Yes      | Unique reverse-domain ID (e.g., `pub.chive.plugin.name`) |
| `name`                               | Yes      | Human-readable name                                      |
| `version`                            | Yes      | Semantic version (major.minor.patch)                     |
| `description`                        | Yes      | Brief description                                        |
| `author`                             | Yes      | Author name or organization                              |
| `license`                            | Yes      | SPDX license identifier                                  |
| `permissions.hooks`                  | Yes      | Array of hook patterns (supports `*` wildcard)           |
| `permissions.network.allowedDomains` | Yes      | Domains plugin can access                                |
| `permissions.storage.maxSize`        | Yes      | Maximum cache storage in bytes                           |
| `entrypoint`                         | Yes      | Path to compiled plugin entry point                      |
| `dependencies`                       | No       | Array of required plugin IDs                             |

### BasePlugin class

Extend `BasePlugin` for TypeScript plugins:

```typescript
import { BasePlugin } from '@/plugins/builtin/base-plugin.js';
import type { IPluginContext, IPluginManifest } from '@/types/interfaces/plugin.interface.js';

export class MyPlugin extends BasePlugin {
  readonly id = 'pub.chive.plugin.my-plugin';
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.my-plugin',
    name: 'My Plugin',
    version: '0.1.0',
    description: 'Adds custom functionality',
    author: 'Your Name',
    license: 'MIT',
    permissions: {
      hooks: ['preprint.indexed'],
      network: { allowedDomains: ['api.example.com'] },
      storage: { maxSize: 1024 * 1024 },
    },
    entrypoint: 'dist/index.js',
  };

  protected async onInitialize(): Promise<void> {
    // Subscribe to events
    this.context.eventBus.on('preprint.indexed', this.handlePreprintIndexed.bind(this));

    this.context.logger.info('Plugin initialized');
  }

  protected async onShutdown(): Promise<void> {
    this.context.logger.info('Plugin shutting down');
  }

  private async handlePreprintIndexed(event: { uri: string; title: string }): Promise<void> {
    this.context.logger.debug('Preprint indexed', { uri: event.uri });

    // Cache computed result
    await this.context.cache.set(
      `processed:${event.uri}`,
      { processed: true, at: new Date().toISOString() },
      3600 // 1 hour TTL
    );

    // Record metrics
    this.context.metrics.incrementCounter('preprints_processed', { status: 'success' });
  }
}
```

### Plugin context

The context provides scoped access to Chive services:

```typescript
interface IPluginContext {
  // Scoped logger with plugin ID
  logger: ILogger;

  // Namespaced cache (keys prefixed with plugin ID)
  cache: ICacheProvider;

  // Labeled metrics (plugin_id label added automatically)
  metrics: IMetrics;

  // Permission-filtered event bus
  eventBus: IScopedPluginEventBus;

  // Plugin configuration (from manifest or runtime)
  config: Record<string, unknown>;
}
```

## Event System

### Available hooks

| Hook                  | Payload                            | Description             |
| --------------------- | ---------------------------------- | ----------------------- |
| `preprint.indexed`    | `{ uri, title, author, ... }`      | New preprint indexed    |
| `preprint.updated`    | `{ uri, previousCid, currentCid }` | Preprint record updated |
| `preprint.deleted`    | `{ uri }`                          | Preprint record deleted |
| `review.created`      | `{ uri, subject, author }`         | New review comment      |
| `review.deleted`      | `{ uri }`                          | Review deleted          |
| `endorsement.created` | `{ uri, subject, author, type }`   | New endorsement         |
| `author.linked`       | `{ did, orcid }`                   | ORCID linked to author  |
| `system.startup`      | `{}`                               | System starting         |
| `system.shutdown`     | `{}`                               | System shutting down    |
| `plugin.loaded`       | `{ pluginId }`                     | Plugin loaded           |
| `plugin.unloaded`     | `{ pluginId }`                     | Plugin unloaded         |

### Subscribing to events

```typescript
// Exact hook match
this.context.eventBus.on('preprint.indexed', (event) => {
  // Handle event
});

// Wildcard patterns (if declared in manifest)
// manifest.permissions.hooks: ['preprint.*']
this.context.eventBus.on('preprint.indexed', handler);
this.context.eventBus.on('preprint.updated', handler);
this.context.eventBus.on('preprint.deleted', handler);
```

### Emitting events

Plugins can emit events they have permission for:

```typescript
// Must be declared in manifest.permissions.hooks
this.context.eventBus.emit('preprint.indexed', {
  uri: 'at://did:plc:abc/pub.chive.preprint.submission/xyz',
  title: 'New Preprint',
});
```

### Error isolation

Handler errors are isolated and logged without affecting other handlers:

```typescript
this.context.eventBus.on('preprint.indexed', async (event) => {
  throw new Error('Handler failed');
  // Error is logged but other handlers still execute
});
```

## Security Model

### Permission enforcement

All plugin operations are permission-checked at runtime:

```typescript
// Network access
permissionEnforcer.enforceNetworkAccess(plugin, 'api.github.com');
// Throws SandboxViolationError if domain not in allowlist

// Hook access
permissionEnforcer.enforceHookAccess(plugin, 'system.shutdown');
// Throws PluginPermissionError if hook not declared

// Storage quota
permissionEnforcer.enforceStorageLimit(plugin, 500000);
// Throws SandboxViolationError if quota exceeded
```

### Resource limits

Default limits per plugin:

| Resource | Limit     | Description                |
| -------- | --------- | -------------------------- |
| Memory   | 128 MB    | V8 heap size limit         |
| CPU      | 5 seconds | Per-operation timeout      |
| Storage  | 1 MB      | Cache quota (configurable) |
| Network  | Allowlist | Only declared domains      |

### Sandbox isolation

External plugins run in isolated V8 contexts:

```typescript
const sandbox = new IsolatedVmSandbox(logger);

// Create isolate for plugin
const isolate = await sandbox.createIsolate(manifest);

// Execute code in sandbox
const result = await sandbox.executeInSandbox(isolate, code, context);

// Dispose when done
sandbox.dispose(isolate);
```

The sandbox prevents access to:

- Node.js APIs (`require`, `process`, `fs`)
- Global objects (`window`, `document`)
- Native modules
- Network unless explicitly proxied

## Builtin Plugins

Chive includes five builtin plugins:

### GitHub Integration

Links preprints to GitHub repositories.

```typescript
import { GitHubIntegrationPlugin } from '@/plugins/builtin/github-integration.js';

// Permissions
hooks: ['preprint.indexed', 'preprint.updated']
network: ['api.github.com']

// Functionality
- Creates issues when preprints reference repositories
- Syncs preprint metadata to repository discussions
- Links code repositories to preprints
```

### ORCID Linking

Verifies author identities via ORCID.

```typescript
import { ORCIDLinkingPlugin } from '@/plugins/builtin/orcid-linking.js';

// Permissions
hooks: ['author.linked', 'preprint.indexed']
network: ['pub.orcid.org', 'orcid.org']

// Functionality
- Verifies ORCID identifiers
- Fetches author profiles
- Links authors to their publications
```

### DOI Registration

Registers DOIs via DataCite API.

```typescript
import { DOIRegistrationPlugin } from '@/plugins/builtin/doi-registration.js';

// Permissions
hooks: ['preprint.indexed']
network: ['api.datacite.org']

// Functionality
- Mints DOIs for new preprints
- Updates DOI metadata on preprint updates
- Caches DOI mappings
```

### Semantics Archive

Imports linguistics preprints from Semantics Archive.

```typescript
import { SemanticsArchivePlugin } from '@/plugins/builtin/semantics-archive.js';

// Permissions
hooks: ['system.startup']
network: ['semanticsarchive.net']

// Functionality
- Scrapes recent papers from semanticsarchive.net
- Extracts title, authors, abstract, keywords
- Rate limited: 1 request per 5 seconds
- Caches for 7 days
```

### LingBuzz

Imports linguistics preprints from LingBuzz RSS feed.

```typescript
import { LingBuzzPlugin } from '@/plugins/builtin/lingbuzz.js';

// Permissions
hooks: ['system.startup']
network: ['ling.auf.net', 'feeds.feedburner.com']

// Functionality
- Parses RSS feed for new papers
- Scrapes additional metadata
- Rate limited: 1 request per 10 seconds
- Caches for 7 days
```

## Loading Plugins

### Builtin plugins

```typescript
import { PluginManager } from '@/plugins/core/plugin-manager.js';
import { GitHubIntegrationPlugin } from '@/plugins/builtin/github-integration.js';

const manager = new PluginManager(
  logger,
  loader,
  contextFactory,
  eventBus,
  sandbox,
  resourceGovernor
);

// Load builtin plugin
const plugin = new GitHubIntegrationPlugin();
await manager.loadBuiltinPlugin(plugin);
```

### External plugins

```typescript
// Load from directory
await manager.loadPlugin({
  id: 'pub.chive.plugin.custom',
  name: 'Custom Plugin',
  version: '0.1.0',
  // ... manifest
});

// Scan directory for plugins
const manifests = await loader.scanDirectory('/path/to/plugins');
for (const manifest of manifests) {
  await manager.loadPlugin(manifest);
}
```

### Plugin lifecycle

```typescript
// Load and initialize
await manager.loadBuiltinPlugin(plugin);

// Check state
const state = manager.getPluginState(plugin.id);
// 'uninitialized' | 'initializing' | 'ready' | 'error' | 'shutdown'

// Reload (preserves config)
await manager.reloadPlugin(plugin.id);

// Unload
await manager.unloadPlugin(plugin.id);

// Shutdown all
await manager.shutdownAll();
```

### Plugin info

```typescript
// Get loaded plugins
const plugins = manager.getAllPlugins();

// Get plugin info
const info = manager.getPluginInfo();
for (const p of info) {
  console.log(`${p.name} v${p.version} - ${p.state}`);
}

// Get plugin count
const count = manager.getPluginCount();
```

## Testing Plugins

### Unit tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyPlugin } from './my-plugin.js';

describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let mockContext: IPluginContext;

  beforeEach(() => {
    mockContext = {
      logger: createMockLogger(),
      cache: createMockCache(),
      metrics: createMockMetrics(),
      eventBus: createMockEventBus(),
      config: {},
    };

    plugin = new MyPlugin();
  });

  it('should handle preprint.indexed event', async () => {
    await plugin.initialize(mockContext);

    // Trigger event
    mockContext.eventBus.emit('preprint.indexed', {
      uri: 'at://did:plc:abc/pub.chive.preprint.submission/xyz',
      title: 'Test Preprint',
    });

    // Verify cache was set
    expect(mockContext.cache.set).toHaveBeenCalled();
  });
});
```

### Integration tests

```bash
# Run plugin integration tests
npx vitest run tests/integration/plugins

# Run specific test file
npx vitest run tests/integration/plugins/plugin-lifecycle.test.ts
```

### Compliance tests

```bash
# Verify ATProto compliance
npx vitest run tests/compliance/plugin-atproto-compliance.test.ts
```

## ATProto Compliance

Plugins must follow ATProto compliance rules:

### What plugins CAN do

- Subscribe to firehose events (via event bus)
- Cache computed results (ephemeral, with TTL)
- Call external APIs (side effects like DOI registration)
- Read from user PDSes (via IRepository)

### What plugins CANNOT do

- Write to user PDSes
- Store blob data (only BlobRefs)
- Create non-rebuildable state
- Bypass permission checks

### Compliance checklist

```typescript
// Correct: Cache computed result
await context.cache.set('result', computed, 3600);

// Wrong: Store blob data
// await storage.storeBlob(pdfBuffer);

// Correct: Reference blob by CID
const blobRef = { $type: 'blob', ref: { $link: cid } };

// Wrong: Store blob content
// const content = await fetchBlob(cid);
// await database.insert({ content });
```

## Error Handling

### Plugin errors

```typescript
import { PluginError, PluginPermissionError, SandboxViolationError } from '@/types/errors.js';

try {
  await manager.loadPlugin(manifest);
} catch (error) {
  if (error instanceof PluginError) {
    // General plugin error
    console.log(`Plugin ${error.pluginId} failed: ${error.message}`);
  } else if (error instanceof PluginPermissionError) {
    // Permission violation
    console.log(`Permission denied: ${error.message}`);
  } else if (error instanceof SandboxViolationError) {
    // Sandbox security violation
    console.log(`Sandbox violation: ${error.message}`);
  }
}
```

### Manifest validation errors

```typescript
import { ManifestValidationError } from '@/types/errors.js';

const result = loader.validateManifest(manifest);
if (!result.ok) {
  const error = result.error as ManifestValidationError;
  for (const issue of error.errors) {
    console.log(`${issue.path}: ${issue.message}`);
  }
}
```

## Performance

### Best practices

1. **Batch operations**: Use cache batch operations when possible
2. **Async handlers**: Use async handlers to avoid blocking
3. **Debounce events**: Debounce high-frequency events
4. **Cache aggressively**: Cache external API results
5. **Respect rate limits**: Implement rate limiting for external APIs

### Metrics

Monitor plugin performance via built-in metrics:

```typescript
// In your plugin
context.metrics.observeHistogram('handler_duration', durationMs);
context.metrics.incrementCounter('events_processed', { status: 'success' });

// Query via Prometheus
# plugin_handler_duration_seconds{plugin_id="pub.chive.plugin.my-plugin"}
# plugin_events_processed_total{plugin_id="pub.chive.plugin.my-plugin",status="success"}
```

## Related Documentation

- [ATProto Specification](https://atproto.com/specs): Data sovereignty rules
- [Core Services Guide](./core-business-services.md): Service integration
- [API Layer Guide](./api-layer.md): HTTP endpoint integration
