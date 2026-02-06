#!/usr/bin/env tsx
/**
 * Seeds test data into PostgreSQL, Elasticsearch, and Neo4j.
 *
 * This script can be run standalone or imported by Playwright's global setup.
 * It seeds the same test data that E2E tests expect.
 *
 * Usage:
 *   pnpm seed:test
 *   # or directly:
 *   ./scripts/seed-test-data.ts
 *
 * @packageDocumentation
 */

import pg from 'pg';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import neo4j from 'neo4j-driver';

const { Client: PgClient } = pg;

// Database credentials from environment or defaults matching docker-compose
const POSTGRES_URL =
  process.env.DATABASE_URL ?? 'postgresql://chive:chive_test_password@127.0.0.1:5432/chive';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL ?? 'http://127.0.0.1:9200';
const NEO4J_URI = process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687';
const NEO4J_USER = process.env.NEO4J_USER ?? 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? 'chive_test_password';

/**
 * E2E test user - must match auth.setup.ts TEST_USER.
 * This user must be seeded as an approved alpha tester.
 */
const E2E_TEST_USER = {
  did: 'did:plc:e2etestuser123',
  handle: 'e2e-test.bsky.social',
  displayName: 'E2E Test User',
  email: 'e2e-test@chive.pub',
  sector: 'academia',
  careerStage: 'postdoc',
  researchField: 'Computational Linguistics',
  pdsUrl: 'https://bsky.social',
};

/**
 * Test authors - real researchers from linguistics literature.
 */
const TEST_AUTHORS = [
  {
    did: 'did:plc:aswhite123abc',
    handle: 'aswhite.bsky.social',
    displayName: 'Aaron Steven White',
    bio: 'Associate Professor at University of Rochester. Research in computational semantics.',
    orcid: '0000-0002-4921-5202',
    affiliations: ['University of Rochester'],
    fieldIds: ['computational-linguistics', 'formal-semantics'],
    pdsUrl: 'https://bsky.social',
  },
  {
    did: 'did:plc:jgrove456def',
    handle: 'jgrove.bsky.social',
    displayName: 'Julian Grove',
    bio: 'Assistant Professor at University of Florida. Research in type-theoretic semantics.',
    affiliations: ['University of Florida'],
    fieldIds: ['formal-semantics', 'computational-linguistics'],
    pdsUrl: 'https://bsky.social',
  },
  {
    did: 'did:plc:scharlow789ghi',
    handle: 'scharlow.bsky.social',
    displayName: 'Simon Charlow',
    bio: 'Associate Professor at Yale University. Research in scope and continuations.',
    affiliations: ['Yale University'],
    fieldIds: ['formal-semantics'],
    pdsUrl: 'https://bsky.social',
  },
];

/**
 * Test eprints - real papers from computational semantics.
 */
const TEST_EPRINTS = [
  {
    uri: 'at://did:plc:aswhite123abc/pub.chive.eprint.submission/3jt7k9xyzab01',
    cid: 'bafyreigxyz123abc',
    authorDid: 'did:plc:aswhite123abc',
    title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
    abstract:
      'We investigate the relationship between the frequency with which a predicate occurs in a particular syntactic frame in naturally occurring text and the acceptability of that predicate in that frame.',
    documentBlobCid: 'bafkreiabc123',
    documentBlobMimeType: 'application/pdf',
    documentBlobSize: 524288,
    keywords: ['clause-embedding verbs', 'acceptability', 'corpus frequency'],
    version: 1,
    license: 'CC-BY-4.0',
    createdAt: '2020-01-15T10:00:00.000Z',
    pdsUrl: 'https://bsky.social',
  },
  {
    uri: 'at://did:plc:jgrove456def/pub.chive.eprint.submission/3kt8m0abcde02',
    cid: 'bafyreiabc456def',
    authorDid: 'did:plc:jgrove456def',
    title: 'Algebraic Effects for Extensible Dynamic Semantics',
    abstract:
      'We present a framework for dynamic semantics based on algebraic effects, allowing modular treatment of anaphora and presupposition.',
    documentBlobCid: 'bafkreidef456',
    documentBlobMimeType: 'application/pdf',
    documentBlobSize: 612000,
    keywords: ['dynamic semantics', 'algebraic effects', 'Montague semantics'],
    version: 1,
    license: 'CC-BY-4.0',
    createdAt: '2023-03-20T14:30:00.000Z',
    pdsUrl: 'https://bsky.social',
  },
  {
    uri: 'at://did:plc:scharlow789ghi/pub.chive.eprint.submission/4lu9n1bcdef03',
    cid: 'bafyreighi789jkl',
    authorDid: 'did:plc:scharlow789ghi',
    title: 'On the Semantics of Exceptional Scope',
    abstract:
      'This dissertation develops a theory of exceptional scope-taking using continuations and monads.',
    documentBlobCid: 'bafkreighi789',
    documentBlobMimeType: 'application/pdf',
    documentBlobSize: 1048576,
    keywords: ['scope', 'continuations', 'monads', 'indefinites'],
    version: 1,
    license: 'CC-BY-NC-4.0',
    createdAt: '2014-05-01T09:00:00.000Z',
    pdsUrl: 'https://bsky.social',
  },
];

/**
 * Test tags for eprints.
 */
const TEST_TAGS = [
  {
    uri: 'at://did:plc:aswhite123abc/pub.chive.eprint.userTag/tag001',
    cid: 'bafkreitag001',
    eprintUri: 'at://did:plc:jgrove456def/pub.chive.eprint.submission/3kt8m0abcde02',
    taggerDid: 'did:plc:aswhite123abc',
    tag: 'monads',
    createdAt: '2023-04-01T10:00:00.000Z',
    pdsUrl: 'https://bsky.social',
  },
  {
    uri: 'at://did:plc:jgrove456def/pub.chive.eprint.userTag/tag002',
    cid: 'bafkreitag002',
    eprintUri: 'at://did:plc:aswhite123abc/pub.chive.eprint.submission/3jt7k9xyzab01',
    taggerDid: 'did:plc:jgrove456def',
    tag: 'megaattitude',
    createdAt: '2023-04-02T11:00:00.000Z',
    pdsUrl: 'https://bsky.social',
  },
];

/**
 * Test backlinks from ATProto ecosystem.
 */
const TEST_BACKLINKS = [
  {
    sourceUri: 'at://did:plc:semble001/xyz.semble.collection/col001',
    sourceType: 'semble.collection',
    sourceDid: 'did:plc:semble001',
    targetUri: 'at://did:plc:aswhite123abc/pub.chive.eprint.submission/3jt7k9xyzab01',
    context: 'Computational Semantics Reading List',
    indexedAt: '2024-01-15T10:00:00.000Z',
  },
  {
    sourceUri: 'at://did:plc:bskyuser001/app.bsky.feed.post/post001',
    sourceType: 'bluesky.post',
    sourceDid: 'did:plc:bskyuser001',
    targetUri: 'at://did:plc:aswhite123abc/pub.chive.eprint.submission/3jt7k9xyzab01',
    context: 'Check out this fascinating paper on clause-embedding verbs!',
    indexedAt: '2024-02-20T14:30:00.000Z',
  },
  {
    sourceUri: 'at://did:plc:whitewind001/com.whitewind.blog.entry/blog001',
    sourceType: 'whitewind.blog',
    sourceDid: 'did:plc:whitewind001',
    targetUri: 'at://did:plc:jgrove456def/pub.chive.eprint.submission/3kt8m0abcde02',
    context: 'A deep dive into algebraic effects in semantics',
    indexedAt: '2024-03-10T09:15:00.000Z',
  },
  {
    sourceUri: 'at://did:plc:leaflet001/xyz.leaflet.list/list001',
    sourceType: 'leaflet.list',
    sourceDid: 'did:plc:leaflet001',
    targetUri: 'at://did:plc:scharlow789ghi/pub.chive.eprint.submission/4lu9n1bcdef03',
    context: 'Scope and Continuations Papers',
    indexedAt: '2024-04-05T16:45:00.000Z',
  },
];

/**
 * Test enrichment data from Semantic Scholar and OpenAlex.
 */
const TEST_ENRICHMENTS = [
  {
    uri: 'at://did:plc:aswhite123abc/pub.chive.eprint.submission/3jt7k9xyzab01',
    semanticScholarId: 'e2a5c6b8d9f0123456789abcdef01234',
    openAlexId: 'W2123456789',
    citationCount: 42,
    influentialCitationCount: 8,
    referencesCount: 35,
    concepts: [
      {
        id: 'C123456',
        displayName: 'Computational Linguistics',
        wikidataId: 'Q1141501',
        score: 0.95,
      },
      { id: 'C234567', displayName: 'Semantics', wikidataId: 'Q39645', score: 0.88 },
      {
        id: 'C345678',
        displayName: 'Natural Language Processing',
        wikidataId: 'Q30642',
        score: 0.82,
      },
    ],
    topics: [
      {
        id: 'T100',
        displayName: 'Clause-Embedding Predicates',
        subfield: 'Syntax-Semantics Interface',
        field: 'Linguistics',
        domain: 'Language Sciences',
        score: 0.91,
      },
    ],
    enrichedAt: '2024-01-16T12:00:00.000Z',
  },
  {
    uri: 'at://did:plc:jgrove456def/pub.chive.eprint.submission/3kt8m0abcde02',
    semanticScholarId: 'f3b6d7c9e0a1234567890bcdef12345',
    openAlexId: 'W3234567890',
    citationCount: 15,
    influentialCitationCount: 3,
    referencesCount: 28,
    concepts: [
      { id: 'C456789', displayName: 'Formal Semantics', wikidataId: 'Q1378959', score: 0.92 },
      {
        id: 'C567890',
        displayName: 'Programming Language Theory',
        wikidataId: 'Q1650551',
        score: 0.78,
      },
    ],
    topics: [
      {
        id: 'T200',
        displayName: 'Algebraic Effects',
        subfield: 'Denotational Semantics',
        field: 'Computer Science',
        domain: 'Formal Methods',
        score: 0.89,
      },
    ],
    enrichedAt: '2024-03-21T08:00:00.000Z',
  },
];

/**
 * Test knowledge graph fields.
 */
const TEST_FIELDS = [
  { id: 'linguistics', label: 'Linguistics', parentId: null },
  { id: 'computational-linguistics', label: 'Computational Linguistics', parentId: 'linguistics' },
  { id: 'formal-semantics', label: 'Formal Semantics', parentId: 'linguistics' },
  { id: 'psycholinguistics', label: 'Psycholinguistics', parentId: 'linguistics' },
  { id: 'dynamic-semantics', label: 'Dynamic Semantics', parentId: 'formal-semantics' },
  { id: 'lexical-semantics', label: 'Lexical Semantics', parentId: 'formal-semantics' },
];

/**
 * UUID lookup for proposals.
 * Generated using nodeUuid('proposal', slug) for deterministic URIs.
 */
const PROPOSAL_UUIDS: Record<string, string> = {
  'proposal-test-001': 'b3cf7184-4628-5967-b4ce-496b4329dfb9',
  'proposal-test-002': '882a9ca0-7ca5-578c-875c-9fcb5d760995',
  'proposal-test-003': 'c96cc0af-be6f-5d0c-9767-93834431a3ab',
};

/**
 * Test governance proposals.
 */
const TEST_PROPOSALS = [
  {
    id: 'proposal-test-001',
    uri: `at://did:plc:chive-governance/pub.chive.graph.proposal/${PROPOSAL_UUIDS['proposal-test-001']}`,
    category: 'field' as const,
    fieldName: 'Quantum Semantics',
    alternateNames: ['Quantum Linguistics', 'QS'],
    description: 'Application of quantum mechanics concepts to natural language semantics.',
    proposalType: 'create' as const,
    rationale:
      'Emerging interdisciplinary field combining quantum computing principles with linguistic theory.',
    evidence: JSON.stringify([
      {
        type: 'bibliometric-analysis',
        description: '15+ papers published in major venues since 2021',
        confidence: 0.85,
      },
    ]),
    references: JSON.stringify([
      {
        type: 'paper',
        identifier: 'arXiv:2103.12345',
        title: 'Quantum Models of Natural Language',
      },
    ]),
    status: 'pending',
    proposerDid: 'did:plc:aswhite123abc',
    createdAt: '2024-01-10T10:00:00.000Z',
  },
  {
    id: 'proposal-test-002',
    uri: `at://did:plc:chive-governance/pub.chive.graph.proposal/${PROPOSAL_UUIDS['proposal-test-002']}`,
    category: 'field' as const,
    fieldName: 'Computational Pragmatics',
    alternateNames: ['Pragmatic NLP'],
    description: 'Computational modeling of pragmatic inference and implicature.',
    proposalType: 'create' as const,
    rationale:
      'Growing subfield with distinct methodology focusing on context-dependent meaning computation.',
    evidence: JSON.stringify([
      {
        type: 'literature-review',
        description: 'Systematic review of 50+ papers on computational pragmatics',
        confidence: 0.9,
      },
    ]),
    references: null,
    status: 'pending',
    proposerDid: 'did:plc:jgrove456def',
    createdAt: '2024-02-15T14:30:00.000Z',
  },
  {
    id: 'proposal-test-003',
    uri: `at://did:plc:chive-governance/pub.chive.graph.proposal/${PROPOSAL_UUIDS['proposal-test-003']}`,
    category: 'contribution-type' as const,
    fieldName: 'Data Stewardship',
    alternateNames: ['Data Curation', 'Data Management'],
    description: 'Management and curation of research data throughout the project lifecycle.',
    proposalType: 'create' as const,
    rationale:
      'Emerging contribution type not covered by standard CRediT roles. Recognizes specialized data management work.',
    evidence: JSON.stringify([
      {
        type: 'community-request',
        description: 'Multiple requests from data science community',
        confidence: 0.8,
      },
    ]),
    references: null,
    status: 'pending',
    proposerDid: 'did:plc:aswhite123abc',
    createdAt: '2024-03-01T09:00:00.000Z',
  },
];

/**
 * Seed PostgreSQL with test data.
 */
export async function seedPostgres(): Promise<void> {
  const client = new PgClient({ connectionString: POSTGRES_URL });

  try {
    await client.connect();
    console.log('  PostgreSQL: Connected');

    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'authors_index'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('  PostgreSQL: Tables do not exist, skipping seed');
      return;
    }

    // Clear existing test data
    await client.query("DELETE FROM user_tags_index WHERE uri LIKE 'at://did:plc:%'");
    await client.query("DELETE FROM endorsements_index WHERE uri LIKE 'at://did:plc:%'");
    await client.query("DELETE FROM reviews_index WHERE uri LIKE 'at://did:plc:%'");
    await client.query("DELETE FROM eprints_index WHERE uri LIKE 'at://did:plc:%'");
    await client.query("DELETE FROM authors_index WHERE did LIKE 'did:plc:%'");

    // Seed authors
    for (const author of TEST_AUTHORS) {
      await client.query(
        `INSERT INTO authors_index (did, handle, display_name, bio, orcid, affiliations, field_ids, pds_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (did) DO UPDATE SET display_name = EXCLUDED.display_name`,
        [
          author.did,
          author.handle,
          author.displayName,
          author.bio,
          author.orcid ?? null,
          author.affiliations,
          author.fieldIds,
          author.pdsUrl,
        ]
      );
    }

    // Seed eprints with new author model
    for (const eprint of TEST_EPRINTS) {
      const author = TEST_AUTHORS.find((a) => a.did === eprint.authorDid);
      const authorsArray = [
        {
          did: eprint.authorDid,
          name: author?.displayName ?? eprint.authorDid,
          order: 1,
          affiliations: author?.affiliations?.map((name) => ({ name })) ?? [],
          contributions: [],
          isCorrespondingAuthor: true,
          isHighlighted: false,
        },
      ];

      // Convert plain text abstract to RichTextBody format
      const abstractRichText = {
        type: 'RichText',
        items: [{ type: 'text', content: eprint.abstract }],
        format: 'application/x-chive-gloss+json',
      };

      await client.query(
        `INSERT INTO eprints_index (
          uri, cid, authors, submitted_by, title, abstract, abstract_plain_text,
          document_blob_cid, document_blob_mime_type, document_blob_size,
          document_format, keywords, license, publication_status,
          created_at, indexed_at, pds_url
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (uri) DO UPDATE SET title = EXCLUDED.title, indexed_at = EXCLUDED.indexed_at`,
        [
          eprint.uri,
          eprint.cid,
          JSON.stringify(authorsArray),
          eprint.authorDid,
          eprint.title,
          JSON.stringify(abstractRichText),
          eprint.abstract,
          eprint.documentBlobCid,
          eprint.documentBlobMimeType,
          eprint.documentBlobSize,
          'pdf',
          eprint.keywords,
          eprint.license,
          'eprint',
          eprint.createdAt,
          new Date().toISOString(),
          eprint.pdsUrl,
        ]
      );
    }

    // Seed tags
    for (const tag of TEST_TAGS) {
      await client.query(
        `INSERT INTO user_tags_index (uri, cid, eprint_uri, tagger_did, tag, created_at, pds_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (uri) DO UPDATE SET tag = EXCLUDED.tag`,
        [tag.uri, tag.cid, tag.eprintUri, tag.taggerDid, tag.tag, tag.createdAt, tag.pdsUrl]
      );
    }

    // Check if backlinks table exists and seed
    const backlinksTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'backlinks'
      )
    `);

    if (backlinksTableCheck.rows[0].exists) {
      await client.query("DELETE FROM backlinks WHERE source_uri LIKE 'at://did:plc:%'");
      await client.query("DELETE FROM backlink_counts WHERE target_uri LIKE 'at://did:plc:%'");

      for (const backlink of TEST_BACKLINKS) {
        await client.query(
          `INSERT INTO backlinks (source_uri, source_type, source_did, target_uri, context, indexed_at, is_deleted)
           VALUES ($1, $2, $3, $4, $5, $6, false)
           ON CONFLICT (source_uri) DO UPDATE SET context = EXCLUDED.context`,
          [
            backlink.sourceUri,
            backlink.sourceType,
            backlink.sourceDid,
            backlink.targetUri,
            backlink.context,
            backlink.indexedAt,
          ]
        );
      }

      const targetUris = [...new Set(TEST_BACKLINKS.map((b) => b.targetUri))];
      for (const targetUri of targetUris) {
        await client.query(`SELECT refresh_backlink_counts($1)`, [targetUri]);
      }

      console.log(`  PostgreSQL: Seeded ${TEST_BACKLINKS.length} backlinks`);
    }

    // Create eprint_enrichment table if needed
    await client.query(`
      CREATE TABLE IF NOT EXISTS eprint_enrichment (
        uri TEXT PRIMARY KEY,
        semantic_scholar_id TEXT,
        openalex_id TEXT,
        citation_count INTEGER,
        influential_citation_count INTEGER,
        references_count INTEGER,
        concepts JSONB,
        topics JSONB,
        enriched_at TIMESTAMPTZ
      )
    `);

    await client.query("DELETE FROM eprint_enrichment WHERE uri LIKE 'at://did:plc:%'");

    for (const enrichment of TEST_ENRICHMENTS) {
      await client.query(
        `INSERT INTO eprint_enrichment (
          uri, semantic_scholar_id, openalex_id, citation_count,
          influential_citation_count, references_count, concepts, topics, enriched_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (uri) DO UPDATE SET
          citation_count = EXCLUDED.citation_count,
          enriched_at = EXCLUDED.enriched_at`,
        [
          enrichment.uri,
          enrichment.semanticScholarId,
          enrichment.openAlexId,
          enrichment.citationCount,
          enrichment.influentialCitationCount,
          enrichment.referencesCount,
          JSON.stringify(enrichment.concepts),
          JSON.stringify(enrichment.topics),
          enrichment.enrichedAt,
        ]
      );
    }

    console.log(`  PostgreSQL: Seeded ${TEST_ENRICHMENTS.length} enrichment records`);

    // Seed E2E test user as approved alpha tester
    const alphaTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'alpha_applications'
      )
    `);

    if (alphaTableCheck.rows[0].exists) {
      await client.query('DELETE FROM alpha_applications WHERE did = $1', [E2E_TEST_USER.did]);

      await client.query(
        `INSERT INTO alpha_applications (
          did, handle, email, sector, career_stage, affiliations, research_keywords, status,
          created_at, updated_at, reviewed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', NOW(), NOW(), NOW())`,
        [
          E2E_TEST_USER.did,
          E2E_TEST_USER.handle,
          E2E_TEST_USER.email,
          E2E_TEST_USER.sector,
          E2E_TEST_USER.careerStage,
          JSON.stringify([{ name: 'E2E Test Institution' }]),
          JSON.stringify([{ label: E2E_TEST_USER.researchField }]),
        ]
      );
      console.log('  PostgreSQL: Seeded E2E test user as approved alpha tester');
    }

    // Seed E2E test user as author
    await client.query(
      `INSERT INTO authors_index (did, handle, display_name, bio, affiliations, field_ids, pds_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (did) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [
        E2E_TEST_USER.did,
        E2E_TEST_USER.handle,
        E2E_TEST_USER.displayName,
        'E2E Test User account for automated testing',
        ['Chive Test Lab'],
        ['computational-linguistics'],
        E2E_TEST_USER.pdsUrl,
      ]
    );

    console.log(
      `  PostgreSQL: Seeded ${TEST_AUTHORS.length + 1} authors, ${TEST_EPRINTS.length} eprints, ${TEST_TAGS.length} tags`
    );
  } catch (error) {
    console.error(`  PostgreSQL: Seed FAILED - ${(error as Error).message}`);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Seed Elasticsearch with test data.
 */
export async function seedElasticsearch(): Promise<void> {
  const client = new ElasticsearchClient({ node: ELASTICSEARCH_URL });

  try {
    await client.cluster.health();
    console.log('  Elasticsearch: Connected');

    // Ensure data stream exists
    let dataStreamExists = false;
    try {
      const dsResponse = await client.indices.getDataStream({ name: 'eprints' });
      dataStreamExists = dsResponse.data_streams.length > 0;
    } catch {
      // Data stream doesn't exist yet
    }

    if (!dataStreamExists) {
      console.log('  Elasticsearch: Setting up data stream template and ILM policy...');
      const { setupElasticsearch } = await import('../src/storage/elasticsearch/setup.js');
      await setupElasticsearch(client);
      console.log('  Elasticsearch: Data stream created');
    }

    // Delete existing test documents
    await client
      .deleteByQuery({
        index: 'eprints',
        body: { query: { wildcard: { uri: 'at://did:plc:*' } } },
        refresh: true,
      })
      .catch(() => {});

    // Index eprints into data stream
    const operations = TEST_EPRINTS.flatMap((p) => {
      const author = TEST_AUTHORS.find((a) => a.did === p.authorDid);
      return [
        { create: { _index: 'eprints' } },
        {
          '@timestamp': new Date().toISOString(),
          uri: p.uri,
          cid: p.cid,
          rkey: p.uri.split('/').pop() ?? '',
          title: p.title,
          abstract: p.abstract,
          keywords: p.keywords,
          authors: [
            {
              did: author?.did ?? p.authorDid,
              name: author?.displayName ?? '',
              orcid: author?.orcid,
              affiliation: author?.affiliations?.[0],
              order: 0,
            },
          ],
          citation_count: 0,
          endorsement_count: 0,
          view_count: 0,
          download_count: 0,
          created_at: p.createdAt,
          indexed_at: new Date().toISOString(),
          version: p.version,
          license: p.license,
          pds_url: p.pdsUrl,
          pds_endpoint: new URL(p.pdsUrl).host,
          document_blob_ref: {
            cid: p.documentBlobCid,
            mime_type: p.documentBlobMimeType,
            size: p.documentBlobSize,
          },
          document_metadata: {
            content_type: p.documentBlobMimeType,
            file_size: p.documentBlobSize,
          },
        },
      ];
    });

    const result = await client.bulk({ body: operations, refresh: true });
    if (result.errors) {
      const errors = result.items.filter((item) => item.create?.error);
      console.error('  Elasticsearch: Bulk indexing had errors:', JSON.stringify(errors, null, 2));
    }
    console.log(`  Elasticsearch: Indexed ${TEST_EPRINTS.length} eprints to data stream`);
  } catch (error) {
    console.error(`  Elasticsearch: Seed FAILED - ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Seed Neo4j with test data.
 */
export async function seedNeo4j(): Promise<void> {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

  try {
    const session = driver.session();
    await session.run('RETURN 1');
    console.log('  Neo4j: Connected');

    // Clear existing test fields
    await session.run("MATCH (f:Field) WHERE f.id <> 'root' DETACH DELETE f");

    // Create fields with approved status
    for (const field of TEST_FIELDS) {
      await session.run(
        `MERGE (f:Field {id: $id}) SET f.label = $label, f.name = $label, f.status = 'approved', f.createdAt = datetime(), f.updatedAt = datetime()`,
        { id: field.id, label: field.label }
      );
    }

    // Create hierarchy
    for (const field of TEST_FIELDS) {
      const parentId = field.parentId ?? 'root';
      await session.run(
        `MATCH (child:Field {id: $childId})
         MATCH (parent:Field {id: $parentId})
         MERGE (child)-[:SUBFIELD_OF]->(parent)`,
        { childId: field.id, parentId }
      );
    }

    // Clear existing test proposals
    await session.run(
      "MATCH (p:FieldProposal) WHERE p.id STARTS WITH 'proposal-test' DETACH DELETE p"
    );

    // Seed governance proposals
    for (const proposal of TEST_PROPOSALS) {
      await session.run(
        `CREATE (p:FieldProposal {
          id: $id,
          uri: $uri,
          category: $category,
          fieldName: $fieldName,
          alternateNames: $alternateNames,
          description: $description,
          proposalType: $proposalType,
          rationale: $rationale,
          evidence: $evidence,
          references: $references,
          status: $status,
          proposedBy: $proposedBy,
          createdAt: datetime($createdAt),
          updatedAt: datetime($createdAt)
        })`,
        {
          id: proposal.id,
          uri: proposal.uri,
          category: proposal.category,
          fieldName: proposal.fieldName,
          alternateNames: proposal.alternateNames,
          description: proposal.description,
          proposalType: proposal.proposalType,
          rationale: proposal.rationale,
          evidence: proposal.evidence,
          references: proposal.references,
          status: proposal.status,
          proposedBy: proposal.proposerDid,
          createdAt: proposal.createdAt,
        }
      );
    }

    await session.close();
    console.log(`  Neo4j: Seeded ${TEST_FIELDS.length} fields, ${TEST_PROPOSALS.length} proposals`);
  } catch (error) {
    console.error(`  Neo4j: Seed FAILED - ${(error as Error).message}`);
    throw error;
  } finally {
    await driver.close();
  }
}

/**
 * Main function - seeds all databases.
 */
export async function seedTestData(): Promise<void> {
  console.log('\n🌱 Seeding test data...\n');

  await seedPostgres();
  await seedElasticsearch();
  await seedNeo4j();

  console.log('\n✅ Test data seeding complete\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}
