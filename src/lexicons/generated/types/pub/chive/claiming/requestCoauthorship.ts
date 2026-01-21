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

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
  headers?: { [key: string]: string };
}

export interface HandlerError {
  status: number;
  message?: string;
  error?: 'AuthenticationRequired' | 'NotFound' | 'InvalidRequest';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

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
