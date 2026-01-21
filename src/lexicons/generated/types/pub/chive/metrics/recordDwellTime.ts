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
const id = 'pub.chive.metrics.recordDwellTime';

export type QueryParams = {};

export interface InputSchema {
  /** UUID of the search impression */
  impressionId: string;
  /** AT-URI of the viewed eprint */
  uri: string;
  /** Time spent on the page in milliseconds */
  dwellTimeMs: number;
}

export interface OutputSchema {
  /** Whether the dwell time was recorded */
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
  error?: 'InvalidRequest';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
