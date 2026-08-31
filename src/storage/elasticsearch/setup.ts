/**
 * Elasticsearch index setup and management.
 *
 * @remarks
 * Sets up Elasticsearch index templates and ILM policies for eprints.
 * Handles:
 * - Index template creation
 * - ILM policy application
 * - Index health checks
 * - Initial index bootstrapping
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type estypes } from '@elastic/elasticsearch';

import { DatabaseError } from '../../types/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Elasticsearch configuration.
 *
 * @remarks
 * Loads from environment variables with defaults for local development.
 *
 * @public
 */
export interface ElasticsearchConfig {
  /**
   * Elasticsearch node URL.
   *
   * @defaultValue 'http://localhost:9200'
   */
  node: string;

  /**
   * Authentication credentials (if required).
   */
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * Loads Elasticsearch configuration from environment.
 *
 * @returns Elasticsearch client configuration
 *
 * @remarks
 * Environment variables:
 * - `ELASTICSEARCH_URL` - Node URL (default: http://localhost:9200)
 * - `ELASTICSEARCH_USER` - Username (optional)
 * - `ELASTICSEARCH_PASSWORD` - Password (optional)
 *
 * @public
 */
export function getElasticsearchConfig(): ElasticsearchConfig {
  const config: ElasticsearchConfig = {
    node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  };

  if (process.env.ELASTICSEARCH_USER && process.env.ELASTICSEARCH_PASSWORD) {
    config.auth = {
      username: process.env.ELASTICSEARCH_USER,
      password: process.env.ELASTICSEARCH_PASSWORD,
    };
  }

  return config;
}

/**
 * Creates Elasticsearch client instance.
 *
 * @returns Configured Elasticsearch client
 *
 * @public
 */
export function createElasticsearchClient(): Client {
  const config = getElasticsearchConfig();
  return new Client(config);
}

/**
 * Loads JSON file as object.
 *
 * @param filename - Relative path to JSON file
 * @returns Parsed JSON object
 */
function loadJSON(filename: string): unknown {
  const path = join(__dirname, filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

/**
 * Sets up ILM policy for eprints index.
 *
 * @param client - Elasticsearch client
 *
 * @remarks
 * Creates ILM policy for hot/warm/cold tier management:
 * - Hot: Rollover at 50GB or 30 days
 * - Warm: Force merge to 1 segment
 * - Cold: Reduce priority
 *
 * @public
 */
export async function setupILMPolicy(client: Client): Promise<void> {
  const policyData = loadJSON('ilm/eprints_policy.json') as {
    policy: {
      phases: {
        hot?: { min_age?: string; actions: object };
        warm?: { min_age?: string; actions: object };
        cold?: { min_age?: string; actions: object };
      };
    };
  };

  await client.ilm.putLifecycle({
    name: 'eprints_ilm_policy',
    policy: policyData.policy,
  });
}

/**
 * Sets up index template for eprints.
 *
 * @param client - Elasticsearch client
 *
 * @remarks
 * Applies index template with:
 * - Custom analyzers (porter stemming, asciifolding, academic synonyms)
 * - 10-dimensional facet mappings (PMEST + FAST entities)
 * - Nested author mappings
 * - Completion suggester for autocomplete
 * - ILM policy attachment
 *
 * @public
 */
export async function setupIndexTemplate(client: Client): Promise<void> {
  const templateData = loadJSON('templates/eprints.json') as {
    index_patterns: string[];
    data_stream?: object;
    priority?: number;
    template: {
      settings?: object;
      mappings?: object;
    };
  };

  await client.indices.putIndexTemplate({
    name: 'eprints',
    index_patterns: templateData.index_patterns,
    data_stream: templateData.data_stream,
    priority: templateData.priority,
    template: templateData.template,
  });
}

/**
 * Sets up ingest pipeline for eprint processing.
 *
 * @param client - Elasticsearch client
 *
 * @remarks
 * Creates ingest pipeline for:
 * - PDF text extraction via attachment processor
 * - Computed field generation (author_count, year_published, etc.)
 * - Freshness score calculation (time decay function)
 * - Rank score computation (citations + endorsements + freshness)
 * - Error handling and failed document routing
 *
 * @public
 */
export async function setupIngestPipeline(client: Client): Promise<void> {
  const pipelineData = loadJSON('pipelines/eprint-processing.json') as {
    description: string;
    processors: Record<string, unknown>[];
    on_failure?: Record<string, unknown>[];
  };

  await client.ingest.putPipeline({
    id: 'eprint-processing',
    description: pipelineData.description,
    processors: pipelineData.processors as estypes.IngestProcessorContainer[],
    on_failure: pipelineData.on_failure as estypes.IngestProcessorContainer[] | undefined,
  });
}

/**
 * Creates the eprints index with an alias if it doesn't exist.
 *
 * @param client - Elasticsearch client
 *
 * @remarks
 * Uses a regular index with an alias (not a data stream) to support:
 * - Document IDs for upserts
 * - Updating existing documents when records change on PDS
 * - Zero-downtime reindexing via alias switching, implemented by
 *   {@link migrateIndexToCurrentMapping}
 *
 * The alias "eprints" points to the current index, "eprints-v1" initially.
 *
 * This function is bootstrap only: it returns early when the alias already
 * exists, so it will not apply a changed template to a live index. Index
 * mappings are fixed once created — Elasticsearch cannot remap in place — so
 * changing them requires building a new index and moving the alias, which is
 * what {@link migrateIndexToCurrentMapping} does.
 *
 * @public
 */
export async function bootstrapIndex(client: Client): Promise<void> {
  const indexName = 'eprints-v1';
  const aliasName = 'eprints';

  // Check if alias already exists
  const aliasExists = await client.indices.existsAlias({ name: aliasName });
  if (aliasExists) {
    // Alias exists, nothing to do
    return;
  }

  // Check if index already exists
  const indexExists = await client.indices.exists({ index: indexName });
  if (indexExists) {
    // Index exists but no alias - add the alias
    await client.indices.putAlias({ index: indexName, name: aliasName });
    return;
  }

  // Create index with alias
  await client.indices.create({
    index: indexName,
    aliases: {
      [aliasName]: {},
    },
  });
}

/**
 * Whether the live index was built from an older version of the template.
 *
 * @param client - Elasticsearch client
 * @returns The live and template versions, and whether they differ
 *
 * @remarks
 * Mappings are fixed once an index exists, so a template edit reaches a
 * deployment only through {@link migrateIndexToCurrentMapping}. Deciding
 * whether that is needed by diffing the live mapping against the template does
 * not work: Elasticsearch echoes back a normalised mapping with defaults
 * filled in, so a comparison reports differences that are not changes and the
 * deploy would rebuild the index every time.
 *
 * The template therefore carries `mappings._meta.templateVersion`, and an index
 * built from it carries that value. Bumping the number in the template is what
 * declares "this needs a new index"; anything else — a description, a comment —
 * changes nothing. An index built before the marker existed reports no version,
 * which counts as out of date.
 *
 * @public
 */
export async function checkIndexTemplateVersion(client: Client): Promise<{
  readonly liveVersion: number | null;
  readonly templateVersion: number;
  readonly needsMigration: boolean;
}> {
  const template = JSON.parse(
    readFileSync(join(__dirname, 'templates', 'eprints.json'), 'utf8')
  ) as { template: { mappings: { _meta?: { templateVersion?: number } } } };
  const templateVersion = template.template.mappings._meta?.templateVersion ?? 1;

  const aliased = await client.indices.getAlias({ name: 'eprints' });
  const [index] = Object.keys(aliased);
  if (index === undefined) {
    throw new DatabaseError('MIGRATE', 'Alias eprints resolves to no index');
  }

  const mapping = await client.indices.getMapping({ index });
  const meta = mapping[index]?.mappings._meta as { templateVersion?: number } | undefined;
  const liveVersion = meta?.templateVersion ?? null;

  return {
    liveVersion,
    templateVersion,
    needsMigration: liveVersion !== templateVersion,
  };
}

/**
 * Result of an index mapping migration.
 *
 * @public
 */
export interface IndexMigrationResult {
  /** Index the alias pointed at before the migration. */
  readonly from: string;
  /** Index the alias points at now. */
  readonly to: string;
  /** Documents copied into the new index. */
  readonly documentsReindexed: number;
  /** Whether the previous index was deleted. */
  readonly previousIndexDeleted: boolean;
}

/**
 * Rebuilds the eprints index against the current template and moves the alias.
 *
 * @param client - Elasticsearch client
 * @param options - `deletePrevious` removes the old index once the alias has moved
 * @returns What moved where, and how many documents were copied
 * @throws DatabaseError when the alias does not resolve to exactly one index
 *
 * @remarks
 * Elasticsearch mappings are fixed once an index exists, so a template edit
 * reaches a live deployment only by creating a new index and repointing the
 * alias. {@link bootstrapIndex} returns early when the alias exists and does
 * not do this, and the only path that applied a mapping change was a script
 * that deleted `eprints-v1` outright — full search downtime for the length of a
 * reindex, with no prompt, and nothing to fall back to if the rebuild failed
 * halfway.
 *
 * This performs the alias switch the module has always documented: create the
 * next version from the current template, copy the documents, then move the
 * alias in a single atomic action so no request sees the alias unset. Search
 * keeps serving the old index for the whole reindex and switches between one
 * request and the next.
 *
 * The previous index is kept by default. It is the only copy of the pre-migration
 * state, and keeping it makes the migration reversible by moving the alias back;
 * deleting it is a separate decision once the new index looks right.
 *
 * @public
 */
export async function migrateIndexToCurrentMapping(
  client: Client,
  options: { readonly deletePrevious?: boolean } = {}
): Promise<IndexMigrationResult> {
  const aliasName = 'eprints';

  const aliased = await client.indices.getAlias({ name: aliasName });
  const currentIndices = Object.keys(aliased);
  const [from] = currentIndices;

  // Checking the destructured value rather than the length narrows the type
  // without an assertion, and still rejects the several-indices case: an alias
  // spanning more than one index means someone has done something the version
  // arithmetic below cannot reason about, and guessing would move the wrong one.
  if (from === undefined || currentIndices.length !== 1) {
    throw new DatabaseError(
      'MIGRATE',
      `Alias ${aliasName} resolves to ${currentIndices.length} indices; expected exactly one`
    );
  }

  const version = Number.parseInt(/-v(\d+)$/.exec(from)?.[1] ?? '1', 10);
  const to = `${aliasName}-v${version + 1}`;

  // The template supplies the mappings, so the new index is built against
  // whatever the current template says rather than a copy kept in code.
  await client.indices.create({ index: to });

  const reindexed = await client.reindex({
    source: { index: from },
    dest: { index: to },
    refresh: true,
    wait_for_completion: true,
  });

  // One atomic action: the alias is never unset between the remove and the add.
  await client.indices.updateAliases({
    actions: [
      { remove: { index: from, alias: aliasName } },
      { add: { index: to, alias: aliasName } },
    ],
  });

  let previousIndexDeleted = false;
  if (options.deletePrevious === true) {
    await client.indices.delete({ index: from });
    previousIndexDeleted = true;
  }

  return {
    from,
    to,
    documentsReindexed: reindexed.created ?? 0,
    previousIndexDeleted,
  };
}

/**
 * Checks Elasticsearch cluster health.
 *
 * @param client - Elasticsearch client
 * @returns True if cluster is healthy (green or yellow)
 *
 * @remarks
 * Yellow status is acceptable (single-node development).
 * Red status indicates problems.
 *
 * @public
 */
export async function checkHealth(client: Client): Promise<boolean> {
  const health = await client.cluster.health();
  return health.status === 'green' || health.status === 'yellow';
}

/**
 * Sets up all Elasticsearch resources.
 *
 * @param client - Elasticsearch client
 *
 * @remarks
 * Performs complete setup:
 * 1. Create ILM policy
 * 2. Apply index template
 * 3. Create ingest pipeline
 * 4. Bootstrap initial index
 * 5. Verify health
 *
 * @throws Error if health check fails
 *
 * @example
 * ```typescript
 * import { createElasticsearchClient, setupElasticsearch } from './setup.js';
 *
 * const client = createElasticsearchClient();
 * await setupElasticsearch(client);
 * console.log('Elasticsearch ready');
 * ```
 *
 * @public
 */
export async function setupElasticsearch(client: Client): Promise<void> {
  await setupILMPolicy(client);
  await setupIndexTemplate(client);
  await setupIngestPipeline(client);
  await bootstrapIndex(client);

  const healthy = await checkHealth(client);
  if (!healthy) {
    throw new DatabaseError('HEALTH_CHECK', 'Elasticsearch cluster is not healthy');
  }
}
