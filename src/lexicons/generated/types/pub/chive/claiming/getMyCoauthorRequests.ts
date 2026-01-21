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
const id = 'pub.chive.claiming.getMyCoauthorRequests';

export type QueryParams = {
  /** Filter by request status */
  status?: 'pending' | 'approved' | 'rejected' | (string & {});
  /** Maximum number of results to return */
  limit: number;
  /** Pagination cursor for next page */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of co-author requests made by the user */
  requests: CoauthorRequest[];
  /** Cursor for next page of results */
  cursor?: string;
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

/** A co-author claim request */
export interface CoauthorRequest {
  $type?: 'pub.chive.claiming.getMyCoauthorRequests#coauthorRequest';
  /** Unique request ID */
  id: number;
  /** AT-URI of the eprint record */
  eprintUri: string;
  /** DID of the eprint owner (PDS owner) */
  eprintOwnerDid: string;
  /** DID of the user requesting co-authorship */
  claimantDid: string;
  /** Display name of the claimant at time of request */
  claimantName: string;
  /** Index of the author entry being claimed (0-based) */
  authorIndex: number;
  /** Name of the author entry being claimed */
  authorName: string;
  /** Current status of the request */
  status: 'pending' | 'approved' | 'rejected' | (string & {});
  /** Optional message from the claimant */
  message?: string;
  /** Reason for rejection if rejected */
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
