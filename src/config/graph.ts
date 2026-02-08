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
export const GRAPH_PDS_DID: DID =
  (process.env.GRAPH_PDS_DID as DID | undefined) ?? ('did:plc:5wzpn4a4nbqtz3q45hyud6hd' as DID);

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
