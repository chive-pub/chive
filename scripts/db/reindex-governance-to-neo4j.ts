#!/usr/bin/env tsx

/**
 * Reindex Governance PDS records directly to Neo4j.
 *
 * @remarks
 * Fetches all pub.chive.graph.node and pub.chive.graph.edge records from
 * the Governance PDS and indexes them directly to Neo4j, bypassing the
 * firehose consumer.
 *
 * Use this when you need to force a complete reindex without waiting
 * for the AppView's event processor.
 */

import { AtpAgent } from '@atproto/api';
import neo4j from 'neo4j-driver';

const PDS_URL = process.env.GOVERNANCE_PDS_URL ?? 'https://governance.chive.pub';
const GOVERNANCE_DID = process.env.GOVERNANCE_DID ?? 'did:plc:5wzpn4a4nbqtz3q45hyud6hd';
const GOVERNANCE_HANDLE = process.env.GOVERNANCE_HANDLE ?? 'chive-governance.governance.chive.pub';
const GOVERNANCE_PASSWORD = process.env.GOVERNANCE_PASSWORD;

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
  if (!GOVERNANCE_PASSWORD) {
    throw new Error('GOVERNANCE_PASSWORD environment variable required');
  }

  console.log('===========================================');
  console.log('Governance PDS → Neo4j Reindex Script');
  console.log('===========================================');
  console.log(`PDS URL: ${PDS_URL}`);
  console.log(`Neo4j URI: ${NEO4J_URI}`);
  console.log();

  // Connect to PDS
  const agent = new AtpAgent({ service: PDS_URL });
  console.log('Authenticating with Governance PDS...');
  await agent.login({ identifier: GOVERNANCE_HANDLE, password: GOVERNANCE_PASSWORD });
  console.log('Authenticated.\n');

  // Connect to Neo4j
  console.log('Connecting to Neo4j...');
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();
  console.log('Connected.\n');

  try {
    // Clear existing nodes and edges
    console.log('Clearing existing graph data...');
    await session.run('MATCH (n:Node) DETACH DELETE n');
    console.log('Cleared.\n');

    // Fetch and index nodes
    console.log('=== Indexing Nodes ===');
    let nodeCount = 0;
    let cursor: string | undefined;

    do {
      const response = await agent.com.atproto.repo.listRecords({
        repo: GOVERNANCE_DID,
        collection: 'pub.chive.graph.node',
        limit: 100,
        cursor,
      });

      for (const record of response.data.records) {
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
          CREATE (n:${labels} {
            id: $id,
            slug: $slug,
            uri: $uri,
            kind: $kind,
            subkind: $subkind,
            label: $label,
            alternateLabels: $alternateLabels,
            description: $description,
            externalIds: $externalIds,
            metadata: $metadata,
            status: $status,
            createdAt: datetime($createdAt),
            updatedAt: datetime()
          })
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

      cursor = response.data.cursor;
    } while (cursor);

    console.log(`  ${nodeCount} nodes indexed\n`);

    // Fetch and index edges
    console.log('=== Indexing Edges ===');
    let edgeCount = 0;
    cursor = undefined;

    do {
      const response = await agent.com.atproto.repo.listRecords({
        repo: GOVERNANCE_DID,
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
          CREATE (source)-[e:EDGE {
            id: $id,
            uri: $uri,
            sourceUri: $sourceUri,
            targetUri: $targetUri,
            relationUri: $relationUri,
            relationSlug: $relationSlug,
            weight: $weight,
            metadata: $metadata,
            status: $status,
            createdAt: datetime($createdAt),
            updatedAt: datetime()
          }]->(target)
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
