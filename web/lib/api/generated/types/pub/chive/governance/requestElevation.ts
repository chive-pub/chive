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
const id = 'pub.chive.governance.requestElevation';

export type QueryParams = {};

export interface InputSchema {
  /** Role to request elevation to */
  targetRole: 'trusted-editor' | (string & {});
}

export type OutputSchema = ElevationResult;

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

export class AuthenticationRequiredError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export class InvalidRequestError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
    if (e.error === 'InvalidRequest') return new InvalidRequestError(e);
  }

  return e;
}

/** Result of elevation operation */
export interface ElevationResult {
  $type?: 'pub.chive.governance.requestElevation#elevationResult';
  /** Whether the operation succeeded */
  success: boolean;
  /** Elevation request ID (if created) */
  requestId?: string;
  /** Human-readable result message */
  message: string;
}

const hashElevationResult = 'elevationResult';

export function isElevationResult<V>(v: V) {
  return is$typed(v, id, hashElevationResult);
}

export function validateElevationResult<V>(v: V) {
  return validate<ElevationResult & V>(v, id, hashElevationResult);
}
