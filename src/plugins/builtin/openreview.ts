/**
 * OpenReview integration plugin for peer-reviewed submissions.
 *
 * @remarks
 * Imports submissions from OpenReview (https://openreview.net) including
 * conference papers, workshops, and peer review metadata.
 *
 * Uses the OpenReview API v2:
 * - REST API with JSON responses
 * - Public access for published submissions
 * - OAuth for authenticated profile access (claiming verification)
 * - Rate limit: 100 requests per minute
 *
 * OpenReview is a key verification authority for the claiming system,
 * as it provides authenticated author profiles linked to submissions.
 *
 * ATProto Compliance:
 * - All imported data is AppView cache (ephemeral, rebuildable)
 * - Never writes to user PDSes
 * - Users claim eprints by creating records in THEIR PDS
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { PluginError } from '../../types/errors.js';
import type {
  ExternalEprint,
  ExternalSearchQuery,
  FetchOptions,
  IPluginManifest,
  SearchablePlugin,
} from '../../types/interfaces/plugin.interface.js';
import { ImportingPlugin } from '../core/importing-plugin.js';

/**
 * OpenReview API response types.
 *
 * @internal
 */
interface OpenReviewNotesResponse {
  notes: OpenReviewNote[];
  count: number;
}

/**
 * OpenReview Note (submission) structure.
 *
 * @internal
 */
interface OpenReviewNote {
  id: string;
  forum: string;
  invitation: string;
  signatures: string[];
  readers: string[];
  writers: string[];
  content: {
    title?: { value: string };
    abstract?: { value: string };
    authors?: { value: string[] };
    authorids?: { value: string[] };
    keywords?: { value: string[] };
    venue?: { value: string };
    venueid?: { value: string };
    pdf?: { value: string };
    _bibtex?: { value: string };
  };
  cdate: number;
  mdate: number;
  pdate?: number;
  odate?: number;
  tcdate?: number;
}

/**
 * OpenReview Profile structure.
 *
 * @internal
 */
interface OpenReviewProfile {
  id: string;
  content: {
    names?: {
      first?: string;
      middle?: string;
      last?: string;
      fullname?: string;
      preferred?: boolean;
    }[];
    emails?: string[];
    emailsConfirmed?: string[];
    homepage?: string;
    dblp?: string;
    gscholar?: string;
    orcid?: string;
    semanticScholar?: string;
    linkedin?: string;
    wikipedia?: string;
  };
  state?: string;
  tcdate?: number;
  tmdate?: number;
}

/**
 * OpenReview paper metadata.
 *
 * @public
 */
export interface OpenReviewPaper {
  /**
   * Unique note/submission ID.
   */
  id: string;

  /**
   * Forum ID (discussion thread).
   */
  forumId: string;

  /**
   * Paper title.
   */
  title: string;

  /**
   * Author names.
   */
  authors: readonly string[];

  /**
   * Author profile IDs (tilde IDs like ~John_Doe1).
   */
  authorIds: readonly string[];

  /**
   * Paper abstract.
   */
  abstract?: string;

  /**
   * URL to the submission.
   */
  url: string;

  /**
   * Creation timestamp.
   */
  createdAt: number;

  /**
   * Publication timestamp (if published).
   */
  publishedAt?: number;

  /**
   * PDF URL (if available).
   */
  pdfUrl?: string;

  /**
   * Venue name (conference/workshop).
   */
  venue?: string;

  /**
   * Venue ID.
   */
  venueId?: string;

  /**
   * Keywords.
   */
  keywords?: readonly string[];

  /**
   * BibTeX citation.
   */
  bibtex?: string;

  /**
   * Source archive name.
   */
  source: 'openreview';
}

/**
 * OpenReview author for claiming verification.
 *
 * @public
 */
export interface OpenReviewAuthor {
  /**
   * Profile ID (tilde ID).
   */
  profileId: string;

  /**
   * Full name.
   */
  name: string;

  /**
   * Confirmed emails.
   */
  confirmedEmails: readonly string[];

  /**
   * ORCID (if linked).
   */
  orcid?: string;

  /**
   * Semantic Scholar ID (if linked).
   */
  semanticScholarId?: string;

  /**
   * DBLP ID (if linked).
   */
  dblpId?: string;

  /**
   * Google Scholar ID (if linked).
   */
  googleScholarId?: string;
}

/**
 * OpenReview integration plugin.
 *
 * @remarks
 * Fetches submissions from OpenReview via API v2 and imports them into the
 * Chive AppView cache. Users can claim papers they authored using their
 * verified OpenReview profile.
 *
 * OpenReview profiles with linked ORCID/Semantic Scholar provide high-confidence
 * verification for the multi-authority claiming system.
 *
 * Extends ImportingPlugin for standardized import/claiming workflow.
 *
 * @example
 * ```typescript
 * const plugin = new OpenReviewPlugin();
 * await manager.loadBuiltinPlugin(plugin);
 *
 * // Verify author for claiming
 * const author = await plugin.getAuthorProfile('~Jane_Doe1');
 * if (author?.orcid) {
 *   // High-confidence match for claiming
 * }
 * ```
 *
 * @public
 */
export class OpenReviewPlugin extends ImportingPlugin implements SearchablePlugin {
  /**
   * Plugin ID.
   */
  readonly id = 'pub.chive.plugin.openreview';

  /**
   * Import source identifier.
   */
  readonly source = 'openreview' as const;

  /**
   * Indicates this plugin supports on-demand search.
   */
  readonly supportsSearch = true as const;

  /**
   * Plugin manifest.
   */
  readonly manifest: IPluginManifest = {
    id: 'pub.chive.plugin.openreview',
    name: 'OpenReview Integration',
    version: '0.1.0',
    description:
      'Imports peer-reviewed submissions from OpenReview with claiming verification support',
    author: 'Aaron Steven White',
    license: 'MIT',
    permissions: {
      network: {
        allowedDomains: ['api.openreview.net', 'api2.openreview.net', 'openreview.net'],
      },
      hooks: ['system.startup'],
      storage: {
        maxSize: 100 * 1024 * 1024, // 100MB for caching
      },
    },
    entrypoint: 'openreview.js',
  };

  /**
   * OpenReview API v2 base URL.
   */
  private readonly API_BASE_URL = 'https://api2.openreview.net';

  /**
   * Cache TTL in seconds (7 days).
   */
  private readonly CACHE_TTL = 86400 * 7;

  /**
   * Default venues to import (major ML conferences).
   */
  private readonly DEFAULT_VENUES = [
    'ICLR.cc',
    'NeurIPS.cc',
    'ICML.cc',
    'AAAI.org',
    'EMNLP.org',
    'ACL.org',
    'CVPR.org',
    'ECCV.org',
  ];

  /**
   * Initializes the plugin.
   *
   * @remarks
   * Sets up rate limiting. No startup bulk import since this plugin
   * uses on-demand search via the search() method.
   */
  protected onInitialize(): Promise<void> {
    // Set rate limit to 600ms between requests (100 requests/minute)
    this.rateLimitDelayMs = 600;

    this.logger.info('OpenReview plugin initialized (search-based)', {
      apiVersion: 'v2',
      rateLimit: `${this.rateLimitDelayMs}ms between requests`,
    });

    return Promise.resolve();
  }

  /**
   * Fetches submissions from OpenReview.
   *
   * @param options - Fetch options (limit, cursor, filters)
   * @returns Async iterable of external eprints
   */
  async *fetchEprints(options?: FetchOptions): AsyncIterable<ExternalEprint> {
    let count = 0;
    const limit = options?.limit ?? 100;

    // Fetch from each configured venue
    for (const venue of this.DEFAULT_VENUES) {
      if (count >= limit) break;

      let offset = 0;
      const pageSize = Math.min(50, limit - count);

      while (count < limit) {
        await this.rateLimit();

        const url = new URL(`${this.API_BASE_URL}/notes`);
        url.searchParams.set('content.venueid', venue);
        url.searchParams.set('offset', offset.toString());
        url.searchParams.set('limit', pageSize.toString());

        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          this.logger.warn('OpenReview API error', {
            venue,
            status: response.status,
          });
          break;
        }

        const data = (await response.json()) as OpenReviewNotesResponse;

        if (data.notes.length === 0) {
          break;
        }

        for (const note of data.notes) {
          if (count >= limit) break;

          const paper = this.noteToPaper(note);
          if (paper) {
            yield this.paperToExternalEprint(paper);
            count++;
          }
        }

        offset += pageSize;

        // Stop if we've fetched all available notes
        if (data.notes.length < pageSize) {
          break;
        }
      }
    }
  }

  /**
   * Builds the canonical URL for an OpenReview submission.
   *
   * @param externalId - Note ID
   * @returns Full URL to the submission
   */
  buildEprintUrl(externalId: string): string {
    return `https://openreview.net/forum?id=${externalId}`;
  }

  /**
   * Builds the PDF URL for an OpenReview submission.
   *
   * @param externalId - Note ID
   * @returns PDF URL or null
   */
  override buildPdfUrl(externalId: string): string | null {
    return `https://openreview.net/pdf?id=${externalId}`;
  }

  /**
   * Parses external ID from an OpenReview URL.
   *
   * @param url - OpenReview URL
   * @returns Note ID or null
   */
  override parseExternalId(url: string): string | null {
    // Match openreview.net/forum?id={id} or openreview.net/pdf?id={id}
    const match = /openreview\.net\/(?:forum|pdf)\?id=([a-zA-Z0-9_-]+)/.exec(url);
    return match?.[1] ?? null;
  }

  /**
   * Converts an OpenReview note to OpenReviewPaper format.
   *
   * @param note - OpenReview note
   * @returns OpenReview paper or null
   */
  private noteToPaper(note: OpenReviewNote): OpenReviewPaper | null {
    const content = note.content;

    // Skip notes without title
    if (!content.title?.value) {
      return null;
    }

    return {
      id: note.id,
      forumId: note.forum,
      title: content.title.value,
      authors: content.authors?.value ?? [],
      authorIds: content.authorids?.value ?? [],
      abstract: content.abstract?.value,
      url: this.buildEprintUrl(note.forum),
      createdAt: note.cdate,
      publishedAt: note.pdate ?? note.odate,
      pdfUrl: content.pdf?.value
        ? `https://openreview.net${content.pdf.value}`
        : (this.buildPdfUrl(note.forum) ?? undefined),
      venue: content.venue?.value,
      venueId: content.venueid?.value,
      keywords: content.keywords?.value,
      bibtex: content._bibtex?.value,
      source: 'openreview',
    };
  }

  /**
   * Converts an OpenReview paper to ExternalEprint format.
   */
  private paperToExternalEprint(paper: OpenReviewPaper): ExternalEprint {
    return {
      externalId: paper.id,
      url: paper.url,
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors.map((name, index) => ({
        name,
        externalId: paper.authorIds[index],
      })),
      publicationDate: new Date(paper.publishedAt ?? paper.createdAt),
      pdfUrl: paper.pdfUrl,
      categories: paper.keywords,
    };
  }

  /**
   * Gets author profile for claiming verification.
   *
   * @remarks
   * OpenReview profiles with linked ORCID provide high-confidence
   * verification for the multi-authority claiming system.
   *
   * @param profileId - OpenReview profile ID (tilde ID like ~John_Doe1)
   * @returns Author profile or null
   *
   * @public
   */
  async getAuthorProfile(profileId: string): Promise<OpenReviewAuthor | null> {
    // Check cache first
    const cacheKey = `openreview:profile:${profileId}`;
    const cached = await this.cache.get<OpenReviewAuthor>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/profiles?id=${encodeURIComponent(profileId)}`,
        {
          headers: {
            'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('Failed to fetch OpenReview profile', {
          profileId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as { profiles: OpenReviewProfile[] };
      const profile = data.profiles[0];

      if (!profile) {
        return null;
      }

      const author = this.profileToAuthor(profile);

      if (author) {
        await this.cache.set(cacheKey, author, this.CACHE_TTL);
      }

      return author;
    } catch (err) {
      this.logger.warn('Error fetching OpenReview profile', {
        profileId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Converts an OpenReview profile to OpenReviewAuthor format.
   *
   * @param profile - OpenReview profile
   * @returns Author data or null
   */
  private profileToAuthor(profile: OpenReviewProfile): OpenReviewAuthor | null {
    const content = profile.content;

    // Get preferred name or first name
    const preferredName = content.names?.find((n) => n.preferred);
    const firstName = content.names?.[0];
    const nameRecord = preferredName ?? firstName;

    if (!nameRecord) {
      return null;
    }

    const fullName =
      nameRecord.fullname ??
      [nameRecord.first, nameRecord.middle, nameRecord.last].filter(Boolean).join(' ');

    return {
      profileId: profile.id,
      name: fullName,
      confirmedEmails: content.emailsConfirmed ?? [],
      orcid: content.orcid,
      semanticScholarId: content.semanticScholar,
      dblpId: content.dblp,
      googleScholarId: content.gscholar,
    };
  }

  /**
   * Searches for author profile by email (for claiming verification).
   *
   * @param email - Email address to search
   * @returns Author profile or null
   *
   * @public
   */
  async findAuthorByEmail(email: string): Promise<OpenReviewAuthor | null> {
    await this.rateLimit();

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/profiles?confirmedEmails=${encodeURIComponent(email)}`,
        {
          headers: {
            'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { profiles: OpenReviewProfile[] };
      const profile = data.profiles[0];

      if (!profile) {
        return null;
      }

      return this.profileToAuthor(profile);
    } catch (err) {
      this.logger.warn('Error searching OpenReview by email', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Gets submissions authored by a profile ID.
   *
   * @param profileId - OpenReview profile ID
   * @param options - Query options
   * @returns Papers authored by the profile
   *
   * @public
   */
  async getAuthorSubmissions(
    profileId: string,
    options?: { limit?: number }
  ): Promise<readonly OpenReviewPaper[]> {
    await this.rateLimit();

    const limit = Math.min(options?.limit ?? 100, 1000);

    try {
      const response = await fetch(
        `${this.API_BASE_URL}/notes?content.authorids=${encodeURIComponent(profileId)}&limit=${limit}`,
        {
          headers: {
            'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('Failed to fetch author submissions', {
          profileId,
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as OpenReviewNotesResponse;

      const papers: OpenReviewPaper[] = [];
      for (const note of data.notes) {
        const paper = this.noteToPaper(note);
        if (paper) {
          papers.push(paper);
        }
      }

      return papers;
    } catch (err) {
      this.logger.warn('Error fetching author submissions', {
        profileId,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Verifies if a profile ID is an author of a specific submission.
   *
   * @param profileId - OpenReview profile ID
   * @param submissionId - Submission note ID
   * @returns True if profile is an author
   *
   * @public
   */
  async verifyAuthorship(profileId: string, submissionId: string): Promise<boolean> {
    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/notes?id=${submissionId}`, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as OpenReviewNotesResponse;
      const note = data.notes[0];

      if (!note) {
        return false;
      }

      const authorIds = note.content.authorids?.value ?? [];
      return authorIds.includes(profileId);
    } catch {
      return false;
    }
  }

  /**
   * Gets a cached paper by ID.
   *
   * @param id - Note ID
   * @returns Paper metadata or null
   *
   * @public
   */
  async getPaper(id: string): Promise<OpenReviewPaper | null> {
    return this.cache.get<OpenReviewPaper>(`openreview:${id}`);
  }

  /**
   * Fetches details for a specific submission.
   *
   * @param noteId - Submission note ID
   * @returns Paper details or null
   *
   * @public
   */
  async fetchSubmissionDetails(noteId: string): Promise<OpenReviewPaper | null> {
    // Check cache first
    const cached = await this.cache.get<OpenReviewPaper>(`openreview:detail:${noteId}`);
    if (cached) {
      return cached;
    }

    await this.rateLimit();

    try {
      const response = await fetch(`${this.API_BASE_URL}/notes?id=${noteId}`, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('Failed to fetch submission details', {
          noteId,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as OpenReviewNotesResponse;
      const note = data.notes[0];

      if (!note) {
        return null;
      }

      const paper = this.noteToPaper(note);

      if (paper) {
        await this.cache.set(`openreview:detail:${noteId}`, paper, this.CACHE_TTL);
      }

      return paper;
    } catch (err) {
      this.logger.warn('Error fetching submission details', {
        noteId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Searches OpenReview for submissions matching the query.
   *
   * @param query - Search parameters (author, title, externalId)
   * @returns Matching submissions from OpenReview
   *
   * @throws {PluginError} If the search request fails
   *
   * @remarks
   * Uses OpenReview API v2 for search queries. Supports searching by:
   * - Title text (content.title parameter)
   * - Author profile ID (content.authorids parameter)
   * - Note ID (exact match lookup)
   *
   * Rate limiting: Enforces 600ms delay between requests.
   *
   * @example
   * ```typescript
   * const results = await openReviewPlugin.search({
   *   title: 'Attention Is All You Need',
   *   limit: 10,
   * });
   * ```
   *
   * @public
   */
  async search(query: ExternalSearchQuery): Promise<readonly ExternalEprint[]> {
    // Handle exact ID lookup separately
    if (query.externalId) {
      const paper = await this.fetchSubmissionDetails(query.externalId);
      if (paper) {
        return [this.paperToExternalEprint(paper)];
      }
      return [];
    }

    await this.rateLimit();

    const searchUrl = this.buildSearchUrl(query);

    this.logger.debug('Searching OpenReview', {
      query,
      url: searchUrl,
    });

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Chive-AppView/1.0 (Academic eprint aggregator; contact@chive.pub)',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new PluginError(
          this.id,
          'EXECUTE',
          `OpenReview search request failed with status ${response.status}`
        );
      }

      const data = (await response.json()) as OpenReviewNotesResponse;

      const papers: OpenReviewPaper[] = [];
      for (const note of data.notes) {
        const paper = this.noteToPaper(note);
        if (paper) {
          papers.push(paper);
        }
      }

      this.logger.debug('OpenReview search completed', {
        resultCount: papers.length,
      });

      // Record metrics
      this.recordCounter('search_requests');
      this.recordCounter('search_results', { count: String(papers.length) });

      return papers.map((paper) => this.paperToExternalEprint(paper));
    } catch (err) {
      if (err instanceof PluginError) {
        throw err;
      }

      this.logger.error('OpenReview search failed', err as Error, { query });
      this.recordCounter('search_errors');

      throw new PluginError(
        this.id,
        'EXECUTE',
        `OpenReview search failed: ${(err as Error).message}`,
        err as Error
      );
    }
  }

  /**
   * Builds the OpenReview API search URL from query parameters.
   *
   * @param query - Search query parameters
   * @returns Fully formed OpenReview API URL
   *
   * @internal
   */
  private buildSearchUrl(query: ExternalSearchQuery): string {
    const url = new URL(`${this.API_BASE_URL}/notes/search`);

    // OpenReview's search endpoint uses full-text search
    const searchTerms: string[] = [];

    if (query.title) {
      searchTerms.push(query.title);
    }

    if (query.author) {
      searchTerms.push(query.author);
    }

    if (searchTerms.length > 0) {
      url.searchParams.set('term', searchTerms.join(' '));
    }

    url.searchParams.set('limit', String(query.limit ?? 10));
    url.searchParams.set('type', 'terms');

    return url.toString();
  }
}

export default OpenReviewPlugin;
