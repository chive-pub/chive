// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveGraphNodeProposal from './nodeProposal.js';
import type * as PubChiveGraphEdge from './edge.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.graph.edgeProposal';

export interface Main {
  $type: 'pub.chive.graph.edgeProposal';
  /** Type of proposal action */
  proposalType: 'create' | 'update' | 'deprecate' | (string & {});
  /** AT-URI of edge to update/deprecate */
  targetEdgeUri?: string;
  proposedEdge?: ProposedEdgeData;
  /** Justification for the proposal */
  rationale: string;
  /** Supporting evidence for the proposal */
  evidence?: PubChiveGraphNodeProposal.Evidence[];
  createdAt: string;
  [k: string]: unknown;
}

const hashMain = 'main';

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain);
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true);
}

export { type Main as Record, isMain as isRecord, validateMain as validateRecord };

/** Proposed edge data */
export interface ProposedEdgeData {
  $type?: 'pub.chive.graph.edgeProposal#proposedEdgeData';
  /** AT-URI of source node */
  sourceUri: string;
  /** AT-URI of target node */
  targetUri: string;
  /** AT-URI of relation type node */
  relationUri?: string;
  /** Relation slug (broader, narrower, related, etc.) */
  relationSlug: string;
  /** Edge weight (scaled by 1000 for 0.0-1.0 range) */
  weight?: number;
  metadata?: PubChiveGraphEdge.EdgeMetadata;
}

const hashProposedEdgeData = 'proposedEdgeData';

export function isProposedEdgeData<V>(v: V) {
  return is$typed(v, id, hashProposedEdgeData);
}

export function validateProposedEdgeData<V>(v: V) {
  return validate<ProposedEdgeData & V>(v, id, hashProposedEdgeData);
}
