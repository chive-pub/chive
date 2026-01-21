// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveGraphNode from './node.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.graph.nodeProposal';

export interface Main {
  $type: 'pub.chive.graph.nodeProposal';
  /** Type of proposal action */
  proposalType: 'create' | 'update' | 'merge' | 'deprecate' | (string & {});
  /** Node kind being proposed */
  kind: 'type' | 'object' | (string & {});
  /** Subkind slug (e.g., 'field', 'institution', 'contribution-type') */
  subkind?: string;
  /** AT-URI of node to update/deprecate/merge */
  targetUri?: string;
  /** AT-URI of node to merge into (for merge action) */
  mergeIntoUri?: string;
  proposedNode?: ProposedNodeData;
  /** Justification for the proposal */
  rationale: string;
  /** Supporting evidence for the proposal */
  evidence?: Evidence[];
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

/** Proposed node data */
export interface ProposedNodeData {
  $type?: 'pub.chive.graph.nodeProposal#proposedNodeData';
  label: string;
  alternateLabels?: string[];
  description?: string;
  externalIds?: PubChiveGraphNode.ExternalId[];
  metadata?: PubChiveGraphNode.NodeMetadata;
}

const hashProposedNodeData = 'proposedNodeData';

export function isProposedNodeData<V>(v: V) {
  return is$typed(v, id, hashProposedNodeData);
}

export function validateProposedNodeData<V>(v: V) {
  return validate<ProposedNodeData & V>(v, id, hashProposedNodeData);
}

/** Supporting evidence for a proposal */
export interface Evidence {
  $type?: 'pub.chive.graph.nodeProposal#evidence';
  /** Evidence type */
  type:
    | 'wikidata'
    | 'lcsh'
    | 'fast'
    | 'ror'
    | 'credit'
    | 'usage'
    | 'citation'
    | 'external'
    | 'other'
    | (string & {});
  /** URI to evidence */
  uri?: string;
  /** Description of the evidence */
  description?: string;
}

const hashEvidence = 'evidence';

export function isEvidence<V>(v: V) {
  return is$typed(v, id, hashEvidence);
}

export function validateEvidence<V>(v: V) {
  return validate<Evidence & V>(v, id, hashEvidence);
}
