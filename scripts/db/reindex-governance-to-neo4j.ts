#!/usr/bin/env tsx

/**
 * Reindex Graph PDS records directly to Neo4j.
 *
 * @remarks
 * Fetches all pub.chive.graph.node and pub.chive.graph.edge records from
 * the Graph PDS and indexes them directly to Neo4j, bypassing the
 * firehose consumer.
 *
 * Use this when you need to force a complete reindex without waiting
 * for the AppView's event processor.
 */

import { AtpAgent } from '@atproto/api';
import neo4j from 'neo4j-driver';

/**
 * Reads an environment variable, treating blank values as unset.
 *
 * @remarks
 * Deploy steps interpolate repository variables that may not be defined,
 * producing an empty string rather than an absent variable. Nullish coalescing
 * accepts `''` as a real value, which silently replaced the graph PDS DID with
 * nothing and made every `listRecords` call fail.
 */
function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value.trim().length > 0 ? value.trim() : fallback;
}

const PDS_URL = envOrDefault('GRAPH_PDS_URL', 'https://governance.chive.pub');
const GRAPH_PDS_DID = envOrDefault('GRAPH_PDS_DID', 'did:plc:5wzpn4a4nbqtz3q45hyud6hd');

const NEO4J_URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'password';

interface NodeRecord {
  $type: string;
  id: string;
  slug?: string;
  kind: 'type' | 'object';
  subkind?: string;
  label: string;
  alternateLabels?: string[];
  description?: string;
  externalIds?: Array<{
    system: string;
    identifier: string;
    uri?: string;
    matchType?: string;
  }>;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
}

interface EdgeRecord {
  $type: string;
  id: string;
  sourceUri: string;
  targetUri: string;
  relationUri?: string;
  relationSlug: string;
  weight?: number;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
}

function isNodeRecord(value: unknown): value is NodeRecord {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.$type === 'string' &&
    typeof obj.id === 'string' &&
    (obj.kind === 'type' || obj.kind === 'object') &&
    typeof obj.label === 'string' &&
    typeof obj.status === 'string' &&
    typeof obj.createdAt === 'string'
  );
}

function isEdgeRecord(value: unknown): value is EdgeRecord {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.$type === 'string' &&
    typeof obj.id === 'string' &&
    typeof obj.sourceUri === 'string' &&
    typeof obj.targetUri === 'string' &&
    typeof obj.relationSlug === 'string' &&
    typeof obj.status === 'string' &&
    typeof obj.createdAt === 'string'
  );
}

function subkindToLabel(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

async function main(): Promise<void> {
  console.log('===========================================');
  console.log('Governance PDS → Neo4j Reindex Script');
  console.log('===========================================');
  console.log(`PDS URL: ${PDS_URL}`);
  console.log(`Neo4j URI: ${NEO4J_URI}`);
  console.log();

  // Connect to PDS (no auth needed - public records are readable without authentication)
  const agent = new AtpAgent({ service: PDS_URL });

  // Connect to Neo4j
  console.log('Connecting to Neo4j...');
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();
  console.log('Connected.\n');

  try {
    // Fetch every node before mutating Neo4j. The graph must never be cleared
    // on a run that then fails to repopulate it: an empty graph silently turns
    // every eprint field label into a raw UUID at the next reindex.
    console.log('=== Fetching Nodes ===');
    const nodeRecords: { uri: string; value: unknown }[] = [];
    let fetchCursor: string | undefined;

    do {
      const response = await agent.com.atproto.repo.listRecords({
        repo: GRAPH_PDS_DID,
        collection: 'pub.chive.graph.node',
        limit: 100,
        cursor: fetchCursor,
      });
      nodeRecords.push(...response.data.records);
      fetchCursor = response.data.cursor;
    } while (fetchCursor);

    console.log(`  ${nodeRecords.length} node records fetched\n`);

    if (nodeRecords.length === 0) {
      throw new Error(
        `No pub.chive.graph.node records found in ${GRAPH_PDS_DID}. Refusing to clear the ` +
          'knowledge graph, which would leave every eprint field label showing a raw UUID.'
      );
    }

    // Only now is it safe to replace the graph.
    console.log('Clearing existing graph data...');
    await session.run('MATCH (n:Node) DETACH DELETE n');
    console.log('Cleared.\n');

    console.log('=== Indexing Nodes ===');
    let nodeCount = 0;

    {
      for (const record of nodeRecords) {
        if (!isNodeRecord(record.value)) {
          console.warn(`Skipping invalid node record: ${record.uri}`);
          continue;
        }
        const node = record.value;
        const uri = record.uri;

        const kindLabel = node.kind === 'type' ? 'Type' : 'Object';
        const subkindLabel = node.subkind ? subkindToLabel(node.subkind) : null;
        const labels = subkindLabel ? `Node:${kindLabel}:${subkindLabel}` : `Node:${kindLabel}`;

        await session.run(
          `
          MERGE (n:Node {id: $id})
          SET n:${labels},
              n.slug = $slug,
              n.uri = $uri,
              n.kind = $kind,
              n.subkind = $subkind,
              n.label = $label,
              n.alternateLabels = $alternateLabels,
              n.description = $description,
              n.externalIds = $externalIds,
              n.metadata = $metadata,
              n.status = $status,
              n.createdAt = datetime($createdAt),
              n.updatedAt = datetime()
          `,
          {
            id: node.id,
            slug: node.slug ?? null,
            uri,
            kind: node.kind,
            subkind: node.subkind ?? null,
            label: node.label,
            alternateLabels: node.alternateLabels ? JSON.stringify(node.alternateLabels) : null,
            description: node.description ?? null,
            externalIds: node.externalIds ? JSON.stringify(node.externalIds) : null,
            metadata: node.metadata ? JSON.stringify(node.metadata) : null,
            status: node.status,
            createdAt: node.createdAt,
          }
        );

        nodeCount++;
        if (nodeCount % 50 === 0) {
          process.stdout.write(`  ${nodeCount} nodes indexed\r`);
        }
      }
    }

    console.log(`  ${nodeCount} nodes indexed\n`);

    // Fetch and index edges
    console.log('=== Indexing Edges ===');
    let edgeCount = 0;
    let cursor: string | undefined;

    do {
      const response = await agent.com.atproto.repo.listRecords({
        repo: GRAPH_PDS_DID,
        collection: 'pub.chive.graph.edge',
        limit: 100,
        cursor,
      });

      for (const record of response.data.records) {
        if (!isEdgeRecord(record.value)) {
          console.warn(`Skipping invalid edge record: ${record.uri}`);
          continue;
        }
        const edge = record.value;
        const uri = record.uri;

        await session.run(
          `
          MATCH (source:Node {uri: $sourceUri})
          MATCH (target:Node {uri: $targetUri})
          MERGE (source)-[e:EDGE {id: $id}]->(target)
          SET e.uri = $uri,
              e.sourceUri = $sourceUri,
              e.targetUri = $targetUri,
              e.relationUri = $relationUri,
              e.relationSlug = $relationSlug,
              e.weight = $weight,
              e.metadata = $metadata,
              e.status = $status,
              e.createdAt = datetime($createdAt),
              e.updatedAt = datetime()
          `,
          {
            id: edge.id,
            uri,
            sourceUri: edge.sourceUri,
            targetUri: edge.targetUri,
            relationUri: edge.relationUri ?? null,
            relationSlug: edge.relationSlug,
            weight: edge.weight ?? 1.0,
            metadata: edge.metadata ? JSON.stringify(edge.metadata) : null,
            status: edge.status,
            createdAt: edge.createdAt,
          }
        );

        edgeCount++;
        if (edgeCount % 50 === 0) {
          process.stdout.write(`  ${edgeCount} edges indexed\r`);
        }
      }

      cursor = response.data.cursor;
    } while (cursor);

    console.log(`  ${edgeCount} edges indexed\n`);

    console.log('===========================================');
    console.log('Reindex complete!');
    console.log('===========================================');
    console.log(`Total nodes: ${nodeCount}`);
    console.log(`Total edges: ${edgeCount}`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((error) => {
  console.error('Reindex failed:', error);
  process.exit(1);
});
