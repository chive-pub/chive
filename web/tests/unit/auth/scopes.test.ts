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
  CHIVE_REPO_SCOPES,
  EXTERNAL_REPO_SCOPES,
  getScopesForIntent,
  hasScope,
  LEGACY_SCOPE,
  PERMISSION_SETS,
  type AuthIntent,
} from '@/lib/auth/scopes';

describe('frontend scopes', () => {
  describe('getScopesForIntent', () => {
    it('returns only atproto base scope for browse intent', () => {
      const result = getScopesForIntent('browse');
      expect(result).toBe(ATPROTO_BASE_SCOPE);
    });

    it('includes chive repo scopes for submit intent', () => {
      const result = getScopesForIntent('submit');
      expect(result).toContain(ATPROTO_BASE_SCOPE);
      expect(result).toContain(CHIVE_REPO_SCOPES.EPRINT_SUBMISSION);
    });

    it('includes chive repo scopes for review intent', () => {
      const result = getScopesForIntent('review');
      expect(result).toContain(ATPROTO_BASE_SCOPE);
      expect(result).toContain(CHIVE_REPO_SCOPES.REVIEW_COMMENT);
    });

    it('includes chive repo scopes for full intent', () => {
      const result = getScopesForIntent('full');
      expect(result).toContain(ATPROTO_BASE_SCOPE);
      expect(result).toContain(CHIVE_REPO_SCOPES.GRAPH_NODE);
    });

    it('always starts with the atproto base scope', () => {
      const intents: AuthIntent[] = ['browse', 'submit', 'review', 'full'];
      for (const intent of intents) {
        expect(getScopesForIntent(intent)).toMatch(/^atproto\b/);
      }
    });

    it('returns one token for browse intent', () => {
      const parts = getScopesForIntent('browse').split(' ');
      expect(parts).toHaveLength(1);
    });

    it('returns correct token count for submit, review, and full intents', () => {
      const chiveCount = Object.values(CHIVE_REPO_SCOPES).length;
      const externalCount = Object.values(EXTERNAL_REPO_SCOPES).length;
      const expected = 1 + chiveCount + externalCount;
      const intents: AuthIntent[] = ['submit', 'review', 'full'];
      for (const intent of intents) {
        const parts = getScopesForIntent(intent).split(' ');
        expect(parts).toHaveLength(expected);
      }
    });

    it('emits include: only for cooperating-app permission sets, not for Chive scopes', () => {
      // Chive's own scopes are emitted as repo: entries unless
      // NEXT_PUBLIC_USE_PERMISSION_SETS=true (set per build, not per
      // test). External-namespace permission sets (Margin, Standard.site,
      // Semble's network.cosmik.authFull) are emitted as include: scopes
      // so the consent screen renders one named entry per app.
      const intents: AuthIntent[] = ['browse', 'submit', 'review', 'full'];
      for (const intent of intents) {
        const includeScopes = getScopesForIntent(intent)
          .split(' ')
          .filter((p) => p.startsWith('include:'));
        for (const scope of includeScopes) {
          expect(scope).not.toMatch(/^include:pub\.chive\./);
        }
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
