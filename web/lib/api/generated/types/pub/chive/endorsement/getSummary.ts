// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.endorsement.getSummary';

export type QueryParams = {
  /** AT-URI of the eprint */
  eprintUri: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Total endorsement count */
  total: number;
  /** Unique endorser count */
  endorserCount: number;
  byType: EndorsementCountByType;
}

export interface CallOptions {
  signal?: AbortSignal;
  headers?: HeadersMap;
}

export interface Response {
  success: boolean;
  headers: HeadersMap;
  data: OutputSchema;
}

export function toKnownErr(e: any) {
  return e;
}

/** Map of contribution type slug to endorsement count */
export interface EndorsementCountByType {
  $type?: 'pub.chive.endorsement.getSummary#endorsementCountByType';
}

const hashEndorsementCountByType = 'endorsementCountByType';

export function isEndorsementCountByType<V>(v: V) {
  return is$typed(v, id, hashEndorsementCountByType);
}

export function validateEndorsementCountByType<V>(v: V) {
  return validate<EndorsementCountByType & V>(v, id, hashEndorsementCountByType);
}
