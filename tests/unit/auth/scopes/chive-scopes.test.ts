/**
 * Unit tests for Chive ATProto OAuth scope definitions.
 *
 * @remarks
 * Validates that all scope constants, permission sets, and the
 * buildScopeString utility conform to ATProto granular scope conventions.
 */

import { describe, it, expect } from 'vitest';

import {
  ATPROTO_BASE_SCOPE,
  BLOB_SCOPES,
  buildScopeString,
  CHIVE_SERVICE_DID,
  CLIENT_METADATA_SCOPE,
  LEGACY_SCOPE,
  PERMISSION_SETS,
  REPO_SCOPES,
} from '@/auth/scopes/chive-scopes.js';

describe('chive-scopes', () => {
  describe('REPO_SCOPES', () => {
    it('defines scopes for all pub.chive.* collections', () => {
      expect(REPO_SCOPES.EPRINT_SUBMISSION).toBe('repo:pub.chive.eprint.submission');
      expect(REPO_SCOPES.EPRINT_VERSION).toBe('repo:pub.chive.eprint.version');
      expect(REPO_SCOPES.EPRINT_USER_TAG).toBe('repo:pub.chive.eprint.userTag');
      expect(REPO_SCOPES.REVIEW_COMMENT).toBe('repo:pub.chive.review.comment');
      expect(REPO_SCOPES.REVIEW_ENDORSEMENT).toBe('repo:pub.chive.review.endorsement');
      expect(REPO_SCOPES.GRAPH_FIELD_PROPOSAL).toBe('repo:pub.chive.graph.fieldProposal');
      expect(REPO_SCOPES.GRAPH_VOTE).toBe('repo:pub.chive.graph.vote');
    });

    it('prefixes all scopes with repo:', () => {
      for (const scope of Object.values(REPO_SCOPES)) {
        expect(scope).toMatch(/^repo:/);
      }
    });

    it('restricts all scopes to the pub.chive.* namespace', () => {
      for (const scope of Object.values(REPO_SCOPES)) {
        expect(scope).toMatch(/^repo:pub\.chive\./);
      }
    });

    it('covers exactly seven collections', () => {
      expect(Object.keys(REPO_SCOPES)).toHaveLength(7);
    });
  });

  describe('BLOB_SCOPES', () => {
    it('defines PDF and image blob scopes', () => {
      expect(BLOB_SCOPES.PDF).toBe('blob:application/pdf');
      expect(BLOB_SCOPES.IMAGE).toBe('blob:image/*');
    });

    it('prefixes all scopes with blob:', () => {
      for (const scope of Object.values(BLOB_SCOPES)) {
        expect(scope).toMatch(/^blob:/);
      }
    });

    it('covers exactly two blob types', () => {
      expect(Object.keys(BLOB_SCOPES)).toHaveLength(2);
    });
  });

  describe('PERMISSION_SETS', () => {
    it('defines four permission set references', () => {
      expect(PERMISSION_SETS.BASIC_READER).toBe('include:pub.chive.auth.basicReader');
      expect(PERMISSION_SETS.AUTHOR_ACCESS).toBe('include:pub.chive.auth.authorAccess');
      expect(PERMISSION_SETS.REVIEWER_ACCESS).toBe('include:pub.chive.auth.reviewerAccess');
      expect(PERMISSION_SETS.FULL_ACCESS).toBe('include:pub.chive.auth.fullAccess');
    });

    it('prefixes all sets with include:', () => {
      for (const scope of Object.values(PERMISSION_SETS)) {
        expect(scope).toMatch(/^include:/);
      }
    });

    it('restricts all sets to the pub.chive.auth.* namespace', () => {
      for (const scope of Object.values(PERMISSION_SETS)) {
        expect(scope).toMatch(/^include:pub\.chive\.auth\./);
      }
    });

    it('covers exactly four permission levels', () => {
      expect(Object.keys(PERMISSION_SETS)).toHaveLength(4);
    });
  });

  describe('constants', () => {
    it('defines the legacy scope for backward compatibility', () => {
      expect(LEGACY_SCOPE).toBe('transition:generic');
    });

    it('defines the base ATProto scope', () => {
      expect(ATPROTO_BASE_SCOPE).toBe('atproto');
    });

    it('defines Chive service DID as did:web:chive.pub', () => {
      expect(CHIVE_SERVICE_DID).toBe('did:web:chive.pub');
    });
  });

  describe('buildScopeString', () => {
    it('always includes the atproto base scope', () => {
      const result = buildScopeString([]);
      expect(result).toBe('atproto');
    });

    it('joins additional scopes with spaces', () => {
      const result = buildScopeString([LEGACY_SCOPE, PERMISSION_SETS.FULL_ACCESS]);
      const parts = result.split(' ');
      expect(parts).toContain('atproto');
      expect(parts).toContain('transition:generic');
      expect(parts).toContain('include:pub.chive.auth.fullAccess');
    });

    it('deduplicates atproto if passed explicitly', () => {
      const result = buildScopeString(['atproto', LEGACY_SCOPE]);
      const parts = result.split(' ');
      const atprotoCount = parts.filter((p) => p === 'atproto').length;
      expect(atprotoCount).toBe(1);
    });

    it('deduplicates repeated scope strings', () => {
      const result = buildScopeString([LEGACY_SCOPE, LEGACY_SCOPE]);
      const parts = result.split(' ');
      const legacyCount = parts.filter((p) => p === LEGACY_SCOPE).length;
      expect(legacyCount).toBe(1);
    });

    it('returns a space-separated string', () => {
      const result = buildScopeString([PERMISSION_SETS.BASIC_READER]);
      expect(result).not.toContain(',');
      expect(result.split(' ')).toHaveLength(2);
    });

    it('places atproto first', () => {
      const result = buildScopeString([PERMISSION_SETS.AUTHOR_ACCESS]);
      expect(result.startsWith('atproto')).toBe(true);
    });
  });

  describe('CLIENT_METADATA_SCOPE', () => {
    it('includes the atproto base scope', () => {
      expect(CLIENT_METADATA_SCOPE).toContain('atproto');
    });

    it('includes the legacy scope for backward compatibility', () => {
      expect(CLIENT_METADATA_SCOPE).toContain('transition:generic');
    });

    it('includes the fullAccess permission set', () => {
      expect(CLIENT_METADATA_SCOPE).toContain('include:pub.chive.auth.fullAccess');
    });

    it('is the product of buildScopeString with legacy and fullAccess', () => {
      const expected = buildScopeString([LEGACY_SCOPE, PERMISSION_SETS.FULL_ACCESS]);
      expect(CLIENT_METADATA_SCOPE).toBe(expected);
    });
  });
});
