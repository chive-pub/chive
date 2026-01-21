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
  maxRecordsPerDay: number;
}

export type OutputSchema = DelegationResult;

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
  error?: 'AuthenticationRequired' | 'Unauthorized' | 'InvalidRequest';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

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
