/**
 * Metadata enrichment services.
 *
 * @remarks
 * Provides services for enriching eprint metadata from external sources
 * including CrossRef, OpenAlex, and Semantic Scholar.
 *
 * @packageDocumentation
 */

export {
  getWorkByDoi,
  searchWorks,
  findPublishedVersion,
  searchFunders,
  getFunderByDoi,
  searchJournals,
  enrichEprint,
  type CrossRefWork,
  type CrossRefAuthor,
  type CrossRefFunder,
  type CrossRefJournal,
  type EnrichmentResult,
} from './crossref-enrichment.js';
