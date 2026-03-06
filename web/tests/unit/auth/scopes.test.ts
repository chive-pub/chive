/**
 * Unit tests for frontend ATProto OAuth scope utilities.
 *
 * @remarks
 * Validates intent-based scope selection, scope checking with hierarchy
 * support, and backward compatibility with the transition:generic scope.
 */

import { describe, it, expect } from 'vitest';

import {
  ATPROTO_BASE_SCOPE,
  EXTERNAL_REPO_SCOPES,
  getScopesForIntent,
  hasScope,
  LEGACY_SCOPE,
  PERMISSION_SETS,
  type AuthIntent,
} from '@/lib/auth/scopes';

describe('frontend scopes', () => {
  describe('getScopesForIntent', () => {
    it('returns basicReader scope for browse intent', () => {
      const result = getScopesForIntent('browse');
      expect(result).toContain(ATPROTO_BASE_SCOPE);
      expect(result).toContain(PERMISSION_SETS.BASIC_READER);
    });

    it('returns authorAccess scope for submit intent', () => {
      const result = getScopesForIntent('submit');
      expect(result).toContain(ATPROTO_BASE_SCOPE);
      expect(result).toContain(PERMISSION_SETS.AUTHOR_ACCESS);
    });

    it('returns reviewerAccess scope for review intent', () => {
      const result = getScopesForIntent('review');
      expect(result).toContain(ATPROTO_BASE_SCOPE);
      expect(result).toContain(PERMISSION_SETS.REVIEWER_ACCESS);
    });

    it('returns fullAccess scope for full intent', () => {
      const result = getScopesForIntent('full');
      expect(result).toContain(ATPROTO_BASE_SCOPE);
      expect(result).toContain(PERMISSION_SETS.FULL_ACCESS);
    });

    it('always starts with the atproto base scope', () => {
      const intents: AuthIntent[] = ['browse', 'submit', 'review', 'full'];
      for (const intent of intents) {
        expect(getScopesForIntent(intent)).toMatch(/^atproto\b/);
      }
    });

    it('returns two tokens for browse intent', () => {
      const parts = getScopesForIntent('browse').split(' ');
      expect(parts).toHaveLength(2);
    });

    it('returns eight tokens for submit, review, and full intents', () => {
      const intents: AuthIntent[] = ['submit', 'review', 'full'];
      for (const intent of intents) {
        const parts = getScopesForIntent(intent).split(' ');
        expect(parts).toHaveLength(8);
      }
    });

    it('includes external scopes for submit intent', () => {
      const result = getScopesForIntent('submit');
      for (const scope of Object.values(EXTERNAL_REPO_SCOPES)) {
        expect(result).toContain(scope);
      }
    });

    it('includes external scopes for review intent', () => {
      const result = getScopesForIntent('review');
      for (const scope of Object.values(EXTERNAL_REPO_SCOPES)) {
        expect(result).toContain(scope);
      }
    });

    it('includes external scopes for full intent', () => {
      const result = getScopesForIntent('full');
      for (const scope of Object.values(EXTERNAL_REPO_SCOPES)) {
        expect(result).toContain(scope);
      }
    });

    it('does not include external scopes for browse intent', () => {
      const result = getScopesForIntent('browse');
      for (const scope of Object.values(EXTERNAL_REPO_SCOPES)) {
        expect(result).not.toContain(scope);
      }
    });

    it('does not include the legacy scope', () => {
      const intents: AuthIntent[] = ['browse', 'submit', 'review', 'full'];
      for (const intent of intents) {
        expect(getScopesForIntent(intent)).not.toContain(LEGACY_SCOPE);
      }
    });
  });

  describe('hasScope', () => {
    describe('legacy scope behavior', () => {
      it('grants any scope when transition:generic is present', () => {
        expect(hasScope([LEGACY_SCOPE], PERMISSION_SETS.FULL_ACCESS)).toBe(true);
        expect(hasScope([LEGACY_SCOPE], PERMISSION_SETS.BASIC_READER)).toBe(true);
        expect(hasScope([LEGACY_SCOPE], PERMISSION_SETS.AUTHOR_ACCESS)).toBe(true);
        expect(hasScope([LEGACY_SCOPE], PERMISSION_SETS.REVIEWER_ACCESS)).toBe(true);
      });

      it('grants arbitrary scope strings when transition:generic is present', () => {
        expect(hasScope([LEGACY_SCOPE], 'anything:else')).toBe(true);
        expect(hasScope([LEGACY_SCOPE], 'repo:pub.chive.eprint.submission')).toBe(true);
      });
    });

    describe('exact match', () => {
      it('returns true for exact scope match', () => {
        expect(hasScope([PERMISSION_SETS.AUTHOR_ACCESS], PERMISSION_SETS.AUTHOR_ACCESS)).toBe(true);
      });

      it('returns false when scope is not granted', () => {
        expect(hasScope([ATPROTO_BASE_SCOPE], PERMISSION_SETS.FULL_ACCESS)).toBe(false);
      });
    });

    describe('permission set hierarchy', () => {
      it('grants basicReader from fullAccess', () => {
        expect(hasScope([PERMISSION_SETS.FULL_ACCESS], PERMISSION_SETS.BASIC_READER)).toBe(true);
      });

      it('grants authorAccess from fullAccess', () => {
        expect(hasScope([PERMISSION_SETS.FULL_ACCESS], PERMISSION_SETS.AUTHOR_ACCESS)).toBe(true);
      });

      it('grants reviewerAccess from fullAccess', () => {
        expect(hasScope([PERMISSION_SETS.FULL_ACCESS], PERMISSION_SETS.REVIEWER_ACCESS)).toBe(true);
      });

      it('grants basicReader from reviewerAccess', () => {
        expect(hasScope([PERMISSION_SETS.REVIEWER_ACCESS], PERMISSION_SETS.BASIC_READER)).toBe(
          true
        );
      });

      it('grants basicReader from authorAccess', () => {
        expect(hasScope([PERMISSION_SETS.AUTHOR_ACCESS], PERMISSION_SETS.BASIC_READER)).toBe(true);
      });
    });

    describe('hierarchy does not grant upward', () => {
      it('does not grant authorAccess from basicReader', () => {
        expect(hasScope([PERMISSION_SETS.BASIC_READER], PERMISSION_SETS.AUTHOR_ACCESS)).toBe(false);
      });

      it('does not grant reviewerAccess from authorAccess', () => {
        expect(hasScope([PERMISSION_SETS.AUTHOR_ACCESS], PERMISSION_SETS.REVIEWER_ACCESS)).toBe(
          false
        );
      });

      it('does not grant fullAccess from reviewerAccess', () => {
        expect(hasScope([PERMISSION_SETS.REVIEWER_ACCESS], PERMISSION_SETS.FULL_ACCESS)).toBe(
          false
        );
      });

      it('does not grant fullAccess from basicReader', () => {
        expect(hasScope([PERMISSION_SETS.BASIC_READER], PERMISSION_SETS.FULL_ACCESS)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('returns false for empty granted scopes', () => {
        expect(hasScope([], PERMISSION_SETS.BASIC_READER)).toBe(false);
      });

      it('returns false for unknown scope strings', () => {
        expect(hasScope(['unknown:scope'], 'another:scope')).toBe(false);
      });

      it('handles multiple granted scopes correctly', () => {
        const granted = [ATPROTO_BASE_SCOPE, PERMISSION_SETS.AUTHOR_ACCESS];
        expect(hasScope(granted, PERMISSION_SETS.AUTHOR_ACCESS)).toBe(true);
        expect(hasScope(granted, PERMISSION_SETS.BASIC_READER)).toBe(true);
        expect(hasScope(granted, PERMISSION_SETS.REVIEWER_ACCESS)).toBe(false);
      });

      it('does not confuse atproto base scope with permission sets', () => {
        expect(hasScope([ATPROTO_BASE_SCOPE], PERMISSION_SETS.BASIC_READER)).toBe(false);
      });
    });
  });
});
