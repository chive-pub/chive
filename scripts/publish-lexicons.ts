#!/usr/bin/env npx tsx
/**
 * Publish Chive's lexicon schemas to the dedicated lexicon account on the
 * governance PDS.
 *
 * @remarks
 * The `pub.chive.*` lexicons live in their own account on Chive's governance
 * PDS (`governance.chive.pub`), NOT in the `chive.pub` Bluesky account on
 * `pds.chive.pub` (that account is only for Bluesky posts; an earlier run
 * mistakenly published the lexicons there). `_lexicon.chive.pub` must point at
 * this lexicon account's DID so external services resolve `pub.chive.*` from
 * the governance PDS.
 *
 * The PDS serves each schema as a `com.atproto.lexicon.schema` record
 * (rkey = the NSID). Editing a lexicon JSON file in this repo does NOT update
 * those records — they must be re-`putRecord`ed. This script does that,
 * idempotently: it reads the same files the lexicon server serves (via
 * {@link getLexiconRecords}), compares each against what the PDS currently
 * holds, and writes only the ones that changed.
 *
 * Configuration (env):
 * - `LEXICON_PDS_URL`           PDS endpoint (default `https://governance.chive.pub`)
 * - `LEXICON_PUBLISH_IDENTIFIER` account handle/DID (default `lexicons.governance.chive.pub`)
 * - `LEXICON_PUBLISH_PASSWORD`  account/app password (required unless `--dry-run`)
 *
 * Usage:
 *   pnpm tsx scripts/publish-lexicons.ts [--dry-run] [nsid ...]
 *
 * Examples:
 *   # Preview what would change against the live PDS (no credentials needed):
 *   pnpm tsx scripts/publish-lexicons.ts --dry-run
 *
 *   # Publish every lexicon that has drifted:
 *   LEXICON_PUBLISH_PASSWORD=xxxx pnpm tsx scripts/publish-lexicons.ts
 *
 *   # Publish only specific NSIDs:
 *   LEXICON_PUBLISH_PASSWORD=xxxx pnpm tsx scripts/publish-lexicons.ts pub.chive.basicReader
 *
 * @packageDocumentation
 */

import { AtpAgent } from '@atproto/api';

import {
  CHIVE_LEXICON_DID,
  LEXICON_COLLECTION,
  getLexiconRecords,
} from '../src/atproto/lexicon-server/loader.js';

const PDS_URL = process.env.LEXICON_PDS_URL ?? 'https://governance.chive.pub';
const IDENTIFIER = process.env.LEXICON_PUBLISH_IDENTIFIER ?? 'lexicons.governance.chive.pub';
const PASSWORD = process.env.LEXICON_PUBLISH_PASSWORD;

interface Plan {
  nsid: string;
  action: 'create' | 'update' | 'skip';
  value: Record<string, unknown>;
}

/**
 * Stable JSON stringify (recursively sorted keys) for order-independent
 * structural comparison of two lexicon record values.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Fetch the currently published record value for an NSID, or null if absent.
 */
async function fetchPublished(
  agent: AtpAgent,
  repo: string,
  nsid: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo,
      collection: LEXICON_COLLECTION,
      rkey: nsid,
    });
    return res.data.value as Record<string, unknown>;
  } catch (error) {
    const name = (error as { error?: string }).error;
    const message = error instanceof Error ? error.message : String(error);
    if (name === 'RecordNotFound' || /could not locate record/i.test(message)) {
      return null;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const nsidFilter = new Set(args.filter((a) => !a.startsWith('--')));

  // The lexicon account is only the authority for `pub.chive.*` NSIDs.
  // Other namespaces present in lexicons/ (com.atproto.*, site.standard.*) are
  // vendored copies for local codegen/validation and belong to other
  // authorities — publishing them under this account would be incorrect.
  const PUBLISHABLE_PREFIX = 'pub.chive.';
  const records = getLexiconRecords();
  const selected = [...records.entries()].filter(
    ([nsid]) =>
      nsid.startsWith(PUBLISHABLE_PREFIX) && (nsidFilter.size === 0 || nsidFilter.has(nsid))
  );

  const skippedForeign = [...nsidFilter].filter((n) => !n.startsWith(PUBLISHABLE_PREFIX));
  if (skippedForeign.length > 0) {
    console.warn(
      `Ignoring non-pub.chive NSIDs (other authorities own them): ${skippedForeign.join(', ')}`
    );
  }

  if (selected.length === 0) {
    console.error('No matching pub.chive.* lexicons found to publish.');
    process.exit(1);
  }

  console.log(`Lexicon publish ${dryRun ? '(dry run)' : ''}`);
  console.log(`  PDS:        ${PDS_URL}`);
  console.log(`  Account:    ${IDENTIFIER}`);
  console.log(`  Repo DID:   resolved at login (lexicon URIs use ${CHIVE_LEXICON_DID})`);
  console.log(`  Candidates: ${selected.length}`);

  // A logged-in agent is only needed to write. For comparison we read public
  // records, so --dry-run works without credentials.
  const agent = new AtpAgent({ service: PDS_URL });
  let repo: string;

  if (dryRun) {
    repo = IDENTIFIER;
  } else {
    if (!PASSWORD) {
      console.error('LEXICON_PUBLISH_PASSWORD is required (or pass --dry-run).');
      process.exit(1);
    }
    await agent.login({ identifier: IDENTIFIER, password: PASSWORD });
    repo = agent.session?.did ?? IDENTIFIER;
    console.log(`  Logged in:  ${repo}`);
  }

  // Build the plan: compare each candidate against what the PDS holds.
  const plan: Plan[] = [];
  for (const [nsid, record] of selected) {
    const published = await fetchPublished(agent, repo, nsid);
    if (published === null) {
      plan.push({ nsid, action: 'create', value: record.value });
    } else if (canonical(published) !== canonical(record.value)) {
      plan.push({ nsid, action: 'update', value: record.value });
    } else {
      plan.push({ nsid, action: 'skip', value: record.value });
    }
  }

  const toWrite = plan.filter((p) => p.action !== 'skip');
  for (const p of plan) {
    if (p.action !== 'skip') console.log(`  ${p.action.toUpperCase()}: ${p.nsid}`);
  }
  console.log(`\n${toWrite.length} change(s), ${plan.length - toWrite.length} already in sync.`);

  if (dryRun) {
    console.log('Dry run: no records written.');
    return;
  }

  if (toWrite.length === 0) {
    console.log('Nothing to publish.');
    return;
  }

  // Apply: putRecord is an upsert keyed by rkey, so this is idempotent.
  let written = 0;
  for (const p of toWrite) {
    await agent.com.atproto.repo.putRecord({
      repo,
      collection: LEXICON_COLLECTION,
      rkey: p.nsid,
      record: p.value,
    });

    // Verify the write landed and matches.
    const after = await fetchPublished(agent, repo, p.nsid);
    if (!after || canonical(after) !== canonical(p.value)) {
      throw new Error(`Verification failed for ${p.nsid}: published record does not match source`);
    }
    console.log(`  ✓ published ${p.nsid}`);
    written += 1;
  }

  console.log(`\nPublished ${written} lexicon record(s).`);
}

main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
