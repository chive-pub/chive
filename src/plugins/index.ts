/**
 * Chive Plugin System.
 *
 * @remarks
 * This module provides the complete plugin system for Chive, including:
 * - Plugin lifecycle management (loading, unloading, reloading)
 * - Event bus with permission-enforced hooks
 * - Security sandbox with resource limits
 * - Builtin plugins for external integrations
 *
 * @example
 * ```typescript
 * import {
 *   PluginManager,
 *   PluginEventBus,
 *   registerPluginSystem,
 *   GitHubIntegrationPlugin,
 * } from './plugins';
 *
 * // Register plugin system with DI container
 * registerPluginSystem();
 *
 * // Get manager and load plugins
 * const manager = container.resolve(PluginManager);
 * await manager.loadBuiltinPlugin(new GitHubIntegrationPlugin(), {
 *   githubToken: process.env.GITHUB_TOKEN,
 * });
 * ```
 *
 * @packageDocumentation
 * @public
 */

// =============================================================================
// Core Plugin Infrastructure
// =============================================================================

export { PluginEventBus } from './core/event-bus.js';

export { ScopedPluginEventBus } from './core/scoped-event-bus.js';

export { PluginContextFactory } from './core/plugin-context.js';

export { PluginLoader } from './core/plugin-loader.js';

export { PluginManager } from './core/plugin-manager.js';

export { registerPluginSystem, getPluginManager, getEventBus } from './core/plugin-registry.js';

export {
  pluginManifestSchema,
  isValidPluginId,
  isValidSemver,
  isValidEntrypoint,
} from './core/manifest-schema.js';

export { ImportScheduler } from './core/import-scheduler.js';
export type {
  PluginScheduleConfig,
  ScheduledPluginState,
  ImportSchedulerOptions,
} from './core/import-scheduler.js';

// =============================================================================
// Sandbox and Security
// =============================================================================

export { IsolatedVmSandbox } from './sandbox/isolated-vm-sandbox.js';

export { PermissionEnforcer } from './sandbox/permission-enforcer.js';

export { ResourceGovernor, DEFAULT_RESOURCE_LIMITS } from './sandbox/resource-governor.js';

// =============================================================================
// Builtin Plugins
// =============================================================================

export { BasePlugin } from './builtin/base-plugin.js';

export { ImportingPlugin } from './core/importing-plugin.js';
export type { ImportCycleResult } from './core/importing-plugin.js';

export { GitHubIntegrationPlugin } from './builtin/github-integration.js';
export type { GitHubRepoInfo } from './builtin/github-integration.js';

export { OrcidLinkingPlugin } from './builtin/orcid-linking.js';
export type { OrcidProfile } from './builtin/orcid-linking.js';

export { DoiRegistrationPlugin } from './builtin/doi-registration.js';
export type { DoiMetadata, DoiAuthor } from './builtin/doi-registration.js';

export { SemanticsArchivePlugin } from './builtin/semantics-archive.js';
export type { SemanticsArchivePaper } from './builtin/semantics-archive.js';

export { LingBuzzPlugin } from './builtin/lingbuzz.js';
export type { LingBuzzPaper } from './builtin/lingbuzz.js';

export { ArxivPlugin } from './builtin/arxiv.js';
export type { ArxivPaper } from './builtin/arxiv.js';

export { SemanticScholarPlugin } from './builtin/semantic-scholar.js';
export type {
  SemanticScholarPaper,
  SemanticScholarAuthor,
  SemanticScholarAuthorRef,
  CitationEdge,
} from './builtin/semantic-scholar.js';

export { OpenAlexPlugin } from './builtin/openalex.js';
export type {
  OpenAlexWork,
  OpenAlexAuthor,
  OpenAlexAuthorship,
  OpenAlexConcept,
  OpenAlexLocation,
  OpenAlexTopic,
  OpenAlexKeyword,
  TextClassificationResult,
} from './builtin/openalex.js';

export { OpenReviewPlugin } from './builtin/openreview.js';
export type { OpenReviewPaper } from './builtin/openreview.js';

export { PsyArxivPlugin } from './builtin/psyarxiv.js';
export type { PsyArxivPaper } from './builtin/psyarxiv.js';

/**
 * There is no exported builtin-plugin registry.
 *
 * @remarks
 * There used to be two — `BUILTIN_PLUGINS` and `createBuiltinPlugins()` — and
 * neither was referenced anywhere. Each listed eight of the twenty-eight
 * plugins in `builtin/`, and a different eight from the five that
 * `src/index.ts` actually instantiates, so the codebase carried three disagreeing
 * answers to "which plugins are built in" and the only correct one was the one
 * that ran.
 *
 * `src/index.ts` remains the registry, and deliberately so: the plugins do not
 * share a shape. Search-based ones are loaded on demand, scraping ones are
 * handed to the import scheduler, and each is wrapped in its own error handling
 * so one failing to load does not take down startup. A flat array cannot
 * express that, which is why the arrays drifted from it.
 */
