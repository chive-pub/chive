/**
 * Platform administrator identity configuration.
 *
 * @remarks
 * Single source of truth for who the platform administrators are. The list was
 * previously parsed in three places with two different behaviours: the seeding
 * paths in `src/index.ts` and `scripts/seed-admin.ts` each fell back to a
 * hardcoded DID when `ADMIN_DIDS` was unset, while the governance role service
 * parsed the same variable with no fallback.
 *
 * On a deployment that never sets `ADMIN_DIDS` — which is the documented normal
 * case, and is how the production compose file is configured — those paths
 * diverged: a platform admin was seeded, but the governance layer saw an empty
 * list and recognised no administrator. Every privileged governance endpoint
 * was therefore unreachable, with nothing able to create the first
 * administrator.
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../types/atproto.js';

/**
 * Administrator used when `ADMIN_DIDS` is unset.
 *
 * @remarks
 * Preserves the behaviour the seeding scripts already relied on. Kept here so
 * the governance layer and the seeding paths cannot disagree about it again.
 *
 * @public
 */
export const DEFAULT_ADMIN_DID = 'did:plc:34mbm5v3umztwvvgnttvcz6e' as DID;

/**
 * Resolves the configured platform administrator DIDs.
 *
 * @param raw - Raw `ADMIN_DIDS` value; defaults to the environment variable
 * @returns The administrator DIDs, falling back to {@link DEFAULT_ADMIN_DID}
 *
 * @remarks
 * A blank or whitespace-only value counts as unset: an environment variable
 * interpolated from an undefined deploy variable yields an empty string, and
 * treating that as "no administrators" is what silently disabled governance.
 *
 * @example
 * ```typescript
 * getAdminDids('did:plc:abc, did:plc:def'); // ['did:plc:abc', 'did:plc:def']
 * getAdminDids(undefined);                  // [DEFAULT_ADMIN_DID]
 * ```
 *
 * @public
 */
export function getAdminDids(raw: string | undefined = process.env.ADMIN_DIDS): DID[] {
  const configured = (raw ?? '')
    .split(',')
    .map((did) => did.trim())
    .filter(Boolean) as DID[];

  return configured.length > 0 ? configured : [DEFAULT_ADMIN_DID];
}
