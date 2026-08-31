/**
 * MCP server over Chive's public read API.
 *
 * @remarks
 * Chive indexes eprints, their citations and their reviews, and answers
 * questions about them over unauthenticated XRPC. An agent that can call those
 * endpoints can use Chive as a literature backend — find work on a topic,
 * resolve a DOI to a record, follow a citation graph, read what people said
 * about a paper.
 *
 * This is a thin adapter, deliberately. It speaks to the same public HTTP API
 * any other client uses rather than reaching into the database, which means:
 *
 *   - it needs no credentials, and can be pointed at any Chive deployment;
 *   - it cannot read anything a browser could not;
 *   - it stays correct when a handler changes, because it is a caller like any
 *     other rather than a second implementation.
 *
 * Every tool here is read-only. Nothing writes to a repository, and there is no
 * authenticated surface: an agent acting on someone's behalf should hold their
 * own session rather than borrow one from a server.
 *
 * Run it over stdio:
 *
 * ```bash
 * pnpm mcp
 * CHIVE_API_URL=https://api.staging.chive.pub pnpm mcp
 * ```
 *
 * @packageDocumentation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/**
 * Default deployment this server reads from.
 *
 * @public
 */
export const DEFAULT_API_URL = 'https://api.chive.pub';

/**
 * How long to wait on any one call before giving up.
 *
 * @remarks
 * An agent waiting on a tool call is blocked, so a slow answer is worse than a
 * refused one.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Calls one XRPC method and returns its JSON body.
 *
 * @param apiUrl - Base URL of the Chive API
 * @param nsid - XRPC method to call
 * @param params - Query parameters; undefined values are omitted
 * @returns The parsed response body
 *
 * @throws Error when the call fails, times out, or the endpoint answers with an
 * error status. The message is what the agent sees, so it names the method.
 *
 * @public
 */
export async function callXrpc(
  apiUrl: string,
  nsid: string,
  params: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${apiUrl.replace(/\/$/, '')}/xrpc/${nsid}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(`${nsid} failed (${response.status}): ${body.message ?? 'no detail given'}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wraps a value as MCP tool output.
 *
 * @param value - Whatever the endpoint returned
 * @returns Tool content the SDK can serialise
 */
function asContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

/**
 * Builds the Chive MCP server.
 *
 * @param apiUrl - Base URL of the deployment to read from
 * @returns A configured server, not yet connected to a transport
 *
 * @public
 */
export function createChiveMcpServer(apiUrl: string = DEFAULT_API_URL): McpServer {
  const server = new McpServer({ name: 'chive', version: '0.1.0' });

  server.tool(
    'search_eprints',
    'Search Chive for eprints matching a query. Returns titles, abstracts, authors and AT-URIs.',
    {
      query: z.string().describe('Free-text search over titles, abstracts and keywords'),
      limit: z.number().int().min(1).max(50).optional().describe('Results to return, default 10'),
    },
    async ({ query, limit }) =>
      asContent(
        await callXrpc(apiUrl, 'pub.chive.eprint.searchSubmissions', {
          q: query,
          limit: limit ?? 10,
        })
      )
  );

  server.tool(
    'get_eprint',
    'Fetch one eprint by its AT-URI, with full metadata.',
    {
      uri: z.string().describe('AT-URI of the eprint, as returned by search_eprints'),
    },
    async ({ uri }) => asContent(await callXrpc(apiUrl, 'pub.chive.eprint.getSubmission', { uri }))
  );

  server.tool(
    'resolve_identifier',
    'Resolve an external identifier — a DOI, arXiv ID, ORCID, ROR, ISBN, PMID or Wikidata ID — to the Chive record that declares it. Answers {found: false} when Chive does not index that identifier, which is not the same as the work not existing.',
    {
      system: z
        .enum(['doi', 'arxiv', 'orcid', 'ror', 'isbn', 'pmid', 'wikidata'])
        .describe('Identifier system'),
      identifier: z.string().describe('The identifier itself, with no resolver prefix'),
    },
    async ({ system, identifier }) =>
      asContent(await callXrpc(apiUrl, 'pub.chive.resolve.byExternalId', { system, identifier }))
  );

  server.tool(
    'list_citations',
    'List the works an eprint cites, with their relation type where one is recorded.',
    {
      eprintUri: z.string().describe('AT-URI of the citing eprint'),
      limit: z.number().int().min(1).max(100).optional().describe('Results to return, default 50'),
    },
    async ({ eprintUri, limit }) =>
      asContent(
        await callXrpc(apiUrl, 'pub.chive.eprint.listCitations', { eprintUri, limit: limit ?? 50 })
      )
  );

  server.tool(
    'list_reviews',
    'List the reviews and comments left on an eprint.',
    {
      eprintUri: z.string().describe('AT-URI of the eprint'),
      limit: z.number().int().min(1).max(100).optional().describe('Results to return, default 25'),
    },
    async ({ eprintUri, limit }) =>
      asContent(
        await callXrpc(apiUrl, 'pub.chive.review.listForEprint', { eprintUri, limit: limit ?? 25 })
      )
  );

  return server;
}

/**
 * Entry point: serve over stdio until the client disconnects.
 *
 * @public
 */
export async function main(): Promise<void> {
  const apiUrl = process.env.CHIVE_API_URL ?? DEFAULT_API_URL;
  const server = createChiveMcpServer(apiUrl);
  await server.connect(new StdioServerTransport());
}
