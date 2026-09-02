#!/usr/bin/env -S npx tsx

/**
 * End-to-end check that a foreign record produces a backlink.
 *
 * @remarks
 * The backlink pipeline has five independent links, and a break in any of them
 * looks identical from outside — no backlink appears:
 *
 * 1. the collection is in the observed set, so the firehose filter admits it;
 * 2. a plugin is loaded that subscribes to it;
 * 3. the plugin's extraction finds the eprint reference in the record;
 * 4. `backlinks.source_type` permits the value the plugin writes;
 * 5. the API and UI render the stored row.
 *
 * Unit tests cover 3 and 4 in isolation. This exercises all five against a
 * running deployment by writing a real record to a real repository, waiting for
 * it to come back around through the relay, and then deleting it.
 *
 * Run it against staging before production. It writes to whichever repository
 * the credentials belong to and removes what it wrote, including on failure.
 *
 * With no arguments it authenticates from `notes/lexicon-account-credentials.md`,
 * targets staging, and picks an indexed eprint to reference:
 *
 *   ./scripts/verify-backlink-pipeline.ts
 *
 * Any of `PDS_URL`, `PDS_IDENTIFIER`, `PDS_PASSWORD`, `API_URL`, `EPRINT_URI`
 * and `TIMEOUT_MS` overrides that. Point `API_URL` at production only once it
 * has passed against staging.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AtpAgent } from '@atproto/api';

const CREDENTIALS_FILE = 'notes/lexicon-account-credentials.md';

/**
 * Reads a value out of the local credentials note.
 *
 * @param labels - Markdown labels to try, in order, such as `Account password`
 * @param key - `KEY=value` form to fall back to
 * @returns The value, or undefined when the note does not carry one
 *
 * @remarks
 * The note is gitignored working material and already holds the account this
 * check authenticates as, so the usual run needs no arguments. An explicit
 * environment variable still wins, which is how you point it at a different
 * repository.
 *
 * Labelled lines are read before `KEY=value` ones. The note documents the
 * credential as `- **Account password:** \`value\`` and separately shows an
 * example command containing `LEXICON_PUBLISH_PASSWORD=...`; matching the
 * bare key first picks up the example's placeholder rather than the
 * credential, and the failure looks like a wrong password rather than a
 * parsing bug.
 */
function fromCredentialsFile(labels: readonly string[], key: string): string | undefined {
  let contents: string;
  try {
    contents = readFileSync(join(process.cwd(), CREDENTIALS_FILE), 'utf8');
  } catch {
    return undefined;
  }

  for (const label of labels) {
    const labelled = new RegExp(`\\*\\*${label}:?\\*\\*:?\\s*\`([^\`]+)\``, 'i').exec(contents);
    if (labelled?.[1]) return labelled[1].trim();
  }

  return new RegExp(`^\\s*\`?${key}=([^\\s\`]+)`, 'm').exec(contents)?.[1];
}

const PDS_URL = process.env.PDS_URL ?? 'https://governance.chive.pub';
const API_URL = process.env.API_URL ?? 'https://api.staging.chive.pub';
const IDENTIFIER =
  process.env.PDS_IDENTIFIER ?? fromCredentialsFile(['Handle'], 'LEXICON_PUBLISH_IDENTIFIER');
const PASSWORD =
  process.env.PDS_PASSWORD ??
  fromCredentialsFile(['Account password', 'App password'], 'LEXICON_PUBLISH_PASSWORD');

/** How long to wait for the record to travel the firehose and be indexed. */
const TIMEOUT_MS = Number.parseInt(process.env.TIMEOUT_MS ?? '180000', 10);
const POLL_MS = 5000;

function required(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

async function backlinkCount(eprintUri: string): Promise<number> {
  const url = `${API_URL}/xrpc/pub.chive.backlink.list?targetUri=${encodeURIComponent(eprintUri)}&limit=50`;
  const response = await fetch(url);
  if (!response.ok) return 0;
  const body = (await response.json()) as { backlinks?: unknown[] };
  return body.backlinks?.length ?? 0;
}

/**
 * Picks an eprint to reference when the caller did not name one.
 *
 * @remarks
 * Any indexed eprint proves the pipeline equally well, and looking one up
 * removes the last argument the check needs.
 */
async function anyEprintUri(): Promise<string | undefined> {
  try {
    const response = await fetch(`${API_URL}/xrpc/pub.chive.eprint.searchSubmissions?q=*&limit=1`);
    if (!response.ok) return undefined;
    // `searchSubmissions` returns `hits`, not `eprints`.
    const body = (await response.json()) as { hits?: { uri?: string }[] };
    return body.hits?.[0]?.uri;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const identifier = required(
    `PDS_IDENTIFIER (or LEXICON_PUBLISH_IDENTIFIER in ${CREDENTIALS_FILE})`,
    IDENTIFIER
  );
  const password = required(
    `PDS_PASSWORD (or LEXICON_PUBLISH_PASSWORD in ${CREDENTIALS_FILE})`,
    PASSWORD
  );
  const eprintUri = required(
    'EPRINT_URI (and none could be found to pick automatically)',
    process.env.EPRINT_URI ?? (await anyEprintUri())
  );

  console.log(`PDS:    ${PDS_URL}`);
  console.log(`API:    ${API_URL}`);
  console.log(`Eprint: ${eprintUri}`);

  const agent = new AtpAgent({ service: PDS_URL });
  await agent.login({ identifier, password });
  const did = agent.did;
  if (!did) throw new Error('Login produced no DID');
  console.log(`Authenticated as ${identifier} (${did})`);

  const before = await backlinkCount(eprintUri);
  console.log(`Backlinks on the eprint before: ${String(before)}`);

  // A minimal `pub.leaflet.document` carrying the eprint as an inline richtext
  // link — the route a blogger actually uses.
  const record = {
    $type: 'pub.leaflet.document',
    title: 'Backlink pipeline check (temporary)',
    description: 'Written by scripts/verify-backlink-pipeline.ts. Safe to delete.',
    author: did,
    publishedAt: new Date().toISOString(),
    pages: [
      {
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [
          {
            block: {
              $type: 'pub.leaflet.blocks.text',
              plaintext: 'Testing a reference to an eprint.',
              facets: [
                {
                  index: { byteStart: 0, byteEnd: 7 },
                  features: [{ $type: 'pub.leaflet.richtext.facet#link', uri: eprintUri }],
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const created = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.leaflet.document',
    record,
  });
  console.log(`Wrote ${created.data.uri}`);

  let found = false;
  try {
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      const now = await backlinkCount(eprintUri);
      const waited = Math.round((TIMEOUT_MS - (deadline - Date.now())) / 1000);
      console.log(`  ${String(waited)}s — backlinks: ${String(now)}`);
      if (now > before) {
        found = true;
        break;
      }
    }
  } finally {
    // Always clean up, including when the check fails or is interrupted.
    const rkey = created.data.uri.split('/').pop();
    if (rkey) {
      await agent.com.atproto.repo.deleteRecord({
        repo: did,
        collection: 'pub.leaflet.document',
        rkey,
      });
      console.log(`Deleted ${created.data.uri}`);
    }
  }

  if (found) {
    console.log('\nPASS — the record produced a backlink.');
  } else {
    console.log(
      '\nFAIL — no backlink appeared within the timeout.\n' +
        'Check, in order: the collection is observed, the plugin is loaded, ' +
        'extraction finds the reference, and source_type is permitted.'
    );
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
