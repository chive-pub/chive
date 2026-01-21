/**
 * XRPC graph handler exports.
 *
 * @remarks
 * Unified knowledge graph API endpoints using node/edge model.
 *
 * @packageDocumentation
 * @public
 */

import { browseFaceted } from './browseFaceted.js';
import { getCommunities } from './getCommunities.js';
import { getEdge } from './getEdge.js';
import { getHierarchy } from './getHierarchy.js';
import { getNode } from './getNode.js';
import { getRelations } from './getRelations.js';
import { getSubkinds } from './getSubkinds.js';
import { listEdges } from './listEdges.js';
import { listNodes } from './listNodes.js';
import { searchNodes } from './searchNodes.js';

// Re-export individual methods
export { browseFaceted } from './browseFaceted.js';
export { getCommunities } from './getCommunities.js';
export { getEdge } from './getEdge.js';
export { getHierarchy } from './getHierarchy.js';
export { getNode } from './getNode.js';
export { getRelations } from './getRelations.js';
export { getSubkinds } from './getSubkinds.js';
export { listEdges } from './listEdges.js';
export { listNodes } from './listNodes.js';
export { searchNodes } from './searchNodes.js';

/**
 * All graph XRPC methods keyed by NSID.
 */
export const graphMethods = {
  'pub.chive.graph.getNode': getNode,
  'pub.chive.graph.listNodes': listNodes,
  'pub.chive.graph.searchNodes': searchNodes,
  'pub.chive.graph.getSubkinds': getSubkinds,
  'pub.chive.graph.getHierarchy': getHierarchy,
  'pub.chive.graph.getEdge': getEdge,
  'pub.chive.graph.listEdges': listEdges,
  'pub.chive.graph.getRelations': getRelations,
  'pub.chive.graph.browseFaceted': browseFaceted,
  'pub.chive.graph.getCommunities': getCommunities,
} as const;
