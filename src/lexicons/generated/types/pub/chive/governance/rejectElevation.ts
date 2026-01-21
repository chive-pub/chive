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
const id = 'pub.chive.governance.rejectElevation';

export type QueryParams = {};

export interface InputSchema {
  /** ID of the elevation request to reject */
  requestId: string;
  /** Reason for rejection */
  reason: string;
}

export type OutputSchema = ElevationResult;

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
  error?: 'AuthenticationRequired' | 'Unauthorized' | 'NotFound';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** Result of elevation operation */
export interface ElevationResult {
  $type?: 'pub.chive.governance.rejectElevation#elevationResult';
  /** Whether the operation succeeded */
  success: boolean;
  /** Elevation request ID */
  requestId?: string;
  /** Human-readable result message */
  message: string;
}

const hashElevationResult = 'elevationResult';

export function isElevationResult<V>(v: V) {
  return is$typed(v, id, hashElevationResult);
}

export function validateElevationResult<V>(v: V) {
  return validate<ElevationResult & V>(v, id, hashElevationResult);
}
