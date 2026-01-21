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
const id = 'pub.chive.sync.refreshRecord';

export type QueryParams = {};

export interface InputSchema {
  /** AT-URI of the record to refresh */
  uri: string;
}

export interface OutputSchema {
  uri: string;
  /** Whether refresh succeeded */
  refreshed: boolean;
  /** New CID after refresh */
  newCid?: string;
  /** Error message if refresh failed */
  error?: string;
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
  error?: 'NotFound' | 'AuthenticationRequired';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
