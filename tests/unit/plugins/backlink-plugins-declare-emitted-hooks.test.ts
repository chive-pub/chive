/**
 * Every backlink plugin must declare the hooks its base class emits.
 *
 * @remarks
 * `BacklinkTrackingPlugin` emits `backlink.created` and `backlink.deleted`
 * after each write, and `ScopedPluginEventBus` enforces emit permission from
 * the plugin's own manifest. An undeclared hook therefore throws *after* the
 * write, inside the handler's catch, which logs a warning and abandons the
 * remaining references on that record. Declaring the collection a plugin reads
 * is not enough; it must also declare what it emits.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { BlueskyBacklinksPlugin } from '@/plugins/builtin/bluesky-backlinks.js';
import { CalendarEventsPlugin } from '@/plugins/builtin/calendar-events.js';
import { CosmikBacklinksPlugin } from '@/plugins/builtin/cosmik-backlinks.js';
import { CosmikConnectionsPlugin } from '@/plugins/builtin/cosmik-connections.js';
import { LeafletBacklinksPlugin } from '@/plugins/builtin/leaflet-backlinks.js';
import { MarginNotesPlugin, MarginRepliesPlugin } from '@/plugins/builtin/margin-annotations.js';
import { StandardSiteBacklinksPlugin } from '@/plugins/builtin/standard-site-backlinks.js';

/**
 * Hooks {@link BacklinkTrackingPlugin} emits on behalf of every subclass.
 */
const EMITTED_HOOKS = ['backlink.created', 'backlink.deleted'] as const;

const PLUGINS = [
  new BlueskyBacklinksPlugin(),
  new CalendarEventsPlugin(),
  new CosmikBacklinksPlugin(),
  new CosmikConnectionsPlugin(),
  new LeafletBacklinksPlugin(),
  new MarginNotesPlugin(),
  new MarginRepliesPlugin(),
  new StandardSiteBacklinksPlugin(),
];

describe('backlink plugin manifests', () => {
  it.each(PLUGINS.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s declares the hooks it emits',
    (_id, plugin) => {
      const hooks = plugin.manifest.permissions?.hooks ?? [];

      for (const hook of EMITTED_HOOKS) {
        expect(hooks).toContain(hook);
      }
    }
  );

  it.each(PLUGINS.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s still declares the collection it reads',
    (_id, plugin) => {
      const hooks = plugin.manifest.permissions?.hooks ?? [];

      expect(hooks.some((hook) => hook.startsWith('firehose.'))).toBe(true);
    }
  );
});
