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
  EXTERNAL_REPO_SCOPES,
  LEGACY_SCOPE,
  PERMISSION_SETS,
  REPO_SCOPES,
  RPC_WILDCARD_SCOPE,
} from '@/auth/scopes/chive-scopes.js';

describe('chive-scopes', () => {
  describe('REPO_SCOPES', () => {
    it('defines scopes for all pub.chive.* collections', () => {
      expect(REPO_SCOPES.EPRINT_SUBMISSION).toBe('repo:pub.chive.eprint.submission');
      expect(REPO_SCOPES.EPRINT_VERSION).toBe('repo:pub.chive.eprint.version');
      expect(REPO_SCOPES.EPRINT_USER_TAG).toBe('repo:pub.chive.eprint.userTag');
      expect(REPO_SCOPES.EPRINT_CITATION).toBe('repo:pub.chive.eprint.citation');
      expect(REPO_SCOPES.EPRINT_RELATED_WORK).toBe('repo:pub.chive.eprint.relatedWork');
      expect(REPO_SCOPES.EPRINT_CHANGELOG).toBe('repo:pub.chive.eprint.changelog');
      expect(REPO_SCOPES.ACTOR_PROFILE).toBe('repo:pub.chive.actor.profile');
      expect(REPO_SCOPES.ACTOR_PROFILE_CONFIG).toBe('repo:pub.chive.actor.profileConfig');
      expect(REPO_SCOPES.REVIEW_COMMENT).toBe('repo:pub.chive.review.comment');
      expect(REPO_SCOPES.REVIEW_ENDORSEMENT).toBe('repo:pub.chive.review.endorsement');
      expect(REPO_SCOPES.ANNOTATION_COMMENT).toBe('repo:pub.chive.annotation.comment');
      expect(REPO_SCOPES.ANNOTATION_ENTITY_LINK).toBe('repo:pub.chive.annotation.entityLink');
      expect(REPO_SCOPES.GRAPH_NODE_PROPOSAL).toBe('repo:pub.chive.graph.nodeProposal');
      expect(REPO_SCOPES.GRAPH_EDGE_PROPOSAL).toBe('repo:pub.chive.graph.edgeProposal');
      expect(REPO_SCOPES.GRAPH_VOTE).toBe('repo:pub.chive.graph.vote');
      expect(REPO_SCOPES.GRAPH_NODE).toBe('repo:pub.chive.graph.node');
      expect(REPO_SCOPES.GRAPH_EDGE).toBe('repo:pub.chive.graph.edge');
      expect(REPO_SCOPES.DISCOVERY_SETTINGS).toBe('repo:pub.chive.discovery.settings');
      expect(REPO_SCOPES.GRAPH_FIELD_PROPOSAL).toBe('repo:pub.chive.graph.fieldProposal');
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

    it('covers all pub.chive.* collections that the app writes to', () => {
      // 19 original + actor.mute + collaboration.invite + collaboration.inviteAcceptance
      expect(Object.keys(REPO_SCOPES)).toHaveLength(22);
    });
  });

  describe('EXTERNAL_REPO_SCOPES', () => {
    it('defines scopes for external namespaces', () => {
      expect(EXTERNAL_REPO_SCOPES.BLUESKY_POST).toBe('repo:app.bsky.feed.post');
      expect(EXTERNAL_REPO_SCOPES.BLUESKY_PROFILE).toBe('repo:app.bsky.actor.profile');
      expect(EXTERNAL_REPO_SCOPES.STANDARD_FULL).toBe('include:site.standard.authFull');
      expect(EXTERNAL_REPO_SCOPES.MARGIN_FULL).toBe('include:at.margin.authFull');
      expect(EXTERNAL_REPO_SCOPES.COSMIK_FULL).toBe('include:network.cosmik.authFull');
      expect(EXTERNAL_REPO_SCOPES.COSMIK_CONNECTION).toBe('repo:network.cosmik.connection');
      expect(EXTERNAL_REPO_SCOPES.COSMIK_FOLLOW).toBe('repo:network.cosmik.follow');
    });

    it('prefixes all scopes with repo: or include:', () => {
      for (const scope of Object.values(EXTERNAL_REPO_SCOPES)) {
        expect(scope).toMatch(/^(repo|include):/);
      }
    });

    it('does not use the pub.chive.* namespace', () => {
      for (const scope of Object.values(EXTERNAL_REPO_SCOPES)) {
        expect(scope).not.toMatch(/pub\.chive\./);
      }
    });

    it('covers every external namespace Chive writes to', () => {
      // 2 Bluesky repo + 1 Standard.site include + 1 Margin include
      //   + 1 Semble include + 2 Semble repo (gaps in authFull)
      expect(Object.keys(EXTERNAL_REPO_SCOPES)).toHaveLength(7);
    });
  });

  describe('BLOB_SCOPES', () => {
    it('defines all blob scopes', () => {
      expect(BLOB_SCOPES.APPLICATION).toBe('blob:application/*');
      expect(BLOB_SCOPES.IMAGE).toBe('blob:image/*');
      expect(BLOB_SCOPES.VIDEO).toBe('blob:video/*');
      expect(BLOB_SCOPES.AUDIO).toBe('blob:audio/*');
      expect(BLOB_SCOPES.TEXT).toBe('blob:text/*');
    });

    it('prefixes all scopes with blob:', () => {
      for (const scope of Object.values(BLOB_SCOPES)) {
        expect(scope).toMatch(/^blob:/);
      }
    });

    it('covers exactly five blob types', () => {
      expect(Object.keys(BLOB_SCOPES)).toHaveLength(5);
    });
  });

  describe('PERMISSION_SETS', () => {
    it('defines four permission set references without audience qualifiers', () => {
      // The `?aud=` qualifier on `include:` was dropped because the rpc
      // permissions inside the lexicons declare `aud: "*"` directly, and
      // `IncludeScope` rejects an aud without `#fragment` per
      // `@atproto/did.isAtprotoAudience`.
      expect(PERMISSION_SETS.BASIC_READER).toBe('include:pub.chive.basicReader');
      expect(PERMISSION_SETS.AUTHOR_ACCESS).toBe('include:pub.chive.authorAccess');
      expect(PERMISSION_SETS.REVIEWER_ACCESS).toBe('include:pub.chive.reviewerAccess');
      expect(PERMISSION_SETS.FULL_ACCESS).toBe('include:pub.chive.fullAccess');
    });

    it('prefixes all sets with include:', () => {
      for (const scope of Object.values(PERMISSION_SETS)) {
        expect(scope).toMatch(/^include:/);
      }
    });

    it('uses three-segment NSIDs so the namespace-prefix authorizes all of pub.chive.*', () => {
      // ATProto's IncludeScope.isAllowedPermission only honors collection /
      // lxm references that share the permission set's group prefix
      // (everything up to its last dot). A 4-segment NSID like
      // `pub.chive.auth.fullAccess` would only authorize `pub.chive.auth.*`.
      for (const scope of Object.values(PERMISSION_SETS)) {
        expect(scope).toMatch(/^include:pub\.chive\.[a-zA-Z]+(\?aud=.+)?$/);
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
      expect(parts).toContain('include:pub.chive.fullAccess');
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

    it('does not include transition:generic (defeats granular scopes)', () => {
      const parts = CLIENT_METADATA_SCOPE.split(' ');
      expect(parts).not.toContain('transition:generic');
    });

    it('includes every Chive repo scope', () => {
      for (const scope of Object.values(REPO_SCOPES)) {
        expect(CLIENT_METADATA_SCOPE).toContain(scope);
      }
    });

    it('emits include: only for cooperating apps that publish a covering permission set', () => {
      // External-namespace permission sets (Margin, Standard.site, Semble's
      // network.cosmik.authFull) are emitted as include: scopes so the
      // consent screen renders one named entry per app. Chive's own
      // scopes are still emitted as individual repo: entries.
      const includeScopes = CLIENT_METADATA_SCOPE.split(' ').filter((p) =>
        p.startsWith('include:')
      );
      for (const scope of includeScopes) {
        expect(scope).not.toMatch(/^include:pub\.chive\./);
      }
    });

    it('includes all external repo scopes', () => {
      for (const scope of Object.values(EXTERNAL_REPO_SCOPES)) {
        expect(CLIENT_METADATA_SCOPE).toContain(scope);
      }
    });

    it('is the product of buildScopeString with chive repo scopes, the rpc wildcard, and external repo scopes', () => {
      const expected = buildScopeString([
        ...Object.values(REPO_SCOPES),
        RPC_WILDCARD_SCOPE,
        ...Object.values(EXTERNAL_REPO_SCOPES),
      ]);
      expect(CLIENT_METADATA_SCOPE).toBe(expected);
    });

    it('grants the rpc wildcard for the chive service DID', () => {
      expect(CLIENT_METADATA_SCOPE).toContain(`rpc:*?aud=${CHIVE_SERVICE_DID}`);
    });
  });
});
