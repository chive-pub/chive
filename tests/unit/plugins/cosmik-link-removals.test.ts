/**
 * Tests for the CosmikLinkRemovalsPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, beforeEach } from 'vitest';

import { CosmikLinkRemovalsPlugin } from '@/plugins/builtin/cosmik-link-removals.js';

describe('CosmikLinkRemovalsPlugin', () => {
  let plugin: CosmikLinkRemovalsPlugin;

  beforeEach(() => {
    plugin = new CosmikLinkRemovalsPlugin();
  });

  describe('metadata', () => {
    it('has correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.cosmik-link-removals');
    });

    it('declares correct firehose hook permission', () => {
      const hooks = plugin.manifest.permissions.hooks ?? [];
      expect(hooks).toContain('firehose.network.cosmik.collectionLinkRemoval');
    });

    it('has a valid version', () => {
      expect(plugin.manifest.version).toBe('0.5.2');
    });
  });
});
