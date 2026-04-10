/**
 * Margin annotations tracking plugin.
 *
 * @remarks
 * Tracks `at.margin.annotation`, `at.margin.highlight`, and `at.margin.bookmark`
 * records from the firehose. When these records reference Chive eprint URLs
 * (via `target.source` or `source`), this plugin creates backlinks for
 * aggregation and displays annotations alongside native Chive reviews.
 *
 * Margin implements the W3C Web Annotation Data Model on ATProto, making it
 * a natural complement to Chive's review system.
 *
 * ATProto Compliance:
 * - All backlinks indexed from firehose (rebuildable via replay)
 * - Tracks deletions to honor record removal
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 * @since 0.5.2
 */

import type {
  BacklinkSourceType,
  IPluginContext,
  IPluginManifest,
} from '../../types/interfaces/plugin.interface.js';
import { BacklinkTrackingPlugin } from '../core/backlink-plugin.js';
import type { FirehoseRecord } from '../core/backlink-plugin.js';

// =============================================================================
// RECORD TYPES
// =============================================================================

/**
 * Margin annotation target (W3C SpecificResource).
 *
 * @internal
 */
interface MarginTarget {
  source: string;
  sourceHash?: string;
  title?: string;
  selector?: Record<string, unknown>;
}

/**
 * Margin annotation record structure.
 *
 * @internal
 */
interface MarginAnnotation {
  $type: 'at.margin.annotation';
  target: MarginTarget;
  body?: {
    value: string;
    format?: string;
  };
  motivation?: string;
  tags?: string[];
  createdAt: string;
}

/**
 * Margin highlight record structure.
 *
 * @internal
 */
interface MarginHighlight {
  $type: 'at.margin.highlight';
  target: MarginTarget;
  color?: string;
  tags?: string[];
  createdAt: string;
}

/**
 * Margin bookmark record structure.
 *
 * @internal
 */
interface MarginBookmark {
  $type: 'at.margin.bookmark';
  source: string;
  sourceHash?: string;
  title?: string;
  description?: string;
  tags?: string[];
  createdAt: string;
}

// =============================================================================
// ANNOTATION PLUGIN (handles at.margin.annotation)
// =============================================================================

/**
 * Margin annotations tracking plugin.
 *
 * @remarks
 * Tracks W3C Web Annotations from Margin that reference Chive eprint URLs.
 *
 * @public
 */
export class MarginAnnotationsPlugin extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.margin-annotations';

  readonly trackedCollection = 'at.margin.annotation';

  readonly sourceType: BacklinkSourceType = 'margin.annotation';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.margin-annotations',
    name: 'Margin Annotations',
    version: '0.5.2',
    description: 'Tracks W3C Web Annotations from Margin referencing Chive eprints',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.at.margin.annotation'],
      storage: {
        maxSize: 10 * 1024 * 1024,
      },
    },
    entrypoint: 'margin-annotations.js',
  };

  extractEprintRefs(record: unknown): string[] {
    const annotation = record as MarginAnnotation;
    const refs: string[] = [];

    if (annotation.target?.source && this.isChiveReference(annotation.target.source)) {
      refs.push(annotation.target.source);
    }

    return refs;
  }

  protected override extractContext(record: unknown): string | undefined {
    const annotation = record as MarginAnnotation;
    const parts: string[] = [];
    if (annotation.motivation) parts.push(annotation.motivation);
    if (annotation.body?.value) {
      parts.push(annotation.body.value.slice(0, 200));
    }
    return parts.length > 0 ? parts.join(': ') : undefined;
  }

  protected override shouldProcess(_record: unknown): boolean {
    return true;
  }

  private isChiveReference(url: string): boolean {
    return url.includes('chive.pub/eprints/') || this.isEprintUri(url);
  }
}

// =============================================================================
// HIGHLIGHT PLUGIN (handles at.margin.highlight)
// =============================================================================

/**
 * Margin highlights tracking plugin.
 *
 * @public
 */
export class MarginHighlightsPlugin extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.margin-highlights';

  readonly trackedCollection = 'at.margin.highlight';

  readonly sourceType: BacklinkSourceType = 'margin.highlight';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.margin-highlights',
    name: 'Margin Highlights',
    version: '0.5.2',
    description: 'Tracks highlights from Margin on Chive eprints',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.at.margin.highlight'],
      storage: {
        maxSize: 5 * 1024 * 1024,
      },
    },
    entrypoint: 'margin-highlights.js',
  };

  extractEprintRefs(record: unknown): string[] {
    const highlight = record as MarginHighlight;
    const refs: string[] = [];

    if (highlight.target?.source && this.isChiveReference(highlight.target.source)) {
      refs.push(highlight.target.source);
    }

    return refs;
  }

  protected override extractContext(record: unknown): string | undefined {
    const highlight = record as MarginHighlight;
    if (highlight.color) return `highlight (${highlight.color})`;
    return 'highlight';
  }

  protected override shouldProcess(_record: unknown): boolean {
    return true;
  }

  private isChiveReference(url: string): boolean {
    return url.includes('chive.pub/eprints/') || this.isEprintUri(url);
  }
}

// =============================================================================
// BOOKMARK PLUGIN (handles at.margin.bookmark)
// =============================================================================

/**
 * Margin bookmarks tracking plugin.
 *
 * @public
 */
export class MarginBookmarksPlugin extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.margin-bookmarks';

  readonly trackedCollection = 'at.margin.bookmark';

  readonly sourceType: BacklinkSourceType = 'margin.bookmark';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.margin-bookmarks',
    name: 'Margin Bookmarks',
    version: '0.5.2',
    description: 'Tracks bookmarks from Margin for Chive eprints',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.at.margin.bookmark'],
      storage: {
        maxSize: 5 * 1024 * 1024,
      },
    },
    entrypoint: 'margin-bookmarks.js',
  };

  extractEprintRefs(record: unknown): string[] {
    const bookmark = record as MarginBookmark;
    const refs: string[] = [];

    if (bookmark.source && this.isChiveReference(bookmark.source)) {
      refs.push(bookmark.source);
    }

    return refs;
  }

  protected override extractContext(record: unknown): string | undefined {
    const bookmark = record as MarginBookmark;
    return bookmark.title || bookmark.description || undefined; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- intentionally coerces empty string
  }

  protected override shouldProcess(_record: unknown): boolean {
    return true;
  }

  private isChiveReference(url: string): boolean {
    return url.includes('chive.pub/eprints/') || this.isEprintUri(url);
  }
}

// =============================================================================
// MARGIN REPLY PLUGIN (handles at.margin.reply for threading)
// =============================================================================

/**
 * Margin reply record structure.
 *
 * @internal
 */
interface MarginReply {
  $type: 'at.margin.reply';
  parent: { uri: string; cid: string };
  root: { uri: string; cid: string };
  text: string;
  format?: string;
  createdAt: string;
}

/**
 * Margin replies tracking plugin.
 *
 * @remarks
 * Tracks `at.margin.reply` records and emits events for threading.
 * Replies reference parent and root annotations via StrongRefs.
 *
 * @public
 */
export class MarginRepliesPlugin extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.margin-replies';

  readonly trackedCollection = 'at.margin.reply';

  readonly sourceType: BacklinkSourceType = 'margin.annotation';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.margin-replies',
    name: 'Margin Replies',
    version: '0.5.2',
    description: 'Tracks threaded replies on Margin annotations for Chive eprints',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.at.margin.reply'],
      storage: {
        maxSize: 5 * 1024 * 1024,
      },
    },
    entrypoint: 'margin-replies.js',
  };

  override async initialize(context: IPluginContext): Promise<void> {
    await super.initialize(context);

    // Also listen for reply events to build thread context
    this.context.eventBus.on('firehose.at.margin.reply', (...args: readonly unknown[]) => {
      const record = args[0] as FirehoseRecord;
      void this.handleReplyRecord(record);
    });
  }

  extractEprintRefs(_record: unknown): string[] {
    // Replies don't directly reference eprints; they chain to annotations
    // that may reference eprints. The backlink is on the root annotation.
    return [];
  }

  private handleReplyRecord(record: FirehoseRecord): void {
    try {
      if (record.deleted) {
        this.context.eventBus.emit('margin.reply.deleted', {
          uri: record.uri,
          did: record.did,
        });
      } else if (record.record) {
        const reply = record.record as unknown as MarginReply;

        this.context.eventBus.emit('margin.reply.created', {
          uri: record.uri,
          authorDid: record.did,
          parentUri: reply.parent.uri,
          rootUri: reply.root.uri,
          text: reply.text,
          createdAt: reply.createdAt,
        });
      }
    } catch (err) {
      this.logger.warn('Failed to process reply record', {
        error: (err as Error).message,
        uri: record.uri,
      });
    }
  }

  protected override shouldProcess(_record: unknown): boolean {
    return true;
  }
}

export { MarginAnnotationsPlugin as default };
