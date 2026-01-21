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
const id = 'pub.chive.claiming.getClaim';

export type QueryParams = {
  /** ID of the claim request */
  claimId: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  claim?: ClaimRequest;
}

export type HandlerInput = void;

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
  headers?: { [key: string]: string };
}

export interface HandlerError {
  status: number;
  message?: string;
  error?: 'AuthenticationRequired';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

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
