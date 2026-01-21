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
const id = 'pub.chive.graph.reconciliation';

export interface Main {
  $type: 'pub.chive.graph.reconciliation';
  /** AT-URI of local entity being reconciled */
  sourceUri: string;
  /** External authority system */
  targetSystem:
    | 'wikidata'
    | 'lcsh'
    | 'fast'
    | 'ror'
    | 'orcid'
    | 'viaf'
    | 'gnd'
    | 'mesh'
    | 'aat'
    | 'getty'
    | (string & {});
  /** Identifier in the external system */
  targetId: string;
  /** Match confidence score (scaled by 1000 for 0.0-1.0 range) */
  confidence: number;
  /** Type of semantic match (SKOS mapping) */
  matchType?: 'exact' | 'close' | 'broad' | 'narrow' | 'related' | (string & {});
  /** Reconciliation status */
  status: 'proposed' | 'verified' | 'rejected' | (string & {});
  /** DID of user who verified the match */
  verifiedBy?: string;
  /** Notes about the reconciliation */
  notes?: string;
  createdAt: string;
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
