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
const id = 'pub.chive.governance.grantDelegation';

export type QueryParams = {};

export interface InputSchema {
  /** DID of the user to delegate to */
  delegateDid: string;
  /** NSID collections the delegation covers */
  collections: string[];
  /** Number of days the delegation is valid */
  daysValid: number;
  /** Maximum records delegate can create per day */
  maxRecordsPerDay?: number;
}

export type OutputSchema = DelegationResult;

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

export class UnauthorizedError extends XRPCError {
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
    if (e.error === 'Unauthorized') return new UnauthorizedError(e);
    if (e.error === 'InvalidRequest') return new InvalidRequestError(e);
  }

  return e;
}

/** Result of delegation operation */
export interface DelegationResult {
  $type?: 'pub.chive.governance.grantDelegation#delegationResult';
  /** Whether the operation succeeded */
  success: boolean;
  /** Delegation ID (if created) */
  delegationId?: string;
  /** Human-readable result message */
  message: string;
}

const hashDelegationResult = 'delegationResult';

export function isDelegationResult<V>(v: V) {
  return is$typed(v, id, hashDelegationResult);
}

export function validateDelegationResult<V>(v: V) {
  return validate<DelegationResult & V>(v, id, hashDelegationResult);
}
