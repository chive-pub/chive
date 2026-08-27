/**
 * Unit tests for zero-downtime index mapping migration.
 *
 * @remarks
 * Elasticsearch mappings are fixed once an index exists, so a template edit
 * reaches a live deployment only by building a new index and moving the alias.
 * `bootstrapIndex` returns early when the alias exists and never did this, and
 * the only path that applied a mapping change deleted `eprints-v1` outright:
 * full search downtime for the length of a reindex, no prompt, and nothing to
 * fall back to if the rebuild failed halfway. The module's docblock had promised
 * alias switching the whole time.
 *
 * The property that matters is that the alias is never unset. Elasticsearch
 * applies the actions in a single `updateAliases` call atomically, so the remove
 * and the add have to travel together — issuing them as two calls would leave a
 * window where searches resolve to nothing.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { migrateIndexToCurrentMapping } from '@/storage/elasticsearch/setup.js';

interface ClientDouble {
  indices: {
    getAlias: Mock;
    create: Mock;
    updateAliases: Mock;
    delete: Mock;
  };
  reindex: Mock;
}

const clientDouble = (): ClientDouble => ({
  indices: {
    getAlias: vi.fn().mockResolvedValue({ 'eprints-v1': { aliases: { eprints: {} } } }),
    create: vi.fn().mockResolvedValue({}),
    updateAliases: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  reindex: vi.fn().mockResolvedValue({ created: 42 }),
});

describe('migrateIndexToCurrentMapping', () => {
  let client: ClientDouble;

  beforeEach(() => {
    client = clientDouble();
  });

  it('creates the next index version', async () => {
    await migrateIndexToCurrentMapping(client as never);
    expect(client.indices.create).toHaveBeenCalledWith({ index: 'eprints-v2' });
  });

  it('increments from whatever version the alias points at', async () => {
    client.indices.getAlias.mockResolvedValue({ 'eprints-v7': { aliases: { eprints: {} } } });
    await migrateIndexToCurrentMapping(client as never);
    expect(client.indices.create).toHaveBeenCalledWith({ index: 'eprints-v8' });
  });

  it('copies the documents across', async () => {
    await migrateIndexToCurrentMapping(client as never);
    expect(client.reindex).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { index: 'eprints-v1' },
        dest: { index: 'eprints-v2' },
      })
    );
  });

  // The whole point: remove and add in one call, so no request ever sees the
  // alias pointing at nothing.
  it('moves the alias in a single atomic action', async () => {
    await migrateIndexToCurrentMapping(client as never);

    expect(client.indices.updateAliases).toHaveBeenCalledTimes(1);
    expect(client.indices.updateAliases).toHaveBeenCalledWith({
      actions: [
        { remove: { index: 'eprints-v1', alias: 'eprints' } },
        { add: { index: 'eprints-v2', alias: 'eprints' } },
      ],
    });
  });

  it('reindexes before switching, so the old index serves throughout', async () => {
    const order: string[] = [];
    client.reindex.mockImplementation(() => {
      order.push('reindex');
      return Promise.resolve({ created: 1 });
    });
    client.indices.updateAliases.mockImplementation(() => {
      order.push('switch');
      return Promise.resolve({});
    });

    await migrateIndexToCurrentMapping(client as never);

    expect(order).toEqual(['reindex', 'switch']);
  });

  // The old index is the only copy of the pre-migration state, and keeping it
  // makes the migration reversible by moving the alias back.
  it('keeps the previous index by default', async () => {
    const result = await migrateIndexToCurrentMapping(client as never);

    expect(client.indices.delete).not.toHaveBeenCalled();
    expect(result.previousIndexDeleted).toBe(false);
  });

  it('deletes it only when explicitly asked', async () => {
    const result = await migrateIndexToCurrentMapping(client as never, { deletePrevious: true });

    expect(client.indices.delete).toHaveBeenCalledWith({ index: 'eprints-v1' });
    expect(result.previousIndexDeleted).toBe(true);
  });

  it('reports what moved where', async () => {
    const result = await migrateIndexToCurrentMapping(client as never);

    expect(result.from).toBe('eprints-v1');
    expect(result.to).toBe('eprints-v2');
    expect(result.documentsReindexed).toBe(42);
  });

  // An alias spanning several indices means someone has done something the
  // version arithmetic cannot reason about; guessing would move the wrong one.
  it('refuses when the alias resolves to more than one index', async () => {
    client.indices.getAlias.mockResolvedValue({
      'eprints-v1': { aliases: { eprints: {} } },
      'eprints-v2': { aliases: { eprints: {} } },
    });

    await expect(migrateIndexToCurrentMapping(client as never)).rejects.toThrow(
      /resolves to 2 indices/
    );
    expect(client.indices.create).not.toHaveBeenCalled();
  });

  it('refuses when the alias resolves to nothing', async () => {
    client.indices.getAlias.mockResolvedValue({});
    await expect(migrateIndexToCurrentMapping(client as never)).rejects.toThrow(
      /expected exactly one/
    );
  });
});

describe('the destructive recreate script', () => {
  const source = readFileSync(
    join(process.cwd(), 'scripts/db/recreate-elasticsearch-index.ts'),
    'utf8'
  );

  // It used to delete a live index with no prompt whatsoever.
  it('refuses to delete without an explicit confirmation', () => {
    expect(source).toMatch(/--force/);
    expect(source).toMatch(/CHIVE_CONFIRM_INDEX_DELETE/);
    expect(source).toMatch(/Refusing to delete the live index/);
  });

  it('points at the non-destructive path instead', () => {
    expect(source).toMatch(/migrateIndexToCurrentMapping/);
  });

  it('exits non-zero when it refuses', () => {
    expect(source).toMatch(/process\.exitCode = 1/);
  });

  it('no longer describes itself as the way to apply a mapping change', () => {
    expect(source).toMatch(/DESTRUCTIVE/);
  });
});
