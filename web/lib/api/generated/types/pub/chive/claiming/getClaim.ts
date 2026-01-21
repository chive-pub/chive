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
const id = 'pub.chive.claiming.getClaim';

export type QueryParams = {
  /** ID of the claim request */
  claimId: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  claim?: ClaimRequest;
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

export class AuthenticationRequiredError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
  }

  return e;
}

/** A claim request for an imported eprint */
export interface ClaimRequest {
  $type?: 'pub.chive.claiming.getClaim#claimRequest';
  /** Unique claim request ID */
  id: number;
  /** ID of the imported eprint being claimed */
  importId: number;
  /** DID of the user making the claim */
  claimantDid: string;
  /** Current status of the claim */
  status: 'pending' | 'approved' | 'rejected' | 'expired' | (string & {});
  /** AT-URI of the canonical record once created */
  canonicalUri?: string;
  /** Reason for rejection if rejected */
  rejectionReason?: string;
  /** DID of the admin who reviewed the claim */
  reviewedBy?: string;
  /** When the claim was reviewed */
  reviewedAt?: string;
  /** When the claim was created */
  createdAt: string;
  /** When the claim expires if not completed */
  expiresAt?: string;
}

const hashClaimRequest = 'claimRequest';

export function isClaimRequest<V>(v: V) {
  return is$typed(v, id, hashClaimRequest);
}

export function validateClaimRequest<V>(v: V) {
  return validate<ClaimRequest & V>(v, id, hashClaimRequest);
}
