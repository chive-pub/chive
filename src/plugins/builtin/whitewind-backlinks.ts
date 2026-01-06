/**
 * WhiteWind backlinks tracking plugin.
 *
 * @remarks
 * Tracks references to Chive preprints from WhiteWind blog posts.
 * WhiteWind (https://whitewind.pages.dev) is an ATProto-based blogging
 * platform that allows users to write long-form content.
 *
 * When a WhiteWind blog post mentions or embeds a Chive preprint,
 * this plugin creates a backlink for aggregation and discovery.
 *
 * Blog entry schema: com.whitewind.blog.entry
 *
 * ATProto Compliance:
 * - All backlinks indexed from firehose (rebuildable via replay)
 * - Tracks deletions to honor record removal
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type {
  BacklinkSourceType,
  IPluginManifest,
} from '../../types/interfaces/plugin.interface.js';
import { BacklinkTrackingPlugin } from '../core/backlink-plugin.js';

/**
 * WhiteWind blog entry record structure.
 *
 * @internal
 */
interface WhiteWindEntry {
  $type: 'com.whitewind.blog.entry';
  title: string;
  content: string;
  contentFormat: 'markdown' | 'html' | 'plaintext';
  visibility: 'public' | 'unlisted' | 'private';
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  embed?: WhiteWindEmbed;
}

/**
 * WhiteWind embed structure for embedded records.
 *
 * @internal
 */
interface WhiteWindEmbed {
  $type: 'com.whitewind.blog.embed#record';
  uri: string;
  cid?: string;
}

/**
 * WhiteWind backlinks tracking plugin.
 *
 * @remarks
 * Tracks preprint references in WhiteWind blog posts via firehose
 * and creates backlinks for discovery and aggregation.
 *
 * Extracts references from:
 * - Embedded records (explicit embeds)
 * - Markdown content (AT-URI links in text)
 *
 * Only processes public blog posts to respect privacy.
 *
 * @example
 * ```typescript
 * const plugin = new WhiteWindBacklinksPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 * ```
 *
 * @public
 */
export class WhiteWindBacklinksPlugin extends BacklinkTrackingPlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.whitewind-backlinks';

  /**
   * ATProto collection to track.
   */
  readonly trackedCollection = 'com.whitewind.blog.entry';

  /**
   * Backlink source type.
   */
  readonly sourceType: BacklinkSourceType = 'whitewind.blog';

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.whitewind-backlinks',
    name: 'WhiteWind Backlinks',
    version: '0.1.0',
    description: 'Tracks references to Chive preprints from WhiteWind blog posts',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.com.whitewind.blog.entry'],
      storage: {
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    entrypoint: 'whitewind-backlinks.js',
  };

  /**
   * Extracts preprint AT-URIs from a WhiteWind blog entry.
   *
   * @param record - WhiteWind entry record
   * @returns Array of preprint AT-URIs
   */
  extractPreprintRefs(record: unknown): string[] {
    const entry = record as WhiteWindEntry;
    const refs: string[] = [];

    // Check embedded record
    if (entry.embed && this.isPreprintUri(entry.embed.uri)) {
      refs.push(entry.embed.uri);
    }

    // Extract AT-URIs from markdown content
    if (entry.content && (entry.contentFormat === 'markdown' || entry.contentFormat === 'html')) {
      const textRefs = this.extractUrisFromText(entry.content);
      refs.push(...textRefs);
    }

    // Deduplicate
    return [...new Set(refs)];
  }

  /**
   * Extracts context from a WhiteWind blog entry.
   *
   * @param record - WhiteWind entry record
   * @returns Blog post title
   */
  protected override extractContext(record: unknown): string | undefined {
    const entry = record as WhiteWindEntry;
    return entry.title;
  }

  /**
   * Determines if a blog entry should be processed.
   *
   * @param record - WhiteWind entry record
   * @returns True if the entry is public
   */
  protected override shouldProcess(record: unknown): boolean {
    const entry = record as WhiteWindEntry;

    // Only process public blog posts
    return entry.visibility === 'public';
  }
}

export default WhiteWindBacklinksPlugin;
