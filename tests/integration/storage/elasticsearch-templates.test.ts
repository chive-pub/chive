/**
 * Elasticsearch index template integration tests.
 *
 * @remarks
 * Verifies Elasticsearch configuration:
 * - Index templates applied correctly
 * - Custom analyzers configured
 * - ILM policies active
 * - Index aliases functional
 *
 * @packageDocumentation
 */

import { Client } from '@elastic/elasticsearch';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createElasticsearchClient } from '@/storage/elasticsearch/setup.js';

/**
 * Type definitions for Elasticsearch index template responses
 */
type ElasticsearchAnalyzer = Record<string, unknown>;

interface ElasticsearchAnalysis {
  analyzer?: ElasticsearchAnalyzer;
}

type ElasticsearchSettings = {
  analysis?: ElasticsearchAnalysis;
} & Record<string, unknown>;

type ElasticsearchFieldMapping = {
  type?: string;
  fields?: Record<
    string,
    {
      type?: string;
    } & Record<string, unknown>
  >;
  properties?: Record<string, unknown>;
} & Record<string, unknown>;

type ElasticsearchMappings = {
  properties?: Record<string, ElasticsearchFieldMapping>;
} & Record<string, unknown>;

describe('Elasticsearch Templates', () => {
  let client: Client;

  beforeAll(() => {
    client = createElasticsearchClient();
    // Note: Setup is run in global setup (tests/setup/global-setup.ts)
  });

  afterAll(async () => {
    await client.close();
  });

  describe('Index Template', () => {
    it('applies preprints index template', async () => {
      const response = await client.indices.getIndexTemplate({
        name: 'preprints',
      });

      expect(response.index_templates).toHaveLength(1);
      expect(response.index_templates[0]?.name).toBe('preprints');
    });

    it('template is configured as data stream', async () => {
      const response = await client.indices.getIndexTemplate({
        name: 'preprints',
      });

      const template = response.index_templates[0];
      expect(template).toBeDefined();
      expect(template?.index_template.index_patterns).toContain('preprints');
      // Data stream templates have a data_stream property
      expect(template?.index_template.data_stream).toBeDefined();
    });

    it('configures custom analyzers', async () => {
      const response = await client.indices.getIndexTemplate({
        name: 'preprints',
      });

      const template = response.index_templates[0];
      expect(template).toBeDefined();
      const settings = template?.index_template.template?.settings as Record<string, unknown>;
      const index = settings?.index as ElasticsearchSettings | undefined;

      expect(index?.analysis?.analyzer).toBeDefined();
      expect(index?.analysis?.analyzer).toHaveProperty('preprint_analyzer');
      expect(index?.analysis?.analyzer).toHaveProperty('keyword_analyzer');
    });

    it('configures mappings for preprint fields', async () => {
      const response = await client.indices.getIndexTemplate({
        name: 'preprints',
      });

      const template = response.index_templates[0];
      expect(template).toBeDefined();
      const mappings = template?.index_template.template?.mappings as ElasticsearchMappings;

      expect(mappings?.properties).toBeDefined();
      expect(mappings?.properties).toHaveProperty('uri');
      expect(mappings?.properties).toHaveProperty('cid');
      expect(mappings?.properties).toHaveProperty('title');
      expect(mappings?.properties).toHaveProperty('abstract');
      expect(mappings?.properties).toHaveProperty('facets');
      expect(mappings?.properties).toHaveProperty('pds_url');
    });

    it('configures facets mapping with properties', async () => {
      const response = await client.indices.getIndexTemplate({
        name: 'preprints',
      });

      const template = response.index_templates[0];
      expect(template).toBeDefined();
      const mappings = template?.index_template.template?.mappings as ElasticsearchMappings;

      const facetsMapping = mappings?.properties?.facets;
      expect(facetsMapping?.type).toBeUndefined();
      expect(facetsMapping?.properties).toBeDefined();
    });

    it('configures completion suggester for title', async () => {
      const response = await client.indices.getIndexTemplate({
        name: 'preprints',
      });

      const template = response.index_templates[0];
      expect(template).toBeDefined();
      const mappings = template?.index_template.template?.mappings as ElasticsearchMappings;

      const titleMapping = mappings?.properties?.title;
      expect(titleMapping?.fields?.suggest?.type).toBe('completion');
    });
  });

  describe('ILM Policy', () => {
    it('creates ILM policy', async () => {
      const response = await client.ilm.getLifecycle({
        name: 'preprints_ilm_policy',
      });

      expect(response).toHaveProperty('preprints_ilm_policy');
    });

    it('configures hot/warm/cold tiers', async () => {
      const response = await client.ilm.getLifecycle({
        name: 'preprints_ilm_policy',
      });

      const policy = response.preprints_ilm_policy?.policy;
      expect(policy?.phases).toBeDefined();
      expect(policy?.phases).toHaveProperty('hot');
      expect(policy?.phases).toHaveProperty('warm');
      expect(policy?.phases).toHaveProperty('cold');
    });

    it('hot phase configures rollover', async () => {
      const response = await client.ilm.getLifecycle({
        name: 'preprints_ilm_policy',
      });

      const hotPhase = response.preprints_ilm_policy?.policy?.phases?.hot;
      expect(hotPhase?.actions).toHaveProperty('rollover');
    });

    it('warm phase configures force merge', async () => {
      const response = await client.ilm.getLifecycle({
        name: 'preprints_ilm_policy',
      });

      const warmPhase = response.preprints_ilm_policy?.policy?.phases?.warm;
      expect(warmPhase?.actions).toHaveProperty('forcemerge');
    });
  });

  describe('Data Stream Bootstrap', () => {
    it('creates preprints data stream', async () => {
      const response = await client.indices.getDataStream({
        name: 'preprints',
      });

      expect(response.data_streams).toHaveLength(1);
      expect(response.data_streams[0]?.name).toBe('preprints');
    });

    it('data stream has backing indices', async () => {
      const response = await client.indices.getDataStream({
        name: 'preprints',
      });

      const dataStream = response.data_streams[0];
      expect(dataStream?.indices).toBeDefined();
      expect(dataStream?.indices.length).toBeGreaterThanOrEqual(1);
    });

    it('data stream uses ILM policy', async () => {
      const response = await client.indices.getDataStream({
        name: 'preprints',
      });

      const dataStream = response.data_streams[0];
      expect(dataStream?.ilm_policy).toBe('preprints_ilm_policy');
    });
  });

  describe('Health Check', () => {
    it('cluster is healthy', async () => {
      const response = await client.cluster.health();

      expect(['green', 'yellow']).toContain(response.status);
    });
  });
});
