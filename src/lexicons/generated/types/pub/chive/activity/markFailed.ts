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
const id = 'pub.chive.activity.markFailed';

export type QueryParams = {};

export interface InputSchema {
  /** NSID of the record collection */
  collection: string;
  /** Record key (TID) */
  rkey: string;
  /** Error code identifying the failure type */
  errorCode: string;
  /** Human-readable error message */
  errorMessage: string;
}

export interface OutputSchema {
  /** Whether the activity was successfully marked as failed */
  success: boolean;
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
  error?: 'AuthenticationRequired' | 'NotFound';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
