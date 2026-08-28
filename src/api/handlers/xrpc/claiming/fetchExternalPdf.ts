/**
 * Handler for fetching external PDFs.
 *
 * @remarks
 * Proxies PDF fetch from external sources to avoid CORS issues.
 * Returns the PDF as binary data with appropriate headers.
 * Note: This is implemented as a REST endpoint since it returns binary data.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError, ValidationError } from '../../../../types/errors.js';
import type { ChiveEnv } from '../../../types/context.js';

/**
 * REST endpoint definition for non-XRPC handlers.
 *
 * @public
 */
export interface RESTEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  handler: (c: Context<ChiveEnv>) => Promise<Response>;
  auth: 'required' | 'optional' | 'none';
  rateLimit: 'anonymous' | 'authenticated' | 'admin';
}

/**
 * Allowed external domains for PDF fetching.
 * Security: Only allow known academic sources.
 */
const ALLOWED_PDF_DOMAINS = [
  'arxiv.org',
  'export.arxiv.org',
  'www.biorxiv.org',
  'www.medrxiv.org',
  'pdfs.semanticscholar.org',
  'www.ncbi.nlm.nih.gov',
  'europepmc.org',
  'openreview.net',
  'proceedings.neurips.cc',
  'proceedings.mlr.press',
];

/**
 * Validates that a URL is from an allowed domain.
 */
function isAllowedDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only https. Every allowlisted host serves it, and permitting http would
    // let a redirect downgrade the hop that carries the document.
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_PDF_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Largest PDF this proxy will relay, in bytes.
 *
 * @remarks
 * `response.arrayBuffer()` buffers whatever the far end sends. An allowlisted
 * host serving an endless body — or simply a very large one — put all of it in
 * this process's heap, so a handful of concurrent requests could exhaust
 * memory. Eprint PDFs are comfortably under this.
 */
const MAX_PDF_BYTES = 50 * 1024 * 1024;

/**
 * Redirect hops to follow before giving up.
 */
const MAX_REDIRECTS = 5;

/**
 * Fetch a PDF, re-checking the allowlist at every redirect.
 *
 * @param url - Allowlisted URL to fetch
 * @returns The response for the final, still-allowlisted URL
 *
 * @throws ValidationError if a redirect leaves the allowlist
 * @throws NotFoundError if the redirect chain does not terminate
 *
 * @remarks
 * The allowlist used to be checked once, on the URL the caller named, while
 * `fetch` followed redirects on its own. An allowlisted host — or anyone able
 * to influence one — could therefore redirect the request to an address inside
 * the cluster and have Chive fetch it and hand back the body. Following
 * redirects by hand is what makes the allowlist apply to where the request
 * actually ends up rather than only to where it started.
 */
async function fetchAllowlistedPdf(url: string): Promise<Response> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Chive/1.0 (https://chive.pub; Scholarly Publishing Platform)',
        Accept: 'application/pdf',
      },
    });

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('location');
    if (!location) return response;

    const next = new URL(location, current).toString();
    if (!isAllowedDomain(next)) {
      throw new ValidationError('PDF URL redirected outside the allowed domains');
    }
    current = next;
  }

  throw new NotFoundError('ExternalPdf', 'Too many redirects');
}

/**
 * Read a response body, refusing anything over {@link MAX_PDF_BYTES}.
 *
 * @param response - Response to drain
 * @returns The body bytes
 *
 * @throws ValidationError if the body exceeds the cap
 *
 * @remarks
 * `Content-Length` is checked first because it is cheap, but it is a claim by
 * the far end and may be absent or wrong. The stream is therefore also counted
 * as it arrives and abandoned the moment it goes over, so a server that lies
 * about its length cannot spend more of this process's memory than one that
 * does not.
 */
async function readBounded(response: Response): Promise<Uint8Array> {
  const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) {
    throw new ValidationError('PDF exceeds the maximum size this proxy will relay');
  }

  const body = response.body;
  if (!body) return new Uint8Array(0);

  const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > MAX_PDF_BYTES) {
        await reader.cancel();
        throw new ValidationError('PDF exceeds the maximum size this proxy will relay');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Handler for fetching external PDFs through proxy.
 *
 * @param c - Hono context
 * @returns PDF binary data
 *
 * @public
 */
export async function fetchExternalPdfHandler(c: Context<ChiveEnv>): Promise<Response> {
  const logger = c.get('logger');
  const user = c.get('user');
  const { claiming } = c.get('services');

  // Require authentication
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Get query parameters
  const source = c.req.query('source');
  const externalId = c.req.query('externalId');

  if (!source || !externalId) {
    return c.json({ error: 'Missing source or externalId parameter' }, 400);
  }

  logger.debug('Fetching external PDF', {
    source,
    externalId,
    userDid: user.did,
  });

  // Get the imported paper to find the PDF URL
  const imported = await claiming.getOrImportFromExternal(source, externalId);

  if (!imported) {
    throw new NotFoundError('ExternalEprint', `${source}/${externalId}`);
  }

  if (!imported.pdfUrl) {
    throw new NotFoundError('ExternalPdf', `No PDF available for ${source}/${externalId}`);
  }

  // Security: Validate the domain
  if (!isAllowedDomain(imported.pdfUrl)) {
    logger.warn('Blocked PDF fetch from unauthorized domain', {
      source,
      externalId,
      pdfUrl: imported.pdfUrl,
    });
    // The URL is logged above for operators; reflecting it into the response
    // hands an attacker a confirmation oracle for what the allowlist contains.
    throw new ValidationError('PDF URL is not from an allowed domain');
  }

  logger.info('Proxying PDF fetch', {
    source,
    externalId,
    pdfUrl: imported.pdfUrl,
  });

  // Fetch the PDF from the external source, re-checking the allowlist at each
  // redirect rather than trusting the first URL alone.
  const response = await fetchAllowlistedPdf(imported.pdfUrl);

  if (!response.ok) {
    logger.error('Failed to fetch external PDF', undefined, {
      source,
      externalId,
      pdfUrl: imported.pdfUrl,
      status: response.status,
    });
    throw new NotFoundError('ExternalPdf', `Failed to fetch PDF: ${response.status}`);
  }

  // Get content type and verify it's a PDF
  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/pdf')) {
    logger.warn('External URL did not return PDF content type', {
      source,
      externalId,
      contentType,
    });
  }

  // Return the PDF with appropriate headers
  const pdfBuffer = await readBounded(response);

  logger.info('PDF fetched successfully', {
    source,
    externalId,
    size: pdfBuffer.byteLength,
  });

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.byteLength.toString(),
      'Content-Disposition': `attachment; filename="${source}-${externalId}.pdf"`,
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  });
}

/**
 * REST endpoint definition for fetching external PDFs.
 *
 * @remarks
 * Implemented as REST endpoint since it returns binary data.
 *
 * @public
 */
export const fetchExternalPdfEndpoint: RESTEndpoint = {
  method: 'GET',
  path: '/xrpc/pub.chive.claiming.fetchExternalPdf',
  description: 'Fetch external PDF through proxy to avoid CORS issues',
  handler: fetchExternalPdfHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
