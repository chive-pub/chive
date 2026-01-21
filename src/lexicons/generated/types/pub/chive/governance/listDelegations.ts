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
const id = 'pub.chive.governance.listDelegations';

export type QueryParams = {
  /** Maximum number of results to return */
  limit: number;
  /** Pagination cursor for next page */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of delegations */
  delegations: Delegation[];
  /** Cursor for next page */
  cursor?: string;
  /** Total number of delegations */
  total: number;
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
  error?: 'AuthenticationRequired' | 'Unauthorized';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** PDS delegation record */
export interface Delegation {
  $type?: 'pub.chive.governance.listDelegations#delegation';
  /** Delegation identifier */
  id: string;
  /** DID of the delegate */
  delegateDid: string;
  /** Delegate handle */
  handle?: string;
  /** Delegate display name */
  displayName?: string;
  /** NSID collections the delegation covers */
  collections: string[];
  /** Expiration timestamp */
  expiresAt: number;
  /** Maximum records delegate can create per day */
  maxRecordsPerDay: number;
  /** Records created today under this delegation */
  recordsCreatedToday: number;
  /** Timestamp when delegation was granted */
  grantedAt: number;
  /** DID of admin who granted the delegation */
  grantedBy: string;
  /** Whether the delegation is currently active */
  active: boolean;
}

const hashDelegation = 'delegation';

export function isDelegation<V>(v: V) {
  return is$typed(v, id, hashDelegation);
}

export function validateDelegation<V>(v: V) {
  return validate<Delegation & V>(v, id, hashDelegation);
}
