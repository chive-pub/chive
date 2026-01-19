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
 * - Zero-downtime reindexing via alias switching
 *
 * The alias "eprints" points to the current index "eprints-v1".
 * Future migrations can create "eprints-v2" and switch the alias.
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
