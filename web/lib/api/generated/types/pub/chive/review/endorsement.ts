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
const id = 'pub.chive.review.endorsement';

export interface Main {
  $type: 'pub.chive.review.endorsement';
  /** AT-URI of the eprint being endorsed */
  eprintUri: string;
  /** Set of contribution types being endorsed (min 1, no duplicates) */
  contributions: (
    | 'methodological'
    | 'analytical'
    | 'theoretical'
    | 'empirical'
    | 'conceptual'
    | 'technical'
    | 'data'
    | 'replication'
    | 'reproducibility'
    | 'synthesis'
    | 'interdisciplinary'
    | 'pedagogical'
    | 'visualization'
    | 'societal-impact'
    | 'clinical'
    | (string & {})
  )[];
  /** Optional comment explaining the endorsement */
  comment?: string;
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
