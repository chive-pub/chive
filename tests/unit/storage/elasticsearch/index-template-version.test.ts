/**
 * Guards the mechanism that makes a mapping change reach a deployment.
 *
 * @remarks
 * Elasticsearch mappings are fixed once an index exists. `bootstrapIndex`
 * returns early when the alias exists, and the deploy's reindex copies
 * documents into whatever mapping the index already has — so editing the
 * template alone changes nothing in production. `templateVersion` in the
 * template's `_meta` is what declares that a new index is needed, and the
 * deploy migrates only when the live index reports a different one.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readTemplate(): { template: { mappings: { _meta?: { templateVersion?: number } } } } {
  return JSON.parse(
    readFileSync(join(repoRoot, 'src/storage/elasticsearch/templates/eprints.json'), 'utf8')
  ) as { template: { mappings: { _meta?: { templateVersion?: number } } } };
}

describe('eprints template version', () => {
  it('declares a version, which is what triggers a migration', () => {
    const version = readTemplate().template.mappings._meta?.templateVersion;

    expect(typeof version).toBe('number');
    expect(version).toBeGreaterThanOrEqual(1);
  });

  it('has been bumped past the unversioned original', () => {
    // Version 1 is the implicit version of an index built before the marker
    // existed. The author-name analyzer change is version 2; a template edit
    // that needs a new index must move this number or it will not ship.
    expect(readTemplate().template.mappings._meta?.templateVersion).toBeGreaterThanOrEqual(2);
  });
});

describe('deploy workflow', () => {
  const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy-app.yml'), 'utf8');

  it('applies mapping changes before reindexing', () => {
    const migrate = workflow.indexOf('migrate-elasticsearch-index.js');
    const reindex = workflow.indexOf('reindex-all-eprints.js');

    expect(migrate).toBeGreaterThan(-1);
    expect(reindex).toBeGreaterThan(-1);
    // Reindexing first would copy documents into the old mapping and the
    // migration would then copy them again into the new one — correct, but
    // twice the work for no reason.
    expect(migrate).toBeLessThan(reindex);
  });
});
