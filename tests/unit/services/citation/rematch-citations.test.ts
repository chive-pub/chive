/**
 * Guards the citation re-matching pass.
 *
 * @remarks
 * Citations are matched to Chive eprints once, during extraction, against
 * whatever was indexed at that moment. A reference to a paper that arrives
 * later can never match, and nothing revisits it — so the graph only ever holds
 * edges that were discoverable in extraction order, and grows more incomplete
 * as the corpus fills in behind it.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const service = readFileSync(
  join(process.cwd(), 'src/services/citation/citation-extraction-service.ts'),
  'utf8'
);
const workflow = readFileSync(join(process.cwd(), '.github/workflows/deploy-app.yml'), 'utf8');

describe('rematchStoredCitations', () => {
  it('exists', () => {
    expect(service).toContain('async rematchStoredCitations(');
  });

  it('only considers citations with no match yet', () => {
    // Re-running must never overwrite a match already recorded, and a second
    // run should do nothing.
    const body = service.slice(service.indexOf('async rematchStoredCitations('));
    expect(body.slice(0, 2500)).toContain('chive_match_uri IS NULL');
  });

  it('reuses the same DOI-then-title matching as extraction', () => {
    // Delegation, not duplication. The re-match used to carry its own copy of
    // the DOI-then-title logic, so every later strategy -- arXiv ids, the
    // stripping of GROBID's leading year labels, corroborated near-titles --
    // reached extraction and not the pass that actually runs on deploy.
    const body = service.slice(service.indexOf('async rematchStoredCitations('));
    expect(body.slice(0, 2500)).toContain('this.findMatch(');
    expect(body.slice(0, 2500)).not.toContain('findEprintByDoi');
  });

  it('refuses to link a paper to itself', () => {
    // An extracted reference can name the citing work, when a preprint lists
    // its own published version. That is not a citation edge.
    const body = service.slice(service.indexOf('async rematchStoredCitations('));
    expect(body.slice(0, 2500)).toContain('match.uri === row.eprint_uri');
  });

  it('creates the graph edges the original pass could not know about', () => {
    const body = service.slice(service.indexOf('async rematchStoredCitations('));
    expect(body.slice(0, 3000)).toContain('upsertCitationsBatch');
  });
});

describe('deploy', () => {
  it('re-matches after reindexing, so new eprints link up', () => {
    const reindex = workflow.indexOf('reindex-all-eprints.js');
    const rematch = workflow.indexOf('rematch-citations.js');

    expect(rematch).toBeGreaterThan(-1);
    // Re-matching before the reindex would run against the old corpus and
    // miss exactly the eprints the deploy just added.
    expect(rematch).toBeGreaterThan(reindex);
  });
});
