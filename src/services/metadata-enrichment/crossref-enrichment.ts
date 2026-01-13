/**
 * CrossRef metadata enrichment service.
 *
 * @remarks
 * Queries CrossRef API to enrich publication metadata including:
 * - DOI lookup for published versions
 * - Funder Registry data
 * - Journal metadata
 * - Citation counts
 *
 * @packageDocumentation
 * @public
 * @since 0.2.0
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * CrossRef work metadata.
 *
 * @public
 */
export interface CrossRefWork {
  /** DOI */
  readonly doi: string;
  /** Work title */
  readonly title: string;
  /** Authors */
  readonly authors: readonly CrossRefAuthor[];
  /** Container title (journal name) */
  readonly journal?: string;
  /** Journal ISSN */
  readonly issn?: string;
  /** Publisher */
  readonly publisher?: string;
  /** Volume */
  readonly volume?: string;
  /** Issue */
  readonly issue?: string;
  /** Page range */
  readonly pages?: string;
  /** Publication date */
  readonly publishedDate?: Date;
  /** License URL */
  readonly licenseUrl?: string;
  /** Is open access */
  readonly isOpenAccess: boolean;
  /** Citation count */
  readonly citationCount: number;
  /** Reference count */
  readonly referenceCount: number;
  /** References DOIs */
  readonly references: readonly string[];
  /** Work type */
  readonly type: string;
  /** URL */
  readonly url: string;
}

/**
 * CrossRef author metadata.
 *
 * @public
 */
export interface CrossRefAuthor {
  /** Given name */
  readonly givenName?: string;
  /** Family name */
  readonly familyName?: string;
  /** Full name */
  readonly fullName: string;
  /** ORCID */
  readonly orcid?: string;
  /** Affiliations */
  readonly affiliations: readonly string[];
}

/**
 * CrossRef funder metadata.
 *
 * @public
 */
export interface CrossRefFunder {
  /** Funder DOI */
  readonly doi: string;
  /** Funder name */
  readonly name: string;
  /** Alternate names */
  readonly alternateNames: readonly string[];
  /** Location */
  readonly location?: string;
  /** Work count */
  readonly workCount: number;
}

/**
 * CrossRef journal metadata.
 *
 * @public
 */
export interface CrossRefJournal {
  /** ISSN */
  readonly issn: string;
  /** Journal title */
  readonly title: string;
  /** Publisher */
  readonly publisher?: string;
  /** Subject areas */
  readonly subjects: readonly string[];
  /** Total article count */
  readonly totalArticles: number;
  /** Coverage from year */
  readonly coverageFrom?: number;
}

/**
 * Enrichment result for a eprint.
 *
 * @public
 */
export interface EnrichmentResult {
  /** Found published version DOI */
  readonly publishedDoi?: string;
  /** Full published version metadata */
  readonly publishedVersion?: CrossRefWork;
  /** Funders from CrossRef */
  readonly funders: readonly CrossRefFunder[];
  /** Enrichment timestamp */
  readonly enrichedAt: Date;
}

// =============================================================================
// API CLIENT
// =============================================================================

const CROSSREF_API_BASE = 'https://api.crossref.org';
const USER_AGENT = 'Chive/1.0 (https://chive.pub; mailto:contact@chive.pub)';

/**
 * CrossRef API response wrapper.
 */
interface CrossRefResponse<T> {
  status: 'ok' | 'failed';
  'message-type': string;
  'message-version': string;
  message: T;
}

/**
 * CrossRef works list response.
 */
interface CrossRefWorksList {
  'total-results': number;
  items: CrossRefWorkItem[];
}

/**
 * CrossRef work item from API.
 */
interface CrossRefWorkItem {
  DOI: string;
  title?: string[];
  author?: {
    given?: string;
    family?: string;
    name?: string;
    ORCID?: string;
    affiliation?: { name: string }[];
  }[];
  'container-title'?: string[];
  ISSN?: string[];
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
  published?: {
    'date-parts'?: number[][];
  };
  license?: { URL: string }[];
  'is-referenced-by-count'?: number;
  'references-count'?: number;
  reference?: { DOI?: string }[];
  type?: string;
  URL?: string;
  funder?: {
    DOI?: string;
    name: string;
    award?: string[];
  }[];
}

/**
 * CrossRef funders list response.
 */
interface CrossRefFundersList {
  'total-results': number;
  items: {
    id: string;
    name: string;
    'alt-names'?: string[];
    location?: string;
    'work-count'?: number;
  }[];
}

/**
 * CrossRef journals list response.
 */
interface CrossRefJournalsList {
  'total-results': number;
  items: {
    ISSN: string[];
    title: string;
    publisher?: string;
    subjects?: { name: string }[];
    'total-dois'?: number;
    coverage?: { 'articles-back'?: number };
  }[];
}

/**
 * Makes a request to CrossRef API.
 *
 * @param endpoint - API endpoint path
 * @returns Parsed JSON response
 */
async function fetchCrossRef<T>(endpoint: string): Promise<T | null> {
  const url = `${CROSSREF_API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error(`CrossRef API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as CrossRefResponse<T>;
    if (data.status !== 'ok') {
      return null;
    }

    return data.message;
  } catch (error) {
    console.error('CrossRef API request failed:', error);
    return null;
  }
}

// =============================================================================
// PUBLIC FUNCTIONS
// =============================================================================

/**
 * Fetches work metadata by DOI.
 *
 * @param doi - DOI to lookup
 * @returns Work metadata or null if not found
 *
 * @example
 * ```typescript
 * const work = await getWorkByDoi('10.1038/nature12373');
 * console.log(work?.title);
 * ```
 *
 * @public
 */
export async function getWorkByDoi(doi: string): Promise<CrossRefWork | null> {
  const encodedDoi = encodeURIComponent(doi);
  const item = await fetchCrossRef<CrossRefWorkItem>(`/works/${encodedDoi}`);

  if (!item) return null;

  return parseWorkItem(item);
}

/**
 * Searches for works by title and authors.
 *
 * @param title - Work title to search
 * @param authors - Optional author names to filter
 * @returns Array of matching works
 *
 * @example
 * ```typescript
 * const works = await searchWorks('machine learning', ['Smith', 'Jones']);
 * ```
 *
 * @public
 */
export async function searchWorks(
  title: string,
  authors?: readonly string[]
): Promise<CrossRefWork[]> {
  let query = `query.title=${encodeURIComponent(title)}`;

  if (authors && authors.length > 0) {
    query += `&query.author=${encodeURIComponent(authors.join(' '))}`;
  }

  const result = await fetchCrossRef<CrossRefWorksList>(`/works?${query}&rows=10`);

  if (!result) return [];

  return result.items.map(parseWorkItem);
}

/**
 * Attempts to find the published version of a eprint.
 *
 * @param title - Eprint title
 * @param authors - Eprint authors
 * @returns DOI of published version or null
 *
 * @example
 * ```typescript
 * const publishedDoi = await findPublishedVersion(
 *   'Deep Learning for Medical Imaging',
 *   ['Smith, J.', 'Jones, A.']
 * );
 * ```
 *
 * @public
 */
export async function findPublishedVersion(
  title: string,
  authors: readonly string[]
): Promise<string | null> {
  const works = await searchWorks(title, authors);

  // Filter out eprints and find journal articles
  const journalArticles = works.filter((w) => w.type === 'journal-article' && w.journal);

  if (journalArticles.length === 0) return null;

  // Score by title similarity
  const titleLower = title.toLowerCase();
  const scored = journalArticles.map((w) => ({
    work: w,
    score: calculateTitleSimilarity(w.title.toLowerCase(), titleLower),
  }));

  // Return best match above threshold
  scored.sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score > 0.7) {
    return scored[0].work.doi;
  }

  return null;
}

/**
 * Searches funders by name.
 *
 * @param query - Search query
 * @returns Array of matching funders
 *
 * @public
 */
export async function searchFunders(query: string): Promise<CrossRefFunder[]> {
  const result = await fetchCrossRef<CrossRefFundersList>(
    `/funders?query=${encodeURIComponent(query)}&rows=10`
  );

  if (!result) return [];

  return result.items.map((item) => ({
    doi: item.id,
    name: item.name,
    alternateNames: item['alt-names'] ?? [],
    location: item.location,
    workCount: item['work-count'] ?? 0,
  }));
}

/**
 * Gets funder metadata by DOI.
 *
 * @param doi - Funder DOI
 * @returns Funder metadata or null
 *
 * @public
 */
export async function getFunderByDoi(doi: string): Promise<CrossRefFunder | null> {
  const encodedDoi = encodeURIComponent(doi);
  const item = await fetchCrossRef<{
    id: string;
    name: string;
    'alt-names'?: string[];
    location?: string;
    'work-count'?: number;
  }>(`/funders/${encodedDoi}`);

  if (!item) return null;

  return {
    doi: item.id,
    name: item.name,
    alternateNames: item['alt-names'] ?? [],
    location: item.location,
    workCount: item['work-count'] ?? 0,
  };
}

/**
 * Searches journals by title.
 *
 * @param query - Search query
 * @returns Array of matching journals
 *
 * @public
 */
export async function searchJournals(query: string): Promise<CrossRefJournal[]> {
  const result = await fetchCrossRef<CrossRefJournalsList>(
    `/journals?query=${encodeURIComponent(query)}&rows=10`
  );

  if (!result) return [];

  return result.items.map((item) => ({
    issn: item.ISSN?.[0] ?? '',
    title: item.title,
    publisher: item.publisher,
    subjects: (item.subjects ?? []).map((s) => s.name),
    totalArticles: item['total-dois'] ?? 0,
    coverageFrom: item.coverage?.['articles-back'],
  }));
}

/**
 * Enriches eprint metadata using CrossRef.
 *
 * @param title - Eprint title
 * @param authors - Eprint authors
 * @returns Enrichment result
 *
 * @public
 */
export async function enrichEprint(
  title: string,
  authors: readonly string[]
): Promise<EnrichmentResult> {
  const publishedDoi = await findPublishedVersion(title, authors);

  let publishedVersion: CrossRefWork | undefined;
  const funders: CrossRefFunder[] = [];

  if (publishedDoi) {
    const work = await getWorkByDoi(publishedDoi);
    if (work) {
      publishedVersion = work;
    }
  }

  return {
    publishedDoi: publishedDoi ?? undefined,
    publishedVersion,
    funders,
    enrichedAt: new Date(),
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parses a CrossRef work item into our format.
 */
function parseWorkItem(item: CrossRefWorkItem): CrossRefWork {
  const authors = (item.author ?? []).map((a) => ({
    givenName: a.given,
    familyName: a.family,
    fullName: a.name ?? [a.given, a.family].filter(Boolean).join(' '),
    orcid: a.ORCID?.replace('http://orcid.org/', ''),
    affiliations: (a.affiliation ?? []).map((af) => af.name),
  }));

  const publishedDate = item.published?.['date-parts']?.[0]
    ? new Date(
        item.published['date-parts'][0][0] ?? 0,
        (item.published['date-parts'][0][1] ?? 1) - 1,
        item.published['date-parts'][0][2] ?? 1
      )
    : undefined;

  const references = (item.reference ?? []).map((r) => r.DOI).filter((doi): doi is string => !!doi);

  return {
    doi: item.DOI,
    title: item.title?.[0] ?? '',
    authors,
    journal: item['container-title']?.[0],
    issn: item.ISSN?.[0],
    publisher: item.publisher,
    volume: item.volume,
    issue: item.issue,
    pages: item.page,
    publishedDate,
    licenseUrl: item.license?.[0]?.URL,
    isOpenAccess: !!item.license?.[0]?.URL,
    citationCount: item['is-referenced-by-count'] ?? 0,
    referenceCount: item['references-count'] ?? 0,
    references,
    type: item.type ?? 'unknown',
    url: item.URL ?? `https://doi.org/${item.DOI}`,
  };
}

/**
 * Calculates simple title similarity score.
 */
function calculateTitleSimilarity(a: string, b: string): number {
  // Simple word overlap similarity
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}
