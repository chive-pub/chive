/**
 * XRPC graph handler exports.
 *
 * @remarks
 * Unified knowledge graph API endpoints using node/edge model.
 *
 * @packageDocumentation
 * @public
 */

// Node handlers
export { getNodeHandler, getNodeEndpoint } from './getNode.js';
export { listNodesHandler, listNodesEndpoint } from './listNodes.js';
export { searchNodesHandler, searchNodesEndpoint } from './searchNodes.js';
export { getSubkindsHandler, getSubkindsEndpoint } from './getSubkinds.js';
export { getHierarchyHandler, getHierarchyEndpoint } from './getHierarchy.js';

// Edge handlers
export { getEdgeHandler, getEdgeEndpoint } from './getEdge.js';
export { listEdgesHandler, listEdgesEndpoint } from './listEdges.js';
export { getRelationsHandler, getRelationsEndpoint } from './getRelations.js';

// Faceted browsing (still uses PMEST/FAST but queries via unified nodes)
export { browseFacetedHandler, browseFacetedEndpoint } from './browseFaceted.js';

// Community detection
export { getCommunitiesHandler, getCommunitiesEndpoint } from './getCommunities.js';

/**
 * All graph XRPC endpoints.
 */
import { browseFacetedEndpoint } from './browseFaceted.js';
import { getCommunitiesEndpoint } from './getCommunities.js';
import { getEdgeEndpoint } from './getEdge.js';
import { getHierarchyEndpoint } from './getHierarchy.js';
import { getNodeEndpoint } from './getNode.js';
import { getRelationsEndpoint } from './getRelations.js';
import { getSubkindsEndpoint } from './getSubkinds.js';
import { listEdgesEndpoint } from './listEdges.js';
import { listNodesEndpoint } from './listNodes.js';
import { searchNodesEndpoint } from './searchNodes.js';

export const graphEndpoints = [
  // Node endpoints
  getNodeEndpoint,
  listNodesEndpoint,
  searchNodesEndpoint,
  getSubkindsEndpoint,
  getHierarchyEndpoint,
  // Edge endpoints
  getEdgeEndpoint,
  listEdgesEndpoint,
  getRelationsEndpoint,
  // Faceted browsing
  browseFacetedEndpoint,
  // Graph algorithms
  getCommunitiesEndpoint,
] as const;
