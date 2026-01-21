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
const id = 'pub.chive.alpha.checkStatus';

export type QueryParams = {};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Application status */
  status: 'none' | 'pending' | 'approved' | 'rejected' | (string & {});
  /** Application submission timestamp */
  appliedAt?: string;
  /** Application review timestamp */
  reviewedAt?: string;
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
