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
const id = 'pub.chive.activity.log';

export type QueryParams = {};

export interface InputSchema {
  /** NSID of the record collection */
  collection: string;
  /** Record key (TID) */
  rkey: string;
  /** Action type */
  action: 'create' | 'update' | 'delete' | (string & {});
  /** Semantic activity category */
  category:
    | 'eprint_submit'
    | 'eprint_update'
    | 'eprint_delete'
    | 'review_create'
    | 'review_update'
    | 'review_delete'
    | 'endorsement_create'
    | 'endorsement_delete'
    | 'tag_create'
    | 'tag_delete'
    | 'profile_update'
    | 'proposal_create'
    | 'vote_create'
    | (string & {});
  /** Target record URI (e.g., the eprint being reviewed) */
  targetUri?: string;
  /** Target record title for display */
  targetTitle?: string;
  /** OpenTelemetry trace ID */
  traceId?: string;
  /** OpenTelemetry span ID */
  spanId?: string;
  /** UI context metadata as JSON string */
  uiContext?: string;
  /** Snapshot of record data being written as JSON string */
  recordSnapshot?: string;
}

export interface OutputSchema {
  /** Created activity ID (UUID) */
  activityId: string;
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
