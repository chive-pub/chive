/**
 * Graph PDS configuration.
 *
 * @remarks
 * Single source of truth for the Chive Graph PDS DID.
 * All code that references the graph PDS DID should import from this module.
 *
 * The graph PDS is the community-controlled Personal Data Server where approved
 * knowledge graph nodes, edges, and other graph data are stored.
 *
 * @packageDocumentation
 */

import { isPlcDid } from '../types/atproto-validators.js';
import type { DID } from '../types/atproto.js';

/**
 * The Chive Graph PDS DID.
 *
 * @remarks
 * This is the official DID for the Chive graph PDS where community-approved
 * knowledge graph records are stored.
 *
 * Can be overridden via the `GRAPH_PDS_DID` environment variable.
 *
 * Environment variable: `GRAPH_PDS_DID`
 * Default: `did:plc:5wzpn4a4nbqtz3q45hyud6hd`
 *
 * @public
 */
/**
 * PLC identity of the Chive governance PDS used when none is configured.
 *
 * @public
 */
export const DEFAULT_GRAPH_PDS_DID = 'did:plc:5wzpn4a4nbqtz3q45hyud6hd' as DID;

export const GRAPH_PDS_DID: DID = ((): DID => {
  // A deploy step that interpolates an undefined repository variable yields an
  // empty string, which nullish coalescing would accept as a real value.
  const configured = process.env.GRAPH_PDS_DID?.trim();
  if (!configured) {
    return DEFAULT_GRAPH_PDS_DID;
  }

  // Every environment file shipped `did:plc:chive-governance`, which is not a
  // PLC identifier — they are 24 base32-sortable characters — so it overrode
  // the correct default with a DID that resolves to nothing, and the governance
  // sync imported an empty graph for as long as it was set. Nothing rejected
  // it, because nothing checked. Refuse the value rather than carry it: a
  // governance DID that cannot resolve is not a degraded mode, it is silence.
  if (!isPlcDid(configured)) {
    throw new Error(
      `GRAPH_PDS_DID is not a valid PLC DID: ${configured}. ` +
        'Expected did:plc: followed by 24 base32-sortable characters ' +
        `(for example ${DEFAULT_GRAPH_PDS_DID}).`
    );
  }

  return configured as DID;
})();

/**
 * Returns the graph PDS DID.
 *
 * @remarks
 * Use this function when you need the graph PDS DID in contexts
 * where the module-level constant might not be initialized yet.
 *
 * @returns The graph PDS DID
 *
 * @public
 */
export function getGraphPdsDid(): DID {
  return GRAPH_PDS_DID;
}
