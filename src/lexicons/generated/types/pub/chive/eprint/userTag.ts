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
const id = 'pub.chive.eprint.userTag';

export interface Main {
  $type: 'pub.chive.eprint.userTag';
  /** AT-URI of the tagged eprint */
  eprintUri: string;
  /** Tag label (user-provided text) */
  tag: string;
  /** Optional AT-URI to linked knowledge graph node (subkind=topic, concept, field, etc.) */
  nodeUri?: string;
  /** Node slug for display fallback when nodeUri is present */
  nodeSlug?: string;
  /** Subkind of the linked node for styling (e.g., 'topic', 'concept', 'field') */
  nodeSubkind?: string;
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
