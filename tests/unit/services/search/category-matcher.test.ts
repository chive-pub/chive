/**
 * Unit tests for category matcher implementations.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  TaxonomyCategoryMatcher,
  SimpleCategoryMatcher,
} from '@/services/search/category-matcher.js';

describe('TaxonomyCategoryMatcher', () => {
  let matcher: TaxonomyCategoryMatcher;

  beforeEach(() => {
    matcher = new TaxonomyCategoryMatcher();
  });

  describe('normalizeCategory', () => {
    it('returns canonical code for known aliases', () => {
      expect(matcher.normalizeCategory('artificial intelligence')).toBe('cs.ai');
      expect(matcher.normalizeCategory('nlp')).toBe('cs.cl');
      // Test unambiguous aliases
      expect(matcher.normalizeCategory('deep learning')).toBe('cs.lg');
      expect(matcher.normalizeCategory('cryptography')).toBe('cs.cr');
    });

    it('returns lowercase for unknown categories', () => {
      expect(matcher.normalizeCategory('Unknown Category')).toBe('unknown category');
    });

    it('normalizes arXiv categories', () => {
      expect(matcher.normalizeCategory('cs.AI')).toBe('cs.ai');
      expect(matcher.normalizeCategory('CS.LG')).toBe('cs.lg');
    });

    it('handles linguistics categories', () => {
      expect(matcher.normalizeCategory('syntax')).toBe('linguistics.syntax');
      expect(matcher.normalizeCategory('semantics')).toBe('linguistics.semantics');
    });
  });

  describe('matchCategories', () => {
    it('returns exact match for identical categories', () => {
      const match = matcher.matchCategories('cs.ai', 'cs.ai');
      expect(match.type).toBe('exact');
      expect(match.score).toBe(1.0);
    });

    it('returns exact match when alias normalizes to same code', () => {
      // "artificial intelligence" normalizes to "cs.ai", so comparing to "cs.ai" is exact
      const match = matcher.matchCategories('artificial intelligence', 'cs.ai');
      expect(match.type).toBe('exact');
      expect(match.score).toBe(1.0);
    });

    it('returns alias match for name matching code', () => {
      // "Artificial Intelligence" (name) matches "cs.ai" (code) through alias lookup
      const match = matcher.matchCategories('ai', 'cs.ai');
      expect(match.type).toBe('exact'); // "ai" normalizes to "cs.ai"
      expect(match.score).toBe(1.0);
    });

    it('returns parent match when child matches parent', () => {
      const match = matcher.matchCategories('cs.ai', 'cs');
      expect(match.type).toBe('parent');
      expect(match.score).toBe(0.7);
    });

    it('returns child match when parent matches child', () => {
      const match = matcher.matchCategories('cs', 'cs.ai');
      expect(match.type).toBe('child');
      expect(match.score).toBe(0.6);
    });

    it('returns sibling match for categories with same parent', () => {
      const match = matcher.matchCategories('cs.ai', 'cs.lg');
      expect(match.type).toBe('sibling');
      expect(match.score).toBe(0.5);
    });

    it('returns cross-source match for mapped categories', () => {
      const match = matcher.matchCategories('linguistics.syntax', 'cs.cl');
      expect(match.type).toBe('cross_source');
      expect(match.score).toBe(0.6);
    });

    it('returns none for unrelated categories', () => {
      const match = matcher.matchCategories('cs.ai', 'physics');
      expect(match.type).toBe('none');
      expect(match.score).toBe(0);
    });
  });

  describe('computeFieldScore', () => {
    it('returns 1.0 for exact category match', () => {
      const score = matcher.computeFieldScore(['cs.ai'], ['cs.ai']);
      expect(score).toBe(1.0);
    });

    it('returns 0 for empty item categories', () => {
      const score = matcher.computeFieldScore([], ['cs.ai']);
      expect(score).toBe(0);
    });

    it('returns 0 for empty user fields', () => {
      const score = matcher.computeFieldScore(['cs.ai'], []);
      expect(score).toBe(0);
    });

    it('returns highest match score across all pairs', () => {
      const score = matcher.computeFieldScore(['cs.ai', 'physics'], ['cs.lg', 'math']);
      // cs.ai and cs.lg are siblings (score 0.5)
      expect(score).toBe(0.5);
    });

    it('short-circuits on exact match', () => {
      const score = matcher.computeFieldScore(
        ['physics', 'cs.ai', 'math'],
        ['biology', 'cs.ai', 'chemistry']
      );
      expect(score).toBe(1.0);
    });

    it('handles multiple parent matches', () => {
      const score = matcher.computeFieldScore(['cs.ai', 'cs.lg'], ['cs']);
      expect(score).toBe(0.7); // parent match
    });

    it('handles cross-domain categories', () => {
      const score = matcher.computeFieldScore(['linguistics.syntax'], ['cs.cl', 'cs.ai']);
      expect(score).toBe(0.6); // cross-source match
    });
  });

  describe('categoriesOverlap', () => {
    it('returns true for exact match', () => {
      expect(matcher.categoriesOverlap('cs.ai', 'cs.ai')).toBe(true);
    });

    it('returns true for alias match', () => {
      // "ai" alias normalizes to cs.ai
      expect(matcher.categoriesOverlap('ai', 'cs.ai')).toBe(true);
      expect(matcher.categoriesOverlap('deep learning', 'cs.lg')).toBe(true);
    });

    it('returns true for parent-child relationship', () => {
      expect(matcher.categoriesOverlap('cs.ai', 'cs')).toBe(true);
      expect(matcher.categoriesOverlap('cs', 'cs.ai')).toBe(true);
    });

    it('returns true for siblings', () => {
      expect(matcher.categoriesOverlap('cs.ai', 'cs.lg')).toBe(true);
    });

    it('returns true for cross-source mapping', () => {
      expect(matcher.categoriesOverlap('linguistics', 'cs.cl')).toBe(true);
    });

    it('returns false for unrelated categories', () => {
      expect(matcher.categoriesOverlap('cs.ai', 'q-bio.nc')).toBe(false);
    });
  });

  describe('getRelatedCategories', () => {
    it('returns self and parents for subcategory', () => {
      const related = matcher.getRelatedCategories('cs.ai');
      expect(related).toContain('cs.ai');
      expect(related).toContain('cs');
    });

    it('returns siblings for subcategory', () => {
      const related = matcher.getRelatedCategories('cs.ai');
      expect(related).toContain('cs.lg');
      expect(related).toContain('cs.cl');
    });

    it('returns cross-source mappings', () => {
      const related = matcher.getRelatedCategories('linguistics.syntax');
      expect(related).toContain('cs.cl');
    });

    it('returns reverse cross-source mappings', () => {
      const related = matcher.getRelatedCategories('cs.cl');
      expect(related).toContain('linguistics');
    });
  });

  describe('clearCache', () => {
    it('clears internal caches without error', () => {
      // Prime the caches
      matcher.getRelatedCategories('cs.ai');
      matcher.matchCategories('cs.ai', 'cs.lg');

      // Clear should not throw
      expect(() => matcher.clearCache()).not.toThrow();
    });
  });
});

describe('SimpleCategoryMatcher', () => {
  let matcher: SimpleCategoryMatcher;

  beforeEach(() => {
    matcher = new SimpleCategoryMatcher();
  });

  describe('normalizeCategory', () => {
    it('lowercases and trims', () => {
      expect(matcher.normalizeCategory(' Computer Science ')).toBe('computer-science');
    });

    it('replaces spaces with hyphens', () => {
      expect(matcher.normalizeCategory('machine learning')).toBe('machine-learning');
    });
  });

  describe('computeFieldScore', () => {
    it('returns 1.0 for exact match', () => {
      const score = matcher.computeFieldScore(['cs.ai'], ['cs.ai']);
      expect(score).toBe(1.0);
    });

    it('returns 0.7 for prefix match', () => {
      const score = matcher.computeFieldScore(['cs.ai'], ['cs']);
      expect(score).toBe(0.7);
    });

    it('returns 0.6 for reverse prefix match', () => {
      const score = matcher.computeFieldScore(['cs'], ['cs.ai']);
      expect(score).toBe(0.6);
    });

    it('returns 0 for empty arrays', () => {
      expect(matcher.computeFieldScore([], ['cs.ai'])).toBe(0);
      expect(matcher.computeFieldScore(['cs.ai'], [])).toBe(0);
    });
  });

  describe('categoriesOverlap', () => {
    it('returns true for exact match', () => {
      expect(matcher.categoriesOverlap('cs.ai', 'cs.ai')).toBe(true);
    });

    it('returns true for prefix match', () => {
      expect(matcher.categoriesOverlap('cs.ai', 'cs')).toBe(true);
    });

    it('returns true for contains match', () => {
      expect(matcher.categoriesOverlap('computer science', 'science')).toBe(true);
    });

    it('returns false for unrelated categories', () => {
      expect(matcher.categoriesOverlap('computer science', 'biology')).toBe(false);
    });
  });

  describe('getRelatedCategories', () => {
    it('returns empty array (no taxonomy data)', () => {
      expect(matcher.getRelatedCategories('cs.ai')).toEqual([]);
    });
  });
});

describe('Category matcher comparison', () => {
  const taxonomyMatcher = new TaxonomyCategoryMatcher();
  const simpleMatcher = new SimpleCategoryMatcher();

  it('both handle exact matches', () => {
    expect(taxonomyMatcher.computeFieldScore(['cs.ai'], ['cs.ai'])).toBe(1.0);
    expect(simpleMatcher.computeFieldScore(['cs.ai'], ['cs.ai'])).toBe(1.0);
  });

  it('taxonomy matcher handles aliases better', () => {
    const taxonomyScore = taxonomyMatcher.computeFieldScore(['artificial intelligence'], ['cs.ai']);
    const simpleScore = simpleMatcher.computeFieldScore(['artificial intelligence'], ['cs.ai']);

    expect(taxonomyScore).toBeGreaterThan(simpleScore);
  });

  it('both handle hierarchical categories', () => {
    const taxonomyScore = taxonomyMatcher.computeFieldScore(['cs.ai'], ['cs']);
    const simpleScore = simpleMatcher.computeFieldScore(['cs.ai'], ['cs']);

    expect(taxonomyScore).toBeGreaterThan(0);
    expect(simpleScore).toBeGreaterThan(0);
  });
});

describe('Real-world category matching scenarios', () => {
  const matcher = new TaxonomyCategoryMatcher();

  it('matches arXiv categories to user research fields', () => {
    // User researches AI and ML
    const userFields = ['cs.ai', 'cs.lg', 'stat.ml'];

    // Paper about neural networks (cs.ne)
    const paperCategories = ['cs.ne', 'cs.lg'];

    const score = matcher.computeFieldScore(paperCategories, userFields);
    expect(score).toBe(1.0); // Exact match on cs.lg
  });

  it('matches linguistics eprints to NLP researchers', () => {
    const userFields = ['cs.cl', 'cs.ai'];
    const paperCategories = ['linguistics.syntax', 'linguistics.semantics'];

    const score = matcher.computeFieldScore(paperCategories, userFields);
    expect(score).toBe(0.6); // Cross-source match
  });

  it('handles broad vs specific fields', () => {
    const userFields = ['computer science'];
    const paperCategories = ['cs.ai', 'cs.lg'];

    const score = matcher.computeFieldScore(paperCategories, userFields);
    expect(score).toBeGreaterThan(0); // Should have some match
  });

  it('handles physics subcategories', () => {
    const userFields = ['quant-ph', 'hep-th'];
    const paperCategories = ['physics', 'math-ph'];

    const score = matcher.computeFieldScore(paperCategories, userFields);
    expect(score).toBeGreaterThan(0); // Parent/sibling matches
  });
});
