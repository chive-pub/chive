/**
 * Plugin loader for discovery and code loading.
 *
 * @remarks
 * This module provides functionality for:
 * - Scanning directories for plugin manifests
 * - Validating manifests against JSON Schema
 * - Loading plugin code from entry points
 *
 * @packageDocumentation
 * @public
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';

import { singleton, inject } from 'tsyringe';

/**
 * AJV configuration options.
 *
 * @internal
 */
interface AjvOptions {
  allErrors?: boolean;
  verbose?: boolean;
  strict?: boolean;
}

/**
 * AJV validation error object shape.
 *
 * @internal
 */
interface AjvErrorObject {
  instancePath: string;
  message?: string;
}

/**
 * AJV validation function returned by compile().
 *
 * @internal
 */
interface AjvValidateFunction {
  (data: unknown): boolean;
  errors?: AjvErrorObject[] | null;
}

/**
 * AJV instance interface.
 *
 * @internal
 */
interface AjvInstance {
  compile(schema: unknown): AjvValidateFunction;
}

/**
 * AJV constructor type.
 *
 * @internal
 */
type AjvConstructor = new (options?: AjvOptions) => AjvInstance;

/**
 * ajv-formats addon function type.
 *
 * @internal
 */
type AddFormatsFunction = (ajv: AjvInstance) => AjvInstance;

/**
 * Expected shape of the AJV module when dynamically imported.
 *
 * @internal
 */
interface AjvModuleShape {
  default: AjvConstructor;
}

/**
 * Expected shape of the ajv-formats module when dynamically imported.
 *
 * @internal
 */
interface AddFormatsModuleShape {
  default: AddFormatsFunction;
}

/**
 * Type guard for AJV module shape.
 *
 * @param mod - Module to check
 * @returns True if module has expected AJV shape
 *
 * @internal
 */
function isAjvModule(mod: { default?: unknown }): mod is AjvModuleShape {
  return typeof mod.default === 'function';
}

/**
 * Type guard for ajv-formats module shape.
 *
 * @param mod - Module to check
 * @returns True if module has expected ajv-formats shape
 *
 * @internal
 */
function isAddFormatsModule(mod: { default?: unknown }): mod is AddFormatsModuleShape {
  return typeof mod.default === 'function';
}

import { ManifestValidationError, PluginError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  IPluginLoader,
  IPluginManifest,
  IChivePlugin,
  ManifestValidationResult,
} from '../../types/interfaces/plugin.interface.js';

import { pluginManifestSchema } from './manifest-schema.js';

/**
 * Plugin loader implementation.
 *
 * @remarks
 * Scans directories for plugin manifests, validates them with AJV,
 * and loads plugin code from entry points.
 *
 * @example
 * ```typescript
 * const loader = container.resolve(PluginLoader);
 *
 * // Scan directory for plugins
 * const manifests = await loader.scanDirectory('/path/to/plugins');
 *
 * // Validate a manifest
 * const result = loader.validateManifest(rawManifest);
 * if (result.ok) {
 *   console.log('Valid manifest:', result.value.id);
 * }
 *
 * // Load plugin code
 * const plugin = await loader.loadPluginCode(manifest);
 * ```
 *
 * @public
 */
@singleton()
export class PluginLoader implements IPluginLoader {
  /**
   * Logger instance.
   */
  private readonly logger: ILogger;

  /**
   * AJV validator instance (lazy-loaded for ESM compatibility).
   */
  private ajv: AjvInstance | null = null;

  /**
   * Compiled manifest schema validator (lazy-loaded for ESM compatibility).
   */
  private validateManifestSchema: AjvValidateFunction | null = null;

  /**
   * Creates a new PluginLoader.
   *
   * @param logger - Logger instance
   */
  constructor(@inject('ILogger') logger: ILogger) {
    this.logger = logger.child({ component: 'PluginLoader' });
    this.logger.debug('Plugin loader initialized');
  }

  /**
   * Ensures AJV is initialized (lazy loading for ESM compatibility).
   *
   * @remarks
   * AJV and ajv-formats are CommonJS packages that must be loaded via
   * dynamic import() in ESM environments. The type guards validate
   * the module shapes at runtime.
   *
   * @throws {PluginError} If AJV modules cannot be loaded or have invalid shape
   *
   * @internal
   */
  private async ensureAjvInitialized(): Promise<void> {
    if (this.ajv && this.validateManifestSchema) {
      return;
    }

    this.logger.debug('Initializing AJV validator');

    // Dynamic import for CommonJS modules (ESM compatibility)
    const ajvModule = await import('ajv');
    const addFormatsModule = await import('ajv-formats');

    // Validate module shapes at runtime using type guards
    if (!isAjvModule(ajvModule)) {
      throw new PluginError(
        'plugin-loader',
        'LOAD',
        'Failed to load AJV: module does not export expected default constructor'
      );
    }

    if (!isAddFormatsModule(addFormatsModule)) {
      throw new PluginError(
        'plugin-loader',
        'LOAD',
        'Failed to load ajv-formats: module does not export expected default function'
      );
    }

    const Ajv = ajvModule.default;
    const addFormats = addFormatsModule.default;

    // Initialize AJV with formats
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true,
    });
    addFormats(this.ajv);

    // Compile manifest schema
    this.validateManifestSchema = this.ajv.compile(pluginManifestSchema);

    this.logger.debug('AJV validator initialized');
  }

  /**
   * Scans a directory for plugin manifests.
   *
   * @param path - Directory path to scan
   * @returns Array of valid plugin manifests found
   *
   * @remarks
   * Scans each subdirectory for a plugin.json file, validates it,
   * and returns all valid manifests.
   *
   * @example
   * ```typescript
   * const manifests = await loader.scanDirectory('/opt/chive/plugins');
   * console.log(`Found ${manifests.length} plugins`);
   * ```
   *
   * @public
   */
  async scanDirectory(path: string): Promise<readonly IPluginManifest[]> {
    // Ensure AJV is initialized before scanning
    await this.ensureAjvInitialized();

    const resolvedPath = resolve(path);
    this.logger.info('Scanning plugin directory', { path: resolvedPath });

    const manifests: IPluginManifest[] = [];

    try {
      const entries = await readdir(resolvedPath);

      for (const entry of entries) {
        const entryPath = join(resolvedPath, entry);

        try {
          const entryStat = await stat(entryPath);

          if (entryStat.isDirectory()) {
            const manifestPath = join(entryPath, 'plugin.json');

            try {
              const manifestContent = await readFile(manifestPath, 'utf-8');
              const manifestData = JSON.parse(manifestContent) as unknown;
              const result = await this.validateManifest(manifestData);

              if (result.ok) {
                manifests.push(result.value);
                this.logger.debug('Found valid manifest', {
                  pluginId: result.value.id,
                  version: result.value.version,
                });
              } else {
                this.logger.warn('Invalid manifest', {
                  path: manifestPath,
                  errors: result.error.validationErrors,
                });
              }
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                this.logger.debug('No manifest found', { path: entryPath });
              } else if (err instanceof SyntaxError) {
                this.logger.warn('Invalid JSON in manifest', {
                  path: entryPath,
                  error: err.message,
                });
              } else {
                this.logger.warn('Error reading manifest', {
                  path: entryPath,
                  error: (err as Error).message,
                });
              }
            }
          }
        } catch (err) {
          this.logger.warn('Error scanning entry', {
            path: entryPath,
            error: (err as Error).message,
          });
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn('Plugin directory does not exist', { path: resolvedPath });
      } else {
        this.logger.error('Failed to scan directory', err as Error, { path: resolvedPath });
      }
    }

    this.logger.info('Scan complete', {
      path: resolvedPath,
      pluginCount: manifests.length,
    });

    return manifests;
  }

  /**
   * Validates a plugin manifest against the schema.
   *
   * @param manifest - Raw manifest data to validate
   * @returns Result with validated manifest or validation error
   *
   * @example
   * ```typescript
   * const result = await loader.validateManifest({
   *   id: 'pub.chive.plugin.github',
   *   name: 'GitHub Integration',
   *   version: '0.1.0',
   *   // ...
   * });
   *
   * if (result.ok) {
   *   console.log('Valid:', result.value.id);
   * } else {
   *   console.error('Errors:', result.error.validationErrors);
   * }
   * ```
   *
   * @public
   */
  async validateManifest(manifest: unknown): Promise<ManifestValidationResult> {
    // Ensure AJV is initialized
    await this.ensureAjvInitialized();

    // Get the schema validator (guaranteed non-null after initialization)
    const schemaValidator = this.validateManifestSchema;
    if (!schemaValidator) {
      return {
        ok: false,
        error: new ManifestValidationError(['Schema validator not initialized']),
      };
    }

    const valid = schemaValidator(manifest);

    if (valid) {
      return { ok: true, value: manifest as IPluginManifest };
    }

    const errors = schemaValidator.errors?.map((err) => {
      const path = err.instancePath || '/';
      return `${path}: ${err.message}`;
    }) ?? ['Unknown validation error'];

    return { ok: false, error: new ManifestValidationError(errors) };
  }

  /**
   * Loads plugin code from manifest entry point.
   *
   * @param manifest - Plugin manifest
   * @returns Plugin instance
   * @throws {PluginError} If code loading fails
   *
   * @remarks
   * For builtin plugins, use direct imports instead of this method.
   * This method is intended for third-party plugins loaded from filesystem.
   *
   * @example
   * ```typescript
   * const plugin = await loader.loadPluginCode(manifest);
   * console.log('Loaded:', plugin.id);
   * ```
   *
   * @public
   */
  async loadPluginCode(manifest: IPluginManifest): Promise<IChivePlugin> {
    this.logger.info('Loading plugin code', {
      pluginId: manifest.id,
      entrypoint: manifest.entrypoint,
    });

    try {
      // Dynamic import of plugin entry point
      const modulePath = manifest.entrypoint;
      const moduleExport: unknown = await import(modulePath);

      // Type guard for module shape
      const module = moduleExport as { default?: unknown };
      const PluginClass = module.default;

      // Type guard for constructor function
      const isConstructor = (
        fn: unknown
      ): fn is new (manifest: IPluginManifest) => IChivePlugin => {
        return typeof fn === 'function';
      };

      if (isConstructor(PluginClass)) {
        const plugin = new PluginClass(manifest);

        // Validate plugin implements required interface
        if (!this.isValidPlugin(plugin)) {
          throw new PluginError(
            manifest.id,
            'LOAD',
            'Plugin does not implement IChivePlugin interface'
          );
        }

        const pluginClassName = PluginClass.name ?? 'AnonymousPlugin';

        this.logger.info('Plugin code loaded', {
          pluginId: manifest.id,
          pluginClass: pluginClassName,
        });

        return plugin;
      }

      throw new PluginError(
        manifest.id,
        'LOAD',
        'Plugin must export a class or factory function as default'
      );
    } catch (err) {
      this.logger.error('Failed to load plugin code', err as Error, {
        pluginId: manifest.id,
        entrypoint: manifest.entrypoint,
      });

      throw new PluginError(
        manifest.id,
        'LOAD',
        `Failed to load plugin: ${(err as Error).message}`,
        err as Error
      );
    }
  }

  /**
   * Validates that an object implements IChivePlugin.
   *
   * @param obj - Object to validate
   * @returns True if valid plugin
   *
   * @internal
   */
  private isValidPlugin(obj: unknown): obj is IChivePlugin {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const plugin = obj as Record<string, unknown>;

    return (
      typeof plugin.id === 'string' &&
      typeof plugin.manifest === 'object' &&
      typeof plugin.initialize === 'function' &&
      typeof plugin.shutdown === 'function' &&
      typeof plugin.getState === 'function'
    );
  }
}
