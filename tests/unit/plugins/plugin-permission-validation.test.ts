/**
 * Plugin permission validation tests.
 *
 * @remarks
 * Validates that all ImportingPlugin subclasses declare the required
 * hooks that the base class emits. This catches permission mismatches
 * that would cause runtime PluginPermissionError.
 *
 * Background: The ImportingPlugin base class emits 'import.created' and
 * 'import.updated' events, but subclasses were only declaring 'import.updated'
 * in their manifests, causing permission errors at runtime.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect } from 'vitest';

import { LingBuzzPlugin } from '@/plugins/builtin/lingbuzz.js';
import { SemanticsArchivePlugin } from '@/plugins/builtin/semantics-archive.js';

describe('Plugin Permission Validation', () => {
  describe('ImportingPlugin subclasses', () => {
    describe('SemanticsArchivePlugin', () => {
      const plugin = new SemanticsArchivePlugin();

      it('declares import.created hook permission', () => {
        const hooks = plugin.manifest.permissions.hooks ?? [];
        expect(hooks).toContain('import.created');
      });

      it('declares import.updated hook permission', () => {
        const hooks = plugin.manifest.permissions.hooks ?? [];
        expect(hooks).toContain('import.updated');
      });

      it('declares system.startup hook permission', () => {
        const hooks = plugin.manifest.permissions.hooks ?? [];
        expect(hooks).toContain('system.startup');
      });

      it('has all required hooks for ImportingPlugin base class', () => {
        const hooks = plugin.manifest.permissions.hooks ?? [];
        // ImportingPlugin emits these events, so all subclasses must declare them
        const requiredHooks = ['import.created', 'import.updated'];
        for (const hook of requiredHooks) {
          expect(hooks).toContain(hook);
        }
      });
    });

    describe('LingBuzzPlugin', () => {
      const plugin = new LingBuzzPlugin();

      it('declares import.created hook permission', () => {
        const hooks = plugin.manifest.permissions.hooks ?? [];
        expect(hooks).toContain('import.created');
      });

      it('declares import.updated hook permission', () => {
        const hooks = plugin.manifest.permissions.hooks ?? [];
        expect(hooks).toContain('import.updated');
      });

      it('declares system.startup hook permission', () => {
        const hooks = plugin.manifest.permissions.hooks ?? [];
        expect(hooks).toContain('system.startup');
      });

      it('has all required hooks for ImportingPlugin base class', () => {
        const hooks = plugin.manifest.permissions.hooks ?? [];
        // ImportingPlugin emits these events, so all subclasses must declare them
        const requiredHooks = ['import.created', 'import.updated'];
        for (const hook of requiredHooks) {
          expect(hooks).toContain(hook);
        }
      });
    });
  });

  describe('Permission structure', () => {
    it('SemanticsArchivePlugin has valid permission structure', () => {
      const plugin = new SemanticsArchivePlugin();
      const { permissions } = plugin.manifest;

      expect(permissions).toBeDefined();
      expect(permissions.hooks).toBeDefined();
      expect(Array.isArray(permissions.hooks)).toBe(true);
      expect(permissions.network).toBeDefined();
      expect(permissions.network?.allowedDomains).toBeDefined();
      expect(permissions.storage).toBeDefined();
    });

    it('LingBuzzPlugin has valid permission structure', () => {
      const plugin = new LingBuzzPlugin();
      const { permissions } = plugin.manifest;

      expect(permissions).toBeDefined();
      expect(permissions.hooks).toBeDefined();
      expect(Array.isArray(permissions.hooks)).toBe(true);
      expect(permissions.network).toBeDefined();
      expect(permissions.network?.allowedDomains).toBeDefined();
      expect(permissions.storage).toBeDefined();
    });
  });

  describe('Network permissions', () => {
    it('SemanticsArchivePlugin only allows semanticsarchive.net', () => {
      const plugin = new SemanticsArchivePlugin();
      const domains = plugin.manifest.permissions.network?.allowedDomains ?? [];

      expect(domains).toContain('semanticsarchive.net');
      expect(domains).not.toContain('example.com');
    });

    it('LingBuzzPlugin only allows lingbuzz.net', () => {
      const plugin = new LingBuzzPlugin();
      const domains = plugin.manifest.permissions.network?.allowedDomains ?? [];

      expect(domains).toContain('lingbuzz.net');
      expect(domains).not.toContain('example.com');
    });
  });
});
