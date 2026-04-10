/**
 * Tests for the CosmikFollowsPlugin.
 *
 * @packageDocumentation
 */

import 'reflect-metadata';

import { describe, it, expect, beforeEach } from 'vitest';

import { CosmikFollowsPlugin } from '@/plugins/builtin/cosmik-follows.js';

describe('CosmikFollowsPlugin', () => {
  let plugin: CosmikFollowsPlugin;

  beforeEach(() => {
    plugin = new CosmikFollowsPlugin();
  });

  describe('metadata', () => {
    it('has correct plugin ID', () => {
      expect(plugin.id).toBe('pub.chive.plugin.cosmik-follows');
    });

    it('declares correct firehose hook permission', () => {
      const hooks = plugin.manifest.permissions.hooks ?? [];
      expect(hooks).toContain('firehose.network.cosmik.follow');
    });

    it('has a valid version', () => {
      expect(plugin.manifest.version).toBe('0.5.2');
    });
  });
});
