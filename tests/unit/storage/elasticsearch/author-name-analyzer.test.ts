/**
 * Guards the analyzer that makes author names searchable.
 *
 * @remarks
 * `authors.name` was analyzed by `name_analyzer`, which used a **keyword**
 * tokenizer — so "Aaron Steven White" was indexed as the single token
 * `aaron steven white`, and no query for `white` could ever match it. Combined
 * with `authors.name` being listed in a flat `multi_match` it cannot reach
 * (`authors` is `nested`), author search matched nothing at all.
 *
 * These assertions are about the index template rather than a running cluster,
 * because the mapping is what has to be right before any document is indexed.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const templateDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../src/storage/elasticsearch/templates'
);

interface Template {
  template: {
    settings: {
      analysis: {
        analyzer: Record<string, { tokenizer?: string; filter?: string[] }>;
      };
    };
    mappings: {
      properties: Record<string, unknown>;
    };
  };
}

function loadTemplate(name: string): Template {
  return JSON.parse(readFileSync(join(templateDir, name), 'utf8')) as Template;
}

describe.each(['eprints.json', 'external-papers.json'])('%s name_analyzer', (file) => {
  const analyzer = loadTemplate(file).template.settings.analysis.analyzer.name_analyzer;

  it('splits names into tokens so a surname alone matches', () => {
    expect(analyzer).toBeDefined();
    // A keyword tokenizer emits the whole name as one token, which is what
    // made searching for a surname return nothing.
    expect(analyzer?.tokenizer).toBe('standard');
  });

  it('folds case and accents so "white" matches "White" and "Löwe" matches "Lowe"', () => {
    expect(analyzer?.filter).toContain('lowercase');
    expect(analyzer?.filter).toContain('asciifolding');
  });
});

describe('eprints authors mapping', () => {
  const authors = loadTemplate('eprints.json').template.mappings.properties.authors as {
    type?: string;
    properties?: { name?: { analyzer?: string; fields?: Record<string, unknown> } };
  };

  it('is nested, which is why search must use a nested query for it', () => {
    expect(authors.type).toBe('nested');
  });

  it('analyzes the name and keeps a keyword subfield for aggregations', () => {
    expect(authors.properties?.name?.analyzer).toBe('name_analyzer');
    // `authors.name.keyword` backs the author facet; losing it silently empties
    // that facet rather than failing.
    expect(authors.properties?.name?.fields).toHaveProperty('keyword');
  });
});
