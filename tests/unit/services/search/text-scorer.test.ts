/**
 * Unit tests for text scorer implementations.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  DiceTextScorer,
  AcademicTextScorer,
  SimpleTextScorer,
} from '@/services/search/text-scorer.js';

describe('DiceTextScorer', () => {
  let scorer: DiceTextScorer;

  beforeEach(() => {
    scorer = new DiceTextScorer();
  });

  describe('score', () => {
    it('returns 1.0 for exact match', () => {
      expect(scorer.score('neural networks', 'neural networks')).toBe(1.0);
    });

    it('returns 1.0 for exact match with different casing', () => {
      expect(scorer.score('Neural Networks', 'neural networks')).toBe(1.0);
    });

    it('returns high score for similar text', () => {
      const score = scorer.score('neural network', 'neural networks');
      expect(score).toBeGreaterThan(0.8);
    });

    it('returns low score for dissimilar text', () => {
      const score = scorer.score('quantum computing', 'neural networks');
      expect(score).toBeLessThan(0.5);
    });

    it('returns 0 for empty query', () => {
      expect(scorer.score('', 'neural networks')).toBe(0);
    });

    it('returns 0 for empty target', () => {
      expect(scorer.score('neural networks', '')).toBe(0);
    });

    it('filters stop words', () => {
      // "the" and "is" are stop words
      const score = scorer.score('the network is good', 'network good');
      expect(score).toBe(1.0);
    });

    it('handles punctuation', () => {
      const score = scorer.score('attention-mechanism', 'attention mechanism');
      expect(score).toBeGreaterThan(0.8);
    });

    it('handles partial word matches', () => {
      const score = scorer.score('attention', 'self-attention mechanism');
      expect(score).toBeGreaterThan(0.3);
    });
  });

  describe('scoreMultiField', () => {
    it('computes weighted average across fields', () => {
      const fields = {
        title: 'Machine learning for image recognition',
        abstract: 'This paper presents a deep learning approach',
      };
      const weights = { title: 1.0, abstract: 0.5 };

      const score = scorer.scoreMultiField('machine learning', fields, weights);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('handles missing fields', () => {
      const fields = {
        title: 'Machine learning paper',
        abstract: undefined,
      };
      const weights = { title: 1.0, abstract: 0.5 };

      const score = scorer.scoreMultiField('machine learning', fields, weights);
      expect(score).toBeGreaterThan(0);
    });

    it('returns 0 for empty query', () => {
      const fields = { title: 'Some title' };
      const weights = { title: 1.0 };

      expect(scorer.scoreMultiField('', fields, weights)).toBe(0);
    });

    it('returns 0 when all fields are empty', () => {
      const fields = { title: undefined, abstract: undefined };
      const weights = { title: 1.0, abstract: 0.5 };

      expect(scorer.scoreMultiField('query', fields, weights)).toBe(0);
    });
  });
});

describe('AcademicTextScorer', () => {
  let scorer: AcademicTextScorer;

  beforeEach(() => {
    scorer = new AcademicTextScorer();
  });

  describe('score', () => {
    it('returns 1.0 for exact match', () => {
      expect(scorer.score('attention mechanism', 'attention mechanism')).toBe(1.0);
    });

    it('returns high score for academic title matching query', () => {
      const score = scorer.score('transformer', 'Attention Is All You Need: Transformers for NLP');
      expect(score).toBeGreaterThan(0.2);
    });

    it('handles multi-word queries', () => {
      const score = scorer.score(
        'deep learning image classification',
        'Deep Learning Approaches for Image Classification Tasks'
      );
      expect(score).toBeGreaterThan(0.5);
    });

    it('handles word transposition', () => {
      const score = scorer.score('network neural', 'neural network');
      expect(score).toBeGreaterThan(0.5);
    });

    it('provides reasonable score for typos', () => {
      const score = scorer.score('nueral network', 'neural network');
      expect(score).toBeGreaterThan(0.4);
    });
  });

  describe('scoreMultiField', () => {
    it('weights title higher than abstract', () => {
      const titleOnlyMatch = scorer.scoreMultiField(
        'specific term',
        { title: 'A specific term study', abstract: 'Unrelated content here' },
        { title: 1.0, abstract: 0.5 }
      );

      const abstractOnlyMatch = scorer.scoreMultiField(
        'specific term',
        { title: 'Unrelated title content', abstract: 'A specific term study' },
        { title: 1.0, abstract: 0.5 }
      );

      expect(titleOnlyMatch).toBeGreaterThan(abstractOnlyMatch);
    });
  });
});

describe('SimpleTextScorer', () => {
  let scorer: SimpleTextScorer;

  beforeEach(() => {
    scorer = new SimpleTextScorer();
  });

  describe('score', () => {
    it('returns 1.0 for exact match', () => {
      expect(scorer.score('neural networks', 'neural networks')).toBe(1.0);
    });

    it('returns 0.9 for title starting with query', () => {
      expect(scorer.score('neural', 'neural networks for vision')).toBe(0.9);
    });

    it('returns 0.8 for title containing query', () => {
      expect(scorer.score('network', 'deep neural network architecture')).toBe(0.8);
    });

    it('returns word overlap score for partial matches', () => {
      const score = scorer.score('deep learning models', 'deep neural network models');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.8);
    });

    it('returns 0 for empty query', () => {
      expect(scorer.score('', 'some title')).toBe(0);
    });

    it('handles case insensitivity', () => {
      expect(scorer.score('NEURAL', 'neural networks')).toBe(0.9);
    });
  });

  describe('scoreMultiField', () => {
    it('computes weighted average', () => {
      const score = scorer.scoreMultiField(
        'machine learning',
        { title: 'machine learning paper', abstract: 'about algorithms' },
        { title: 1.0, abstract: 0.5 }
      );
      expect(score).toBeGreaterThan(0);
    });
  });
});

describe('Text scorer comparison', () => {
  const diceScorer = new DiceTextScorer();
  const academicScorer = new AcademicTextScorer();
  const simpleScorer = new SimpleTextScorer();

  const testCases = [
    {
      name: 'exact match',
      query: 'neural network',
      target: 'neural network',
      expectedAllHigh: true,
    },
    {
      name: 'partial match',
      query: 'neural',
      target: 'neural network architecture',
      expectedAllPositive: true,
    },
    {
      name: 'no overlap',
      query: 'quantum computing',
      target: 'biological systems',
      expectedAllLow: true,
    },
  ];

  testCases.forEach(
    ({ name, query, target, expectedAllHigh, expectedAllPositive, expectedAllLow }) => {
      it(`all scorers handle ${name} consistently`, () => {
        const diceScore = diceScorer.score(query, target);
        const academicScore = academicScorer.score(query, target);
        const simpleScore = simpleScorer.score(query, target);

        if (expectedAllHigh) {
          expect(diceScore).toBe(1.0);
          expect(academicScore).toBe(1.0);
          expect(simpleScore).toBe(1.0);
        }

        if (expectedAllPositive) {
          expect(diceScore).toBeGreaterThan(0);
          expect(academicScore).toBeGreaterThan(0);
          expect(simpleScore).toBeGreaterThan(0);
        }

        if (expectedAllLow) {
          expect(diceScore).toBeLessThan(0.3);
          expect(academicScore).toBeLessThan(0.3);
          expect(simpleScore).toBeLessThan(0.3);
        }
      });
    }
  );
});
