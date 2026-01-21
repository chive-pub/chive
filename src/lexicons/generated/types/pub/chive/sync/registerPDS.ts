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
const id = 'pub.chive.sync.registerPDS';

export type QueryParams = {};

export interface InputSchema {
  /** PDS endpoint URL to register */
  pdsUrl: string;
}

export interface OutputSchema {
  /** The registered PDS URL */
  pdsUrl: string;
  /** Whether the PDS was registered */
  registered: boolean;
  /** Registration status */
  status: 'pending' | 'already_exists' | 'scanned' | (string & {});
  /** Human-readable status message */
  message?: string;
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
  error?: 'InvalidRequest' | 'ServiceUnavailable';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
