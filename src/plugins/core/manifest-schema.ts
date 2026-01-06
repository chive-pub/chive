/**
 * JSON Schema for plugin manifest validation.
 *
 * @remarks
 * This module defines the JSON Schema used to validate plugin manifests
 * (plugin.json files) during plugin loading. Validation is performed
 * using AJV (Another JSON Validator).
 *
 * The schema enforces:
 * - Required fields (id, name, version, etc.)
 * - Format constraints (semver, reverse domain notation)
 * - Permission declarations
 * - Resource limits
 *
 * @packageDocumentation
 * @public
 */

// Note: We use a plain object schema rather than JSONSchemaType<T> for better flexibility
// with AJV's format validators and optional fields

import type { IPluginManifest as _IPluginManifest } from '../../types/interfaces/plugin.interface.js';

/**
 * JSON Schema for plugin permissions.
 *
 * @internal
 */
const pluginPermissionsSchema = {
  type: 'object',
  properties: {
    network: {
      type: 'object',
      properties: {
        allowedDomains: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 20,
          uniqueItems: true,
          description: 'Domains the plugin can make HTTP requests to',
        },
      },
      required: ['allowedDomains'],
      additionalProperties: false,
    },
    storage: {
      type: 'object',
      properties: {
        maxSize: {
          type: 'number',
          minimum: 0,
          maximum: 104857600, // 100MB max
          description: 'Maximum storage size in bytes',
        },
      },
      required: ['maxSize'],
      additionalProperties: false,
    },
    hooks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 50,
      uniqueItems: true,
      description: 'Event hooks the plugin can subscribe to',
    },
  },
  additionalProperties: false,
} as const;

/**
 * JSON Schema for plugin manifest validation.
 *
 * @remarks
 * This schema validates plugin.json files according to Chive's plugin
 * manifest specification. All plugins must pass validation before loading.
 *
 * @example
 * ```typescript
 * import Ajv from 'ajv';
 * import addFormats from 'ajv-formats';
 * import { pluginManifestSchema } from './manifest-schema.js';
 *
 * const ajv = new Ajv({ allErrors: true });
 * addFormats(ajv);
 *
 * const validate = ajv.compile(pluginManifestSchema);
 * const isValid = validate(manifestData);
 *
 * if (!isValid) {
 *   console.error('Validation errors:', validate.errors);
 * }
 * ```
 *
 * @public
 */
export const pluginManifestSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://chive.pub/schemas/plugin-manifest.json',
  title: 'Chive Plugin Manifest',
  description: 'Schema for Chive plugin manifest files (plugin.json)',
  type: 'object',
  required: [
    'id',
    'name',
    'version',
    'description',
    'author',
    'license',
    'permissions',
    'entrypoint',
  ],
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-z][a-z0-9]*(\\.[a-z][a-z0-9-]*)+$',
      minLength: 3,
      maxLength: 128,
      description:
        'Unique plugin identifier in reverse domain notation (e.g., "pub.chive.plugin.github")',
      examples: ['pub.chive.plugin.github', 'org.orcid.chive-integration', 'com.example.my-plugin'],
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Human-readable plugin name',
      examples: ['GitHub Integration', 'ORCID Linking'],
    },
    version: {
      type: 'string',
      pattern:
        '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$',
      description: 'Semantic version (semver 2.0)',
      examples: ['1.0.0', '2.1.3-beta.1', '0.9.0+build.123'],
    },
    description: {
      type: 'string',
      minLength: 10,
      maxLength: 500,
      description: 'Brief description of what the plugin does',
    },
    author: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
      description: 'Author name or organization',
      examples: ['Chive Team', 'Jane Doe <jane@example.com>'],
    },
    license: {
      type: 'string',
      enum: [
        'MIT',
        'Apache-2.0',
        'GPL-3.0',
        'GPL-3.0-only',
        'GPL-3.0-or-later',
        'BSD-2-Clause',
        'BSD-3-Clause',
        'ISC',
        'MPL-2.0',
        'LGPL-3.0',
        'AGPL-3.0',
        'Unlicense',
        'UNLICENSED',
      ],
      description: 'SPDX license identifier',
    },
    permissions: pluginPermissionsSchema,
    entrypoint: {
      type: 'string',
      pattern: '^[a-zA-Z0-9_\\-./]+\\.(js|mjs)$',
      maxLength: 256,
      description: 'Relative path to plugin entry point',
      examples: ['dist/index.js', 'lib/main.mjs'],
    },
    dependencies: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-z][a-z0-9]*(\\.[a-z][a-z0-9-]*)+$',
      },
      maxItems: 10,
      uniqueItems: true,
      description: 'Plugin dependencies (other plugin IDs that must be loaded first)',
    },
  },
  additionalProperties: false,
} as const;

/**
 * Default resource limits for plugins.
 *
 * @remarks
 * These limits are applied when not explicitly specified in the manifest.
 *
 * @public
 */
export const DEFAULT_PLUGIN_LIMITS = {
  /**
   * Default memory limit in megabytes.
   */
  maxMemoryMB: 128,

  /**
   * Default CPU percentage limit.
   */
  maxCpuPercent: 10,

  /**
   * Default execution time limit in milliseconds.
   */
  maxExecutionTimeMs: 5000,

  /**
   * Default storage quota in bytes (10MB).
   */
  maxStorageBytes: 10 * 1024 * 1024,

  /**
   * Maximum allowed domains in network permissions.
   */
  maxAllowedDomains: 20,

  /**
   * Maximum allowed hooks.
   */
  maxAllowedHooks: 50,
} as const;

/**
 * SPDX license identifiers allowed for plugins.
 *
 * @public
 */
export const ALLOWED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'LGPL-3.0',
  'AGPL-3.0',
  'Unlicense',
  'UNLICENSED',
] as const;

/**
 * Type for allowed SPDX licenses.
 *
 * @public
 */
export type AllowedLicense = (typeof ALLOWED_LICENSES)[number];

/**
 * Validates a plugin ID format.
 *
 * @param id - Plugin ID to validate
 * @returns True if valid reverse domain notation
 *
 * @example
 * ```typescript
 * isValidPluginId('pub.chive.plugin.github'); // true
 * isValidPluginId('my-plugin'); // false (not reverse domain)
 * isValidPluginId('Com.Example.Plugin'); // false (uppercase not allowed)
 * ```
 *
 * @public
 */
export function isValidPluginId(id: string): boolean {
  const pattern = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
  return pattern.test(id) && id.length >= 3 && id.length <= 128;
}

/**
 * Validates a semantic version string.
 *
 * @param version - Version string to validate
 * @returns True if valid semver 2.0
 *
 * @example
 * ```typescript
 * isValidSemver('1.0.0'); // true
 * isValidSemver('2.1.3-beta.1'); // true
 * isValidSemver('v1.0.0'); // false (no 'v' prefix allowed)
 * isValidSemver('1.0'); // false (patch version required)
 * ```
 *
 * @public
 */
export function isValidSemver(version: string): boolean {
  const pattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return pattern.test(version);
}

/**
 * Validates a plugin entry point path.
 *
 * @param entrypoint - Entry point path to validate
 * @returns True if valid entry point path
 *
 * @example
 * ```typescript
 * isValidEntrypoint('dist/index.js'); // true
 * isValidEntrypoint('lib/main.mjs'); // true
 * isValidEntrypoint('../outside.js'); // false (path traversal)
 * isValidEntrypoint('index.ts'); // false (TypeScript not allowed)
 * ```
 *
 * @public
 */
export function isValidEntrypoint(entrypoint: string): boolean {
  // Must end with .js or .mjs
  if (!entrypoint.endsWith('.js') && !entrypoint.endsWith('.mjs')) {
    return false;
  }

  // No path traversal
  if (entrypoint.includes('..')) {
    return false;
  }

  // No absolute paths
  if (entrypoint.startsWith('/')) {
    return false;
  }

  // Max length
  if (entrypoint.length > 256) {
    return false;
  }

  return true;
}
