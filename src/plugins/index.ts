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

// =============================================================================
// All Builtin Plugins (for convenience)
// =============================================================================

import { ArxivPlugin } from './builtin/arxiv.js';
import { DoiRegistrationPlugin } from './builtin/doi-registration.js';
import { GitHubIntegrationPlugin } from './builtin/github-integration.js';
import { LingBuzzPlugin } from './builtin/lingbuzz.js';
import { OpenAlexPlugin } from './builtin/openalex.js';
import { OrcidLinkingPlugin } from './builtin/orcid-linking.js';
import { SemanticScholarPlugin } from './builtin/semantic-scholar.js';
import { SemanticsArchivePlugin } from './builtin/semantics-archive.js';

/**
 * All builtin plugin classes.
 *
 * @remarks
 * Use this to instantiate all builtin plugins at once.
 *
 * @example
 * ```typescript
 * import { BUILTIN_PLUGINS, PluginManager } from './plugins';
 *
 * for (const PluginClass of BUILTIN_PLUGINS) {
 *   await manager.loadBuiltinPlugin(new PluginClass());
 * }
 * ```
 *
 * @public
 */
export const BUILTIN_PLUGINS = [
  ArxivPlugin,
  GitHubIntegrationPlugin,
  OrcidLinkingPlugin,
  DoiRegistrationPlugin,
  SemanticsArchivePlugin,
  LingBuzzPlugin,
  SemanticScholarPlugin,
  OpenAlexPlugin,
] as const;

/**
 * Creates instances of all builtin plugins.
 *
 * @returns Array of builtin plugin instances
 *
 * @example
 * ```typescript
 * import { createBuiltinPlugins, PluginManager } from './plugins';
 *
 * const plugins = createBuiltinPlugins();
 * for (const plugin of plugins) {
 *   await manager.loadBuiltinPlugin(plugin);
 * }
 * ```
 *
 * @public
 */
export function createBuiltinPlugins(): readonly [
  ArxivPlugin,
  GitHubIntegrationPlugin,
  OrcidLinkingPlugin,
  DoiRegistrationPlugin,
  SemanticsArchivePlugin,
  LingBuzzPlugin,
  SemanticScholarPlugin,
  OpenAlexPlugin,
] {
  return [
    new ArxivPlugin(),
    new GitHubIntegrationPlugin(),
    new OrcidLinkingPlugin(),
    new DoiRegistrationPlugin(),
    new SemanticsArchivePlugin(),
    new LingBuzzPlugin(),
    new SemanticScholarPlugin(),
    new OpenAlexPlugin(),
  ] as const;
}
