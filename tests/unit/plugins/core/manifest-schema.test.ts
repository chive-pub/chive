/**
 * Unit tests for plugin manifest schema and validators.
 *
 * @remarks
 * Tests manifest schema validation, plugin ID validation, semver validation,
 * and entrypoint validation.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';

import {
  pluginManifestSchema,
  isValidPluginId,
  isValidSemver,
  isValidEntrypoint,
  DEFAULT_PLUGIN_LIMITS,
  ALLOWED_LICENSES,
} from '@/plugins/core/manifest-schema.js';

describe('manifest-schema', () => {
  describe('pluginManifestSchema', () => {
    it('should have correct $schema', () => {
      expect(pluginManifestSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    });

    it('should have correct $id', () => {
      expect(pluginManifestSchema.$id).toBe('https://chive.pub/schemas/plugin-manifest.json');
    });

    it('should require all mandatory fields', () => {
      expect(pluginManifestSchema.required).toContain('id');
      expect(pluginManifestSchema.required).toContain('name');
      expect(pluginManifestSchema.required).toContain('version');
      expect(pluginManifestSchema.required).toContain('description');
      expect(pluginManifestSchema.required).toContain('author');
      expect(pluginManifestSchema.required).toContain('license');
      expect(pluginManifestSchema.required).toContain('permissions');
      expect(pluginManifestSchema.required).toContain('entrypoint');
    });

    it('should define id property with pattern', () => {
      const idProp = pluginManifestSchema.properties.id;
      expect(idProp.type).toBe('string');
      expect(idProp.pattern).toBeDefined();
      expect(idProp.minLength).toBe(3);
      expect(idProp.maxLength).toBe(128);
    });

    it('should define version property with semver pattern', () => {
      const versionProp = pluginManifestSchema.properties.version;
      expect(versionProp.type).toBe('string');
      expect(versionProp.pattern).toBeDefined();
    });

    it('should define license property with allowed values', () => {
      const licenseProp = pluginManifestSchema.properties.license;
      expect(licenseProp.type).toBe('string');
      expect(licenseProp.enum).toContain('MIT');
      expect(licenseProp.enum).toContain('Apache-2.0');
      expect(licenseProp.enum).toContain('GPL-3.0');
    });

    it('should define entrypoint property with .js/.mjs pattern', () => {
      const entrypointProp = pluginManifestSchema.properties.entrypoint;
      expect(entrypointProp.type).toBe('string');
      expect(entrypointProp.pattern).toMatch(/js|mjs/);
    });

    it('should disallow additional properties', () => {
      expect(pluginManifestSchema.additionalProperties).toBe(false);
    });
  });

  describe('isValidPluginId', () => {
    it('should accept valid reverse domain notation', () => {
      expect(isValidPluginId('pub.chive.plugin.github')).toBe(true);
      expect(isValidPluginId('org.example.my-plugin')).toBe(true);
      expect(isValidPluginId('com.company.plugin123')).toBe(true);
    });

    it('should accept plugin IDs with hyphens', () => {
      expect(isValidPluginId('pub.chive.plugin.my-plugin')).toBe(true);
      expect(isValidPluginId('org.example.super-cool-plugin')).toBe(true);
    });

    it('should reject IDs without domain notation', () => {
      expect(isValidPluginId('my-plugin')).toBe(false);
      expect(isValidPluginId('plugin')).toBe(false);
    });

    it('should reject IDs with uppercase letters', () => {
      expect(isValidPluginId('pub.Chive.plugin.github')).toBe(false);
      expect(isValidPluginId('Pub.chive.plugin.github')).toBe(false);
    });

    it('should reject IDs starting with numbers', () => {
      expect(isValidPluginId('1pub.chive.plugin.github')).toBe(false);
      expect(isValidPluginId('pub.1chive.plugin')).toBe(false);
    });

    it('should reject IDs that are too short', () => {
      // The minimum length is 3 characters, 'a.b' is exactly 3 so it passes
      // We need to test with something shorter
      expect(isValidPluginId('ab')).toBe(false);
    });

    it('should reject IDs that are too long', () => {
      const longId = 'a.' + 'b'.repeat(130);
      expect(isValidPluginId(longId)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidPluginId('')).toBe(false);
    });

    it('should reject IDs with special characters', () => {
      expect(isValidPluginId('pub.chive.plugin@github')).toBe(false);
      expect(isValidPluginId('pub.chive.plugin_github')).toBe(false);
      expect(isValidPluginId('pub.chive.plugin/github')).toBe(false);
    });
  });

  describe('isValidSemver', () => {
    it('should accept valid semver versions', () => {
      expect(isValidSemver('1.0.0')).toBe(true);
      expect(isValidSemver('0.0.1')).toBe(true);
      expect(isValidSemver('10.20.30')).toBe(true);
    });

    it('should accept versions with prerelease', () => {
      expect(isValidSemver('1.0.0-alpha')).toBe(true);
      expect(isValidSemver('1.0.0-alpha.1')).toBe(true);
      expect(isValidSemver('1.0.0-beta.2')).toBe(true);
      expect(isValidSemver('1.0.0-rc.1')).toBe(true);
    });

    it('should accept versions with build metadata', () => {
      expect(isValidSemver('1.0.0+build')).toBe(true);
      expect(isValidSemver('1.0.0+build.123')).toBe(true);
      expect(isValidSemver('1.0.0-alpha+build')).toBe(true);
    });

    it('should reject versions with v prefix', () => {
      expect(isValidSemver('v1.0.0')).toBe(false);
    });

    it('should reject versions without patch number', () => {
      expect(isValidSemver('1.0')).toBe(false);
      expect(isValidSemver('1')).toBe(false);
    });

    it('should reject versions with leading zeros', () => {
      expect(isValidSemver('01.0.0')).toBe(false);
      expect(isValidSemver('1.00.0')).toBe(false);
      expect(isValidSemver('1.0.00')).toBe(false);
    });

    it('should reject invalid formats', () => {
      expect(isValidSemver('')).toBe(false);
      expect(isValidSemver('1.0.0.0')).toBe(false);
      expect(isValidSemver('1.0.a')).toBe(false);
      expect(isValidSemver('latest')).toBe(false);
    });
  });

  describe('isValidEntrypoint', () => {
    it('should accept valid .js entrypoints', () => {
      expect(isValidEntrypoint('index.js')).toBe(true);
      expect(isValidEntrypoint('dist/index.js')).toBe(true);
      expect(isValidEntrypoint('lib/main.js')).toBe(true);
    });

    it('should accept valid .mjs entrypoints', () => {
      expect(isValidEntrypoint('index.mjs')).toBe(true);
      expect(isValidEntrypoint('dist/main.mjs')).toBe(true);
    });

    it('should reject TypeScript files', () => {
      expect(isValidEntrypoint('index.ts')).toBe(false);
      expect(isValidEntrypoint('dist/main.tsx')).toBe(false);
    });

    it('should reject path traversal', () => {
      expect(isValidEntrypoint('../index.js')).toBe(false);
      expect(isValidEntrypoint('dist/../index.js')).toBe(false);
      expect(isValidEntrypoint('..\\index.js')).toBe(false);
    });

    it('should reject absolute paths', () => {
      expect(isValidEntrypoint('/home/user/index.js')).toBe(false);
      expect(isValidEntrypoint('/dist/index.js')).toBe(false);
    });

    it('should reject paths that are too long', () => {
      const longPath = 'a/'.repeat(150) + 'index.js';
      expect(isValidEntrypoint(longPath)).toBe(false);
    });

    it('should reject files without .js or .mjs extension', () => {
      expect(isValidEntrypoint('index.json')).toBe(false);
      expect(isValidEntrypoint('index.cjs')).toBe(false);
      expect(isValidEntrypoint('index')).toBe(false);
    });
  });

  describe('DEFAULT_PLUGIN_LIMITS', () => {
    it('should have reasonable memory limit', () => {
      expect(DEFAULT_PLUGIN_LIMITS.maxMemoryMB).toBe(128);
    });

    it('should have reasonable CPU limit', () => {
      expect(DEFAULT_PLUGIN_LIMITS.maxCpuPercent).toBe(10);
    });

    it('should have reasonable execution timeout', () => {
      expect(DEFAULT_PLUGIN_LIMITS.maxExecutionTimeMs).toBe(5000);
    });

    it('should have reasonable storage quota', () => {
      expect(DEFAULT_PLUGIN_LIMITS.maxStorageBytes).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should have reasonable domain limit', () => {
      expect(DEFAULT_PLUGIN_LIMITS.maxAllowedDomains).toBe(20);
    });

    it('should have reasonable hooks limit', () => {
      expect(DEFAULT_PLUGIN_LIMITS.maxAllowedHooks).toBe(50);
    });
  });

  describe('ALLOWED_LICENSES', () => {
    it('should include common open source licenses', () => {
      expect(ALLOWED_LICENSES).toContain('MIT');
      expect(ALLOWED_LICENSES).toContain('Apache-2.0');
      expect(ALLOWED_LICENSES).toContain('GPL-3.0');
      expect(ALLOWED_LICENSES).toContain('BSD-3-Clause');
      expect(ALLOWED_LICENSES).toContain('ISC');
    });

    it('should include copyleft licenses', () => {
      expect(ALLOWED_LICENSES).toContain('AGPL-3.0');
      expect(ALLOWED_LICENSES).toContain('LGPL-3.0');
      expect(ALLOWED_LICENSES).toContain('MPL-2.0');
    });

    it('should include UNLICENSED option', () => {
      expect(ALLOWED_LICENSES).toContain('UNLICENSED');
    });

    it('should include Unlicense option', () => {
      expect(ALLOWED_LICENSES).toContain('Unlicense');
    });
  });
});
