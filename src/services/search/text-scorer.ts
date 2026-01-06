/**
 * Text similarity scorers for search ranking.
 *
 * @remarks
 * Implements ITextScorer interface using the cmpstr library for
 * Dice coefficient (bigram) similarity scoring.
 *
 * **Scoring Strategy:**
 * - Dice coefficient for fuzzy matching (handles typos)
 * - Word overlap for precision
 * - Prefix matching for autocomplete-style queries
 *
 * @packageDocumentation
 * @public
 */

import { CmpStr } from 'cmpstr';

import type { ITextScorer } from '../../types/interfaces/ranking.interface.js';

/**
 * Stop words to filter from queries.
 */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'that',
  'this',
  'these',
  'those',
  'what',
  'which',
  'who',
  'whom',
  'whose',
]);

/**
 * Normalizes text for comparison.
 *
 * @param text - Text to normalize
 * @returns Normalized text with punctuation removed and stop words filtered
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .join(' ');
}

/**
 * Dice coefficient text scorer using cmpstr library.
 *
 * @remarks
 * Uses Dice coefficient (bigram-based similarity) for robust matching
 * that handles partial matches and word transposition.
 *
 * @public
 */
export class DiceTextScorer implements ITextScorer {
  private readonly cmpStr: ReturnType<typeof CmpStr.create>;

  constructor() {
    // Create case-insensitive Dice coefficient scorer
    this.cmpStr = CmpStr.create().setMetric('dice').setFlags('i');
  }

  /**
   * Computes text similarity between query and target using Dice coefficient.
   */
  score(query: string, target: string): number {
    const normalizedQuery = normalizeText(query);
    const normalizedTarget = normalizeText(target);

    if (!normalizedQuery || !normalizedTarget) {
      return 0;
    }

    // Exact match bonus
    if (normalizedQuery === normalizedTarget) {
      return 1.0;
    }

    // Use Dice coefficient for similarity
    const result = this.cmpStr.test(normalizedQuery, normalizedTarget);
    // cmpstr returns match as a number or in a result object
    if (typeof result === 'number') {
      return result;
    }
    return (result as { match?: number }).match ?? 0;
  }

  /**
   * Computes relevance across multiple fields with weights.
   */
  scoreMultiField(
    query: string,
    fields: Record<string, string | undefined>,
    weights: Record<string, number>
  ): number {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return 0;
    }

    let totalScore = 0;
    let totalWeight = 0;

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) continue;

      const weight = weights[fieldName] ?? 1.0;
      const fieldScore = this.score(query, fieldValue);

      totalScore += fieldScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
}

/**
 * Academic text scorer with multiple strategies.
 *
 * @remarks
 * Combines Dice coefficient with word overlap and prefix matching
 * for better results on academic text (titles, abstracts).
 *
 * **Scoring Weights:**
 * - Dice coefficient: 60% (fuzzy matching)
 * - Word overlap: 25% (precision)
 * - Prefix matching: 15% (autocomplete)
 *
 * @public
 */
export class AcademicTextScorer implements ITextScorer {
  private readonly diceScorer = new DiceTextScorer();

  /**
   * Strategy weights for combined scoring.
   */
  private readonly strategyWeights = {
    dice: 0.6, // Dice coefficient for fuzzy matching
    wordOverlap: 0.25, // Word-level precision
    prefix: 0.15, // Prefix matching for autocomplete-style
  };

  /**
   * Computes text similarity using combined strategies.
   */
  score(query: string, target: string): number {
    const normalizedQuery = normalizeText(query);
    const normalizedTarget = normalizeText(target);

    if (!normalizedQuery || !normalizedTarget) {
      return 0;
    }

    // Exact match
    if (normalizedQuery === normalizedTarget) {
      return 1.0;
    }

    const diceScore = this.diceScorer.score(query, target);
    const wordOverlapScore = this.computeWordOverlap(normalizedQuery, normalizedTarget);
    const prefixScore = this.computePrefixScore(normalizedQuery, normalizedTarget);

    return (
      diceScore * this.strategyWeights.dice +
      wordOverlapScore * this.strategyWeights.wordOverlap +
      prefixScore * this.strategyWeights.prefix
    );
  }

  /**
   * Computes relevance across multiple fields with weights.
   */
  scoreMultiField(
    query: string,
    fields: Record<string, string | undefined>,
    weights: Record<string, number>
  ): number {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return 0;
    }

    let totalScore = 0;
    let totalWeight = 0;

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) continue;

      const weight = weights[fieldName] ?? 1.0;
      const fieldScore = this.score(query, fieldValue);

      totalScore += fieldScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Computes word overlap score.
   */
  private computeWordOverlap(query: string, target: string): number {
    const queryWords = new Set(query.split(' ').filter((w) => w.length > 0));
    const targetWords = new Set(target.split(' ').filter((w) => w.length > 0));

    if (queryWords.size === 0) return 0;

    let matches = 0;
    for (const word of queryWords) {
      if (targetWords.has(word)) {
        matches++;
      }
    }

    return matches / queryWords.size;
  }

  /**
   * Computes prefix match score.
   */
  private computePrefixScore(query: string, target: string): number {
    if (target.startsWith(query)) return 1.0;
    if (target.includes(query)) return 0.8;

    // Check if any query word is a prefix of a target word
    const queryWords = query.split(' ').filter((w) => w.length > 0);
    const targetWords = target.split(' ').filter((w) => w.length > 0);

    let prefixMatches = 0;
    for (const qWord of queryWords) {
      for (const tWord of targetWords) {
        if (tWord.startsWith(qWord)) {
          prefixMatches++;
          break;
        }
      }
    }

    return queryWords.length > 0 ? (prefixMatches / queryWords.length) * 0.6 : 0;
  }
}

/**
 * Simple text scorer using basic string containment.
 *
 * @remarks
 * Fallback scorer that doesn't require external libraries.
 * Uses the same discrete tier scoring as the original RankingService.
 *
 * @public
 */
export class SimpleTextScorer implements ITextScorer {
  /**
   * Computes text similarity using containment scoring.
   */
  score(query: string, target: string): number {
    const queryLower = query.toLowerCase().trim();
    const titleLower = target.toLowerCase().trim();

    if (queryLower.length === 0) {
      return 0;
    }

    // Exact match = 1.0
    if (titleLower === queryLower) {
      return 1.0;
    }

    // Title starts with query = 0.9
    if (titleLower.startsWith(queryLower)) {
      return 0.9;
    }

    // Title contains query = 0.8
    if (titleLower.includes(queryLower)) {
      return 0.8;
    }

    // Word overlap scoring
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1);
    if (queryWords.length === 0) {
      return 0;
    }

    const titleWords = new Set(titleLower.split(/\s+/).filter((w) => w.length > 1));

    // Count exact word matches
    const exactMatches = queryWords.filter((w) => titleWords.has(w)).length;

    // Count partial word matches
    const partialMatches = queryWords.filter((queryWord) =>
      Array.from(titleWords).some(
        (titleWord) => titleWord.startsWith(queryWord) || queryWord.startsWith(titleWord)
      )
    ).length;

    // Score: exact matches weighted more than partial
    const exactScore = exactMatches / queryWords.length;
    const partialScore = (partialMatches - exactMatches) / queryWords.length;

    return Math.min(exactScore * 0.6 + partialScore * 0.2, 0.7);
  }

  /**
   * Computes relevance across multiple fields with weights.
   */
  scoreMultiField(
    query: string,
    fields: Record<string, string | undefined>,
    weights: Record<string, number>
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) continue;

      const weight = weights[fieldName] ?? 1.0;
      const fieldScore = this.score(query, fieldValue);

      totalScore += fieldScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
}

export default AcademicTextScorer;
