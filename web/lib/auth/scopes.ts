/**
 * Frontend ATProto OAuth scope utilities for Chive.
 *
 * @remarks
 * Provides intent-based scope selection and scope checking utilities
 * for the Chive frontend. Mirrors scope constants from the backend.
 */

/** Authorization intent determining the scope level requested during OAuth. */
export type AuthIntent = 'browse' | 'submit' | 'review' | 'full';

/** Permission set scope references. */
export const PERMISSION_SETS = {
  BASIC_READER: 'include:pub.chive.auth.basicReader',
  AUTHOR_ACCESS: 'include:pub.chive.auth.authorAccess',
  REVIEWER_ACCESS: 'include:pub.chive.auth.reviewerAccess',
  FULL_ACCESS: 'include:pub.chive.auth.fullAccess',
} as const;

/** Legacy scope for backward compatibility. */
export const LEGACY_SCOPE = 'transition:generic';

/** ATProto base scope (always required). */
export const ATPROTO_BASE_SCOPE = 'atproto';

/**
 * Permission set hierarchy from least to most permissive.
 *
 * @remarks
 * Each set includes all permissions from sets below it in the hierarchy.
 */
const PERMISSION_HIERARCHY = [
  PERMISSION_SETS.BASIC_READER,
  PERMISSION_SETS.AUTHOR_ACCESS,
  PERMISSION_SETS.REVIEWER_ACCESS,
  PERMISSION_SETS.FULL_ACCESS,
] as const;

/**
 * Get the OAuth scope string for a given authorization intent.
 *
 * @param intent - The user's intent (browse, submit, review, full)
 * @returns Space-separated scope string including atproto base scope
 */
export function getScopesForIntent(intent: AuthIntent): string {
  switch (intent) {
    case 'browse':
      return `${ATPROTO_BASE_SCOPE} ${PERMISSION_SETS.BASIC_READER}`;
    case 'submit':
      return `${ATPROTO_BASE_SCOPE} ${PERMISSION_SETS.AUTHOR_ACCESS}`;
    case 'review':
      return `${ATPROTO_BASE_SCOPE} ${PERMISSION_SETS.REVIEWER_ACCESS}`;
    case 'full':
      return `${ATPROTO_BASE_SCOPE} ${PERMISSION_SETS.FULL_ACCESS}`;
  }
}

/**
 * Check if granted scopes satisfy a required scope.
 *
 * @remarks
 * Treats `transition:generic` as granting all pub.chive.* scopes for
 * backward compatibility. Also respects the permission set hierarchy
 * (fullAccess includes reviewerAccess includes authorAccess includes basicReader).
 *
 * @param grantedScopes - Array of scope strings from the OAuth session
 * @param required - The scope string that is required
 * @returns True if the required scope is satisfied
 */
export function hasScope(grantedScopes: readonly string[], required: string): boolean {
  // transition:generic grants everything
  if (grantedScopes.includes(LEGACY_SCOPE)) return true;

  // Exact match
  if (grantedScopes.includes(required)) return true;

  // Permission set hierarchy check
  const requiredIndex = PERMISSION_HIERARCHY.indexOf(
    required as (typeof PERMISSION_HIERARCHY)[number]
  );
  if (requiredIndex >= 0) {
    return grantedScopes.some((s) => {
      const grantedIndex = PERMISSION_HIERARCHY.indexOf(s as (typeof PERMISSION_HIERARCHY)[number]);
      return grantedIndex >= 0 && grantedIndex >= requiredIndex;
    });
  }

  return false;
}
