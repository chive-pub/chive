// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.graph.edge';

export interface Main {
  $type: 'pub.chive.graph.edge';
  /** UUID identifier (also used as rkey) */
  id: string;
  /** AT-URI of source node */
  sourceUri: string;
  /** AT-URI of target node */
  targetUri: string;
  /** AT-URI of relation type node (subkind=relation) */
  relationUri?: string;
  /** Relation slug for queries (broader, narrower, related, etc.) */
  relationSlug: string;
  /** Optional edge weight for ranking (scaled by 1000 for 0.0-1.0 range) */
  weight?: number;
  metadata?: EdgeMetadata;
  /** Edge lifecycle status */
  status: 'proposed' | 'established' | 'deprecated' | (string & {});
  /** AT-URI of the proposal that created this edge (null for seeded) */
  proposalUri?: string;
  createdAt: string;
  /** DID of creator or governance */
  createdBy?: string;
  updatedAt?: string;
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

/** Edge-specific metadata */
export interface EdgeMetadata {
  $type?: 'pub.chive.graph.edge#edgeMetadata';
  /** Confidence score for automatically inferred edges (scaled by 1000 for 0.0-1.0 range) */
  confidence?: number;
  /** Temporal start (for time-bounded relationships) */
  startDate?: string;
  /** Temporal end (for time-bounded relationships) */
  endDate?: string;
  /** Source of the relationship assertion */
  source?: string;
}

const hashEdgeMetadata = 'edgeMetadata';

export function isEdgeMetadata<V>(v: V) {
  return is$typed(v, id, hashEdgeMetadata);
}

export function validateEdgeMetadata<V>(v: V) {
  return validate<EdgeMetadata & V>(v, id, hashEdgeMetadata);
}
