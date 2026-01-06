/**
 * Category matcher for ranking service.
 *
 * @remarks
 * Implements ICategoryMatcher using the academic category taxonomy
 * for cross-source and hierarchical category matching.
 *
 * **Matching Strategies:**
 * - Exact match: Direct code match (1.0)
 * - Parent match: Child matches parent (0.7)
 * - Sibling match: Same parent (0.5)
 * - Cross-source match: Via mapping table (0.6)
 * - Alias match: Via normalized lookup (0.9)
 *
 * @packageDocumentation
 * @public
 */

import type { ICategoryMatcher } from '../../types/interfaces/ranking.interface.js';

import {
  type CategoryInfo,
  CROSS_SOURCE_MAPPINGS,
  FULL_TAXONOMY,
  getAllAliases,
} from './category-taxonomy.js';

/**
 * Match type for category comparison.
 *
 * @public
 */
export type CategoryMatchType =
  | 'exact'
  | 'alias'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'cross_source'
  | 'none';

/**
 * Match result with type and score.
 *
 * @public
 */
export interface CategoryMatch {
  readonly type: CategoryMatchType;
  readonly score: number;
  readonly matchedCategory?: string;
}

/**
 * Match scores by type.
 */
const MATCH_SCORES: Readonly<Record<CategoryMatchType, number>> = {
  exact: 1.0,
  alias: 0.9,
  parent: 0.7,
  child: 0.6,
  sibling: 0.5,
  cross_source: 0.6,
  none: 0.0,
};

/**
 * Taxonomy-based category matcher implementation.
 *
 * @remarks
 * Uses the full academic taxonomy for O(1) lookups and
 * supports hierarchical and cross-source matching.
 *
 * @public
 */
export class TaxonomyCategoryMatcher implements ICategoryMatcher {
  private readonly taxonomy: Record<string, CategoryInfo>;
  private readonly aliasMap: Map<string, string>;
  private readonly crossSourceMap: ReadonlyMap<string, readonly string[]>;

  /**
   * Cache for parent lookups.
   */
  private readonly parentCache = new Map<string, readonly string[]>();

  /**
   * Cache for sibling lookups.
   */
  private readonly siblingCache = new Map<string, readonly string[]>();

  constructor(
    taxonomy: Record<string, CategoryInfo> = FULL_TAXONOMY,
    crossSourceMappings: ReadonlyMap<string, readonly string[]> = CROSS_SOURCE_MAPPINGS
  ) {
    this.taxonomy = taxonomy;
    this.aliasMap = getAllAliases();
    this.crossSourceMap = crossSourceMappings;
  }

  /**
   * Computes overlap between item categories and user fields.
   *
   * @remarks
   * Uses maximum match score across all category pairs.
   * This favors the best match rather than averaging.
   */
  computeFieldScore(itemCategories: readonly string[], userFields: readonly string[]): number {
    if (itemCategories.length === 0 || userFields.length === 0) {
      return 0;
    }

    let maxScore = 0;

    for (const itemCat of itemCategories) {
      for (const userField of userFields) {
        const match = this.matchCategories(itemCat, userField);
        if (match.score > maxScore) {
          maxScore = match.score;
        }
        // Short-circuit on exact match
        if (maxScore === 1.0) {
          return 1.0;
        }
      }
    }

    return maxScore;
  }

  /**
   * Normalizes a category to canonical form.
   */
  normalizeCategory(category: string): string {
    const normalized = category.toLowerCase().trim();
    return this.aliasMap.get(normalized) ?? normalized;
  }

  /**
   * Gets related categories for query expansion.
   */
  getRelatedCategories(category: string): readonly string[] {
    const canonical = this.normalizeCategory(category);
    const related = new Set<string>();

    // Add the category itself
    related.add(canonical);

    // Add parent categories
    const parents = this.getParents(canonical);
    for (const parent of parents) {
      related.add(parent);
    }

    // Add sibling categories
    const siblings = this.getSiblings(canonical);
    for (const sibling of siblings) {
      related.add(sibling);
    }

    // Add cross-source mappings
    const crossSource = this.crossSourceMap.get(canonical);
    if (crossSource) {
      for (const mapped of crossSource) {
        related.add(mapped);
      }
    }

    // Check reverse cross-source mappings
    for (const [source, targets] of this.crossSourceMap) {
      if (targets.includes(canonical)) {
        related.add(source);
      }
    }

    return Array.from(related);
  }

  /**
   * Checks if two categories are related.
   */
  categoriesOverlap(cat1: string, cat2: string): boolean {
    const match = this.matchCategories(cat1, cat2);
    return match.type !== 'none';
  }

  /**
   * Matches two categories with detailed result.
   *
   * @public
   */
  matchCategories(cat1: string, cat2: string): CategoryMatch {
    const norm1 = this.normalizeCategory(cat1);
    const norm2 = this.normalizeCategory(cat2);

    // 1. Exact match
    if (norm1 === norm2) {
      return { type: 'exact', score: MATCH_SCORES.exact, matchedCategory: norm1 };
    }

    // 2. Alias match (one normalizes to the other's canonical form)
    const canonical1 = this.aliasMap.get(norm1);
    const canonical2 = this.aliasMap.get(norm2);
    if (canonical1 && canonical1 === canonical2) {
      return { type: 'alias', score: MATCH_SCORES.alias, matchedCategory: canonical1 };
    }

    // 3. Parent-child relationship
    const parents1 = this.getParents(canonical1 ?? norm1);
    const parents2 = this.getParents(canonical2 ?? norm2);

    // cat2 is parent of cat1
    if (parents1.includes(canonical2 ?? norm2)) {
      return { type: 'parent', score: MATCH_SCORES.parent, matchedCategory: canonical2 ?? norm2 };
    }

    // cat1 is parent of cat2
    if (parents2.includes(canonical1 ?? norm1)) {
      return { type: 'child', score: MATCH_SCORES.child, matchedCategory: canonical1 ?? norm1 };
    }

    // 4. Sibling match (share a parent)
    const siblings1 = this.getSiblings(canonical1 ?? norm1);
    if (siblings1.includes(canonical2 ?? norm2)) {
      return { type: 'sibling', score: MATCH_SCORES.sibling };
    }

    // 5. Cross-source mapping
    const crossSource1 = this.crossSourceMap.get(canonical1 ?? norm1);
    if (crossSource1?.includes(canonical2 ?? norm2)) {
      return {
        type: 'cross_source',
        score: MATCH_SCORES.cross_source,
        matchedCategory: canonical2 ?? norm2,
      };
    }

    // Reverse cross-source check
    const crossSource2 = this.crossSourceMap.get(canonical2 ?? norm2);
    if (crossSource2?.includes(canonical1 ?? norm1)) {
      return {
        type: 'cross_source',
        score: MATCH_SCORES.cross_source,
        matchedCategory: canonical1 ?? norm1,
      };
    }

    return { type: 'none', score: MATCH_SCORES.none };
  }

  /**
   * Gets all parent categories (recursively).
   */
  private getParents(category: string): readonly string[] {
    const cached = this.parentCache.get(category);
    if (cached) {
      return cached;
    }

    const parents: string[] = [];
    const info = this.taxonomy[category];

    if (info?.parentCodes) {
      for (const parent of info.parentCodes) {
        parents.push(parent);
        // Recursively get grandparents
        const grandparents = this.getParents(parent);
        parents.push(...grandparents);
      }
    }

    this.parentCache.set(category, parents);
    return parents;
  }

  /**
   * Gets sibling categories (same parent).
   */
  private getSiblings(category: string): readonly string[] {
    const cached = this.siblingCache.get(category);
    if (cached) {
      return cached;
    }

    const info = this.taxonomy[category];
    if (!info?.parentCodes?.length) {
      this.siblingCache.set(category, []);
      return [];
    }

    const siblings: string[] = [];

    // Find all categories with the same parent
    for (const [code, catInfo] of Object.entries(this.taxonomy)) {
      if (code === category) continue;

      // Check if they share a parent
      const hasSharedParent = catInfo.parentCodes.some((p) => info.parentCodes.includes(p));
      if (hasSharedParent) {
        siblings.push(code);
      }
    }

    this.siblingCache.set(category, siblings);
    return siblings;
  }

  /**
   * Clears internal caches.
   */
  clearCache(): void {
    this.parentCache.clear();
    this.siblingCache.clear();
  }
}

/**
 * Simple category matcher using string comparison.
 *
 * @remarks
 * Fallback matcher that doesn't require taxonomy data.
 * Uses normalized string comparison and prefix matching.
 *
 * @public
 */
export class SimpleCategoryMatcher implements ICategoryMatcher {
  /**
   * Computes overlap using string matching.
   */
  computeFieldScore(itemCategories: readonly string[], userFields: readonly string[]): number {
    if (itemCategories.length === 0 || userFields.length === 0) {
      return 0;
    }

    let maxScore = 0;

    for (const itemCat of itemCategories) {
      const normalizedItem = this.normalizeCategory(itemCat);

      for (const userField of userFields) {
        const normalizedUser = this.normalizeCategory(userField);

        // Exact match
        if (normalizedItem === normalizedUser) {
          return 1.0;
        }

        // Prefix match (e.g., "cs.ai" matches "cs")
        if (normalizedItem.startsWith(normalizedUser + '.')) {
          maxScore = Math.max(maxScore, 0.7);
        } else if (normalizedUser.startsWith(normalizedItem + '.')) {
          maxScore = Math.max(maxScore, 0.6);
        }

        // Contains match
        if (normalizedItem.includes(normalizedUser) || normalizedUser.includes(normalizedItem)) {
          maxScore = Math.max(maxScore, 0.4);
        }
      }
    }

    return maxScore;
  }

  /**
   * Normalizes category string.
   */
  normalizeCategory(category: string): string {
    return category.toLowerCase().trim().replace(/\s+/g, '-');
  }

  /**
   * Returns empty array (no taxonomy data).
   */
  getRelatedCategories(_category: string): readonly string[] {
    return [];
  }

  /**
   * Checks overlap using string comparison.
   */
  categoriesOverlap(cat1: string, cat2: string): boolean {
    const norm1 = this.normalizeCategory(cat1);
    const norm2 = this.normalizeCategory(cat2);

    return (
      norm1 === norm2 ||
      norm1.startsWith(norm2 + '.') ||
      norm2.startsWith(norm1 + '.') ||
      norm1.includes(norm2) ||
      norm2.includes(norm1)
    );
  }
}

export default TaxonomyCategoryMatcher;
