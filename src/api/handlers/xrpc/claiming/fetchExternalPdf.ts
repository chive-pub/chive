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
import type { RESTEndpoint } from '../../../types/handlers.js';

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
    return ALLOWED_PDF_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
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
    throw new ValidationError(`PDF URL not from allowed domain: ${imported.pdfUrl}`);
  }

  logger.info('Proxying PDF fetch', {
    source,
    externalId,
    pdfUrl: imported.pdfUrl,
  });

  // Fetch the PDF from the external source
  const response = await fetch(imported.pdfUrl, {
    headers: {
      'User-Agent': 'Chive/1.0 (https://chive.pub; Scholarly Publishing Platform)',
      Accept: 'application/pdf',
    },
  });

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
  const pdfBuffer = await response.arrayBuffer();

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
