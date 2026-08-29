/**
 * Configuration for writing to the Chive Governance PDS.
 *
 * @remarks
 * The governance PDS holds community-approved authority records. Both the
 * indexer (which files automatic proposals) and the API (which grants and
 * revokes delegations) write to it, and both must agree on when writing is
 * possible. This module is that agreement.
 *
 * @packageDocumentation
 */

import type { DID } from '../../types/atproto.js';

/**
 * Credentials for the governance account.
 *
 * @public
 */
export interface GovernancePDSCredentials {
  /** Base URL of the PDS hosting the governance account */
  pdsUrl: string;
  /** DID of the governance repository */
  graphPdsDid: DID;
  /** Handle of the governance account */
  handle: string;
  /** App password for that account */
  password: string;
}

/** Default PDS for the governance account. */
const DEFAULT_PDS_URL = 'https://governance.chive.pub';

/** Default DID of the governance repository. */
const DEFAULT_GRAPH_PDS_DID = 'did:plc:5wzpn4a4nbqtz3q45hyud6hd';

/** Default handle of the governance account. */
const DEFAULT_HANDLE = 'chive-governance.governance.chive.pub';

/**
 * Read the governance PDS credentials from the environment.
 *
 * @returns The credentials, or null when the account password is unset
 *
 * @remarks
 * Only the password has no default, and it is the one value that decides
 * whether writing is possible: the URL, DID and handle all name the same
 * account in every deployment, and `scripts/db/seed-governance-pds.ts` already
 * treats them that way.
 *
 * This previously gated on `GRAPH_PDS_SIGNING_KEY`, which no configuration set
 * and which the writer never used — it built an unauthenticated agent and
 * ignored the key. Governance PDS writing was therefore dead everywhere, and
 * `grantDelegation` and `revokeDelegation` answered 503 permanently.
 *
 * @public
 */
export function readGovernancePDSCredentials(
  env: NodeJS.ProcessEnv = process.env
): GovernancePDSCredentials | null {
  const password = env.GRAPH_PDS_PASSWORD;
  if (!password) {
    return null;
  }

  return {
    pdsUrl: env.GRAPH_PDS_URL ?? DEFAULT_PDS_URL,
    graphPdsDid: (env.GRAPH_PDS_DID ?? DEFAULT_GRAPH_PDS_DID) as DID,
    handle: env.GRAPH_PDS_HANDLE ?? DEFAULT_HANDLE,
    password,
  };
}
