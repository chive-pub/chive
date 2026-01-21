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
const id = 'pub.chive.metrics.recordDwellTime';

export type QueryParams = {};

export interface InputSchema {
  /** UUID of the search impression */
  impressionId: string;
  /** AT-URI of the viewed eprint */
  uri: string;
  /** Time spent on the page in milliseconds */
  dwellTimeMs: number;
}

export interface OutputSchema {
  /** Whether the dwell time was recorded */
  success: boolean;
}

export interface CallOptions {
  signal?: AbortSignal;
  headers?: HeadersMap;
  qp?: QueryParams;
  encoding?: 'application/json';
}

export interface Response {
  success: boolean;
  headers: HeadersMap;
  data: OutputSchema;
}

export class InvalidRequestError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidRequest') return new InvalidRequestError(e);
  }

  return e;
}
