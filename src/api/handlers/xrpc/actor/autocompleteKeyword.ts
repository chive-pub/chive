/**
 * Autocomplete research keywords handler.
 *
 * @remarks
 * Provides keyword autocomplete using FAST subject headings
 * and Wikidata entities, plus free text support.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  KeywordSuggestion,
} from '../../../../lexicons/generated/types/pub/chive/actor/autocompleteKeyword.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

// Use generated types from lexicons

/**
 * FAST API response type.
 */
interface FastApiResponse {
  response?: {
    docs?: {
      idroot: string;
      auth: string;
      type: string;
      suggestall?: string[];
      usageCount?: number;
    }[];
  };
}

/**
 * Wikidata API response type.
 */
interface WikidataApiResponse {
  search?: {
    id: string;
    label: string;
    description?: string;
  }[];
}

/**
 * Searches FAST subject headings.
 */
async function searchFast(query: string, limit: number): Promise<KeywordSuggestion[]> {
  const url = new URL('https://fast.oclc.org/searchfast/fastsuggest');
  url.searchParams.set('query', query);
  url.searchParams.set('queryIndex', 'suggestall');
  url.searchParams.set('queryReturn', 'suggestall,idroot,auth,type,usageCount');
  url.searchParams.set('rows', String(limit));
  url.searchParams.set('suggest', 'autoSubject');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`FAST API returned ${response.status}`);
  }

  const data = (await response.json()) as FastApiResponse;
  const docs = data.response?.docs ?? [];

  return docs.map((doc) => ({
    id: doc.idroot,
    label: doc.auth,
    source: 'fast' as const,
    description: undefined,
    usageCount: doc.usageCount ?? undefined,
  }));
}

/**
 * Searches Wikidata entities.
 */
async function searchWikidata(query: string, limit: number): Promise<KeywordSuggestion[]> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', query);
  url.searchParams.set('language', 'en');
  url.searchParams.set('uselang', 'en');
  url.searchParams.set('type', 'item');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Wikidata API returned ${response.status}`);
  }

  const data = (await response.json()) as WikidataApiResponse;
  const results = data.search ?? [];

  return results.map((result) => ({
    id: result.id,
    label: result.label,
    source: 'wikidata' as const,
    description: result.description ?? undefined,
    usageCount: undefined,
  }));
}

/**
 * XRPC method for pub.chive.actor.autocompleteKeyword.
 *
 * @public
 */
export const autocompleteKeyword: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');

    logger.debug('Keyword autocomplete request', {
      query: params.query,
      limit: params.limit,
      sources: params.sources,
    });

    const limit = params.limit ?? 8;
    // Handle sources parameter - can be array or single value
    const sourcesParam = params.sources;
    const sources: ('fast' | 'wikidata')[] = Array.isArray(sourcesParam)
      ? (sourcesParam.filter((s) => s === 'fast' || s === 'wikidata') as ('fast' | 'wikidata')[])
      : sourcesParam === 'fast' || sourcesParam === 'wikidata'
        ? [sourcesParam]
        : ['fast', 'wikidata'];

    const searchPromises: Promise<KeywordSuggestion[]>[] = [];

    // Search FAST
    if (sources.includes('fast')) {
      searchPromises.push(
        searchFast(params.query, Math.ceil(limit / 2)).catch((err) => {
          logger.warn('FAST autocomplete error', {
            query: params.query,
            error: err instanceof Error ? err.message : String(err),
          });
          return [];
        })
      );
    }

    // Search Wikidata
    if (sources.includes('wikidata')) {
      searchPromises.push(
        searchWikidata(params.query, Math.ceil(limit / 2)).catch((err) => {
          logger.warn('Wikidata autocomplete error', {
            query: params.query,
            error: err instanceof Error ? err.message : String(err),
          });
          return [];
        })
      );
    }

    const results = await Promise.all(searchPromises);
    const allSuggestions = results.flat();

    // Sort by relevance (FAST usage count for FAST, keep order for Wikidata)
    // Interleave results from different sources
    const fastSuggestions = allSuggestions.filter((s) => s.source === 'fast');
    const wikidataSuggestions = allSuggestions.filter((s) => s.source === 'wikidata');

    const interleaved: KeywordSuggestion[] = [];
    const maxLen = Math.max(fastSuggestions.length, wikidataSuggestions.length);

    for (let i = 0; i < maxLen && interleaved.length < limit; i++) {
      const fastItem = fastSuggestions[i];
      const wdItem = wikidataSuggestions[i];

      if (fastItem) {
        interleaved.push(fastItem);
      }
      if (wdItem && interleaved.length < limit) {
        interleaved.push(wdItem);
      }
    }

    logger.debug('Keyword autocomplete completed', {
      query: params.query,
      suggestionCount: interleaved.length,
      sources: sources,
    });

    return { encoding: 'application/json', body: { suggestions: interleaved.slice(0, limit) } };
  },
};
