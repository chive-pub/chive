/**
 * Indexes the `parent_comment` foreign key on `reviews_index`.
 *
 * @remarks
 * `parent_comment` carries a foreign key to `reviews_index(uri)` with
 * `ON DELETE CASCADE`, but no index. PostgreSQL does not index foreign keys
 * automatically, so every thread load — which fetches replies by parent — and
 * every cascade check on delete had to scan `reviews_index` end to end. The
 * cost grows with the whole review table rather than with the thread.
 *
 * The column was renamed from `parent_review_uri` to `parent_comment` for
 * lexicon alignment; the rename carried the constraint across but never added
 * an index, and the absence is invisible until the table is large.
 *
 * The index is partial. A top-level comment has a null `parent_comment`, those
 * are the majority of rows, and none of them are ever looked up by parent.
 *
 * Note that the pre-existing `idx_reviews_parent_uri` is deliberately left in
 * place. It indexes a different column that `reviews-repository.ts` still
 * selects and filters on, so despite looking like a leftover of the same
 * rename it is not dead.
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.createIndex('reviews_index', 'parent_comment', {
    name: 'idx_reviews_parent_comment',
    where: 'parent_comment IS NOT NULL',
    ifNotExists: true,
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex('reviews_index', 'parent_comment', {
    name: 'idx_reviews_parent_comment',
    ifExists: true,
  });
}
