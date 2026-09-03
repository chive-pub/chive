#!/usr/bin/env -S npx tsx

/**
 * Resolve stored citations against the eprints now indexed.
 *
 * @remarks
 * Citations are matched to Chive eprints once, while a document is being
 * processed, against whatever happened to be indexed at that moment. Nothing
 * re-runs that match, so a reference to a paper that reaches Chive *later*
 * stays unresolved forever and the citation graph never gains the edge.
 *
 * The effect compounds: the graph only ever holds edges that were discoverable
 * in extraction order, so the later an eprint is indexed relative to the papers
 * citing it, the more of the network is missing.
 *
 * This re-runs the same DOI-then-title matching over citations with no match
 * yet, and creates the CITES edges the original pass could not have known
 * about. It reads Postgres and writes Neo4j — no PDF is fetched and GROBID is
 * not involved — so it is cheap enough to run on every deploy, which is what
 * keeps the graph current as the corpus grows.
 *
 * Already-matched citations are left alone, so running it twice does nothing
 * the second time.
 *
 * Usage: npx tsx scripts/db/rematch-citations.ts [--limit N] [--eprint AT-URI]
 *
 * @packageDocumentation
 */

// Must precede any import that reaches a tsyringe-decorated class: tsyringe
// reads `Reflect.getMetadata` at module load and throws without the polyfill.
// The compiled script is run directly by the deploy, outside the server entry
// points that install it, so it has to install it itself.
import 'reflect-metadata';

import { Pool } from 'pg';

import { CitationExtractionService } from '../../src/services/citation/citation-extraction-service.js';
import { GrobidClient } from '../../src/services/citation/grobid-client.js';
import { DocumentTextExtractor } from '../../src/services/citation/document-text-extractor.js';
import { CitationGraph } from '../../src/storage/neo4j/citation-graph.js';
import { Neo4jConnection } from '../../src/storage/neo4j/connection.js';
import { createLogger } from '../../src/observability/logger.js';
import { getGrobidConfig } from '../../src/config/grobid.js';
import type { AtUri } from '../../src/types/atproto.js';
import type { IRepository } from '../../src/types/interfaces/repository.interface.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const logger = createLogger();

  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const neo4jConnection = new Neo4jConnection();
  await neo4jConnection.initialize({
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    username: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'password',
  });

  // Re-matching touches neither GROBID nor any PDS: it reads rows that were
  // already extracted. These are supplied because the service builds one
  // object for every job it can do, not because this path uses them.
  const service = new CitationExtractionService({
    grobidClient: new GrobidClient({ config: getGrobidConfig(), logger }),
    repository: {} as IRepository,
    db: pgPool,
    citationGraph: new CitationGraph(neo4jConnection),
    logger,
    documentTextExtractor: new DocumentTextExtractor({ logger }),
  });

  try {
    const limitArg = arg('--limit');
    const eprintArg = arg('--eprint');

    // Edges for citations already matched come first. A matched citation whose
    // edge was never written is not revisited by the re-match, which looks only
    // at rows with no match yet -- so without this pass those matches stay
    // invisible no matter how often the re-match runs.
    const rebuilt = await service.rebuildMatchedCitationEdges();
    console.log(`Edges rebuilt from existing matches: ${String(rebuilt.edgesCreated)}`);

    const result = await service.rematchStoredCitations({
      ...(limitArg ? { limit: Number.parseInt(limitArg, 10) } : {}),
      ...(eprintArg ? { eprintUri: eprintArg as AtUri } : {}),
    });

    console.log(`Examined ${String(result.examined)} unmatched citations`);
    console.log(`Newly matched to a Chive eprint: ${String(result.matched)}`);
    console.log(`Citation graph edges created:    ${String(result.edgesCreated)}`);
  } finally {
    await pgPool.end();
    await neo4jConnection.close();
  }
}

main().catch((error: unknown) => {
  console.error('Citation re-matching failed:', error);
  process.exit(1);
});
