/**
 * Unit tests for facet hierarchy traversal.
 *
 * @remarks
 * `getChildFacets` asked Cypher for `*1..$maxDepth`. Neo4j does not accept a
 * parameter as a variable-length bound, so the query was a syntax error and the
 * method threw on every call — the child-facet hierarchy never resolved at all.
 * The bound must therefore live in the query text, which means it cannot be
 * parameterized and has to be proven to be a bounded integer first.
 *
 * The pattern also carried a duplicated `:Node:Node:Facet` label.
 */

import 'reflect-metadata';

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import type { Neo4jConnection } from '@/storage/neo4j/connection.js';
import { FacetManager } from '@/storage/neo4j/facet-manager.js';
import type { AtUri } from '@/types/atproto.js';

const PARENT = 'at://did:plc:izttpdp3l6vss5crelt5kcux/pub.chive.graph.node/facet1' as AtUri;

describe('FacetManager.getChildFacets', () => {
  let executeQuery: Mock;
  let manager: FacetManager;

  beforeEach(() => {
    executeQuery = vi.fn().mockResolvedValue({ records: [] });
    manager = new FacetManager({ executeQuery } as unknown as Neo4jConnection);
  });

  it('writes the depth into the query rather than passing it as a parameter', async () => {
    await manager.getChildFacets(PARENT, 3);
    const [cypher, params] = executeQuery.mock.calls[0] as [string, Record<string, unknown>];
    expect(cypher).toContain('*1..3');
    expect(cypher).not.toContain('$maxDepth');
    expect(params).not.toHaveProperty('maxDepth');
    expect(params).toHaveProperty('parentUri', PARENT);
  });

  it('defaults to a depth of one', async () => {
    await manager.getChildFacets(PARENT);
    expect(executeQuery.mock.calls[0]?.[0]).toContain('*1..1');
  });

  it('does not repeat the Node label in the pattern', async () => {
    await manager.getChildFacets(PARENT);
    expect(executeQuery.mock.calls[0]?.[0]).not.toContain(':Node:Node');
  });

  // The bound is interpolated, so anything that is not a plain bounded integer
  // has to be refused before it reaches the query text.
  it.each([[0], [-1], [1.5], [Number.NaN], [Infinity], [11]])(
    'rejects a depth of %s without querying',
    async (depth) => {
      await expect(manager.getChildFacets(PARENT, depth)).rejects.toThrow(RangeError);
      expect(executeQuery).not.toHaveBeenCalled();
    }
  );

  it('rejects a non-numeric depth smuggled in as a string', async () => {
    await expect(
      manager.getChildFacets(PARENT, '2 UNION MATCH (n) DETACH DELETE n' as unknown as number)
    ).rejects.toThrow(RangeError);
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('accepts the maximum permitted depth', async () => {
    await manager.getChildFacets(PARENT, 10);
    expect(executeQuery.mock.calls[0]?.[0]).toContain('*1..10');
  });
});
