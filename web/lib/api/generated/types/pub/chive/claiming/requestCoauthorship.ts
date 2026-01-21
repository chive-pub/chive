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
const id = 'pub.chive.claiming.requestCoauthorship';

export type QueryParams = {};

export interface InputSchema {
  /** AT-URI of the eprint record */
  eprintUri: string;
  /** DID of the PDS owner */
  eprintOwnerDid: string;
  /** Display name for the request */
  claimantName: string;
  /** Index of the author entry being claimed (0-based) */
  authorIndex: number;
  /** Name of the author entry being claimed */
  authorName: string;
  /** Optional message to PDS owner */
  message?: string;
}

export interface OutputSchema {
  request: CoauthorRequest;
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

export class AuthenticationRequiredError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export class NotFoundError extends XRPCError {
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
    if (e.error === 'NotFound') return new NotFoundError(e);
    if (e.error === 'InvalidRequest') return new InvalidRequestError(e);
  }

  return e;
}

export interface CoauthorRequest {
  $type?: 'pub.chive.claiming.requestCoauthorship#coauthorRequest';
  /** Request ID */
  id: number;
  /** AT-URI of the eprint record */
  eprintUri: string;
  /** DID of the PDS owner */
  eprintOwnerDid: string;
  /** DID of the claimant */
  claimantDid: string;
  /** Display name at time of request */
  claimantName: string;
  /** Index of the author entry being claimed (0-based) */
  authorIndex: number;
  /** Name of the author entry being claimed */
  authorName: string;
  /** Request status */
  status: 'pending' | 'approved' | 'rejected' | (string & {});
  /** Message from claimant */
  message?: string;
  /** Rejection reason if rejected */
  rejectionReason?: string;
  /** When the request was created */
  createdAt: string;
  /** When the request was reviewed */
  reviewedAt?: string;
}

const hashCoauthorRequest = 'coauthorRequest';

export function isCoauthorRequest<V>(v: V) {
  return is$typed(v, id, hashCoauthorRequest);
}

export function validateCoauthorRequest<V>(v: V) {
  return validate<CoauthorRequest & V>(v, id, hashCoauthorRequest);
}
