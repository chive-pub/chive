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
const id = 'pub.chive.claiming.getPendingClaims';

export type QueryParams = {
  /** Minimum match score filter (0-100) */
  minScore?: number;
  /** Maximum match score filter (0-100) */
  maxScore?: number;
  /** Maximum number of claims to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  claims: ClaimRequest[];
  /** Pagination cursor for next page */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
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
  error?: 'AuthenticationRequired' | 'Forbidden';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

export interface ClaimRequest {
  $type?: 'pub.chive.claiming.getPendingClaims#claimRequest';
  /** Claim request ID */
  id: number;
  /** ID of the imported eprint */
  importId: number;
  /** DID of the claimant */
  claimantDid: string;
  /** Claim status */
  status: 'pending' | 'approved' | 'rejected' | 'expired' | (string & {});
  /** AT-URI of the canonical record in user PDS */
  canonicalUri?: string;
  /** Reason for rejection if rejected */
  rejectionReason?: string;
  /** DID of the admin who reviewed */
  reviewedBy?: string;
  /** When the claim was reviewed */
  reviewedAt?: string;
  /** When the claim was created */
  createdAt: string;
  /** When the claim expires */
  expiresAt?: string;
}

const hashClaimRequest = 'claimRequest';

export function isClaimRequest<V>(v: V) {
  return is$typed(v, id, hashClaimRequest);
}

export function validateClaimRequest<V>(v: V) {
  return validate<ClaimRequest & V>(v, id, hashClaimRequest);
}
