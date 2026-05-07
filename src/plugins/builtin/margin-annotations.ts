/**
 * Margin notes tracking plugin.
 *
 * @remarks
 * Tracks `at.margin.note` records (W3C Web Annotations) and `at.margin.reply`
 * records from the firehose. The `motivation` field on a note distinguishes
 * commenting / highlighting / bookmarking / etc. -- there are no separate
 * collections for those concepts. When a note's `target.source` references a
 * Chive eprint URL (or AT URI), this plugin creates a backlink so the
 * annotation appears alongside native Chive reviews.
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
 * Margin note target (W3C SpecificResource).
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
 * Margin note record structure (W3C web annotation).
 *
 * @internal
 */
interface MarginNote {
  $type: 'at.margin.note';
  target: MarginTarget;
  motivation: string;
  body?: {
    value: string;
    format?: string;
  };
  tags?: string[];
  color?: string;
  createdAt: string;
}

// =============================================================================
// NOTES PLUGIN (handles at.margin.note for all motivations)
// =============================================================================

/**
 * Margin notes tracking plugin.
 *
 * @remarks
 * Tracks W3C Web Annotations from Margin (`at.margin.note`) that reference
 * Chive eprint URLs. Margin uses one collection for all motivation values
 * (commenting, highlighting, bookmarking, etc.); the motivation is encoded
 * in the per-record context string for downstream consumers that want to
 * differentiate.
 *
 * @public
 */
export class MarginNotesPlugin extends BacklinkTrackingPlugin {
  readonly id = 'pub.chive.plugin.margin-notes';

  readonly trackedCollection = 'at.margin.note';

  readonly sourceType: BacklinkSourceType = 'margin.annotation';

  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.margin-notes',
    name: 'Margin Notes',
    version: '0.6.2',
    description: 'Tracks W3C Web Annotations from Margin referencing Chive eprints',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      hooks: ['firehose.at.margin.note'],
      storage: {
        maxSize: 10 * 1024 * 1024,
      },
    },
    entrypoint: 'margin-notes.js',
  };

  extractEprintRefs(record: unknown): string[] {
    const note = record as MarginNote;
    const refs: string[] = [];
    if (note.target?.source && this.isChiveReference(note.target.source)) {
      refs.push(note.target.source);
    }
    return refs;
  }

  protected override extractContext(record: unknown): string | undefined {
    const note = record as MarginNote;
    const parts: string[] = [];
    if (note.motivation) parts.push(note.motivation);
    if (note.color) parts.push(`color=${note.color}`);
    if (note.body?.value) parts.push(note.body.value.slice(0, 200));
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

export { MarginNotesPlugin as default };
