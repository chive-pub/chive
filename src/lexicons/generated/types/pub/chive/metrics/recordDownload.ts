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
const id = 'pub.chive.metrics.recordDownload';

export type QueryParams = {};

export interface InputSchema {
  /** AT-URI of the eprint being downloaded */
  uri: string;
  /** DID of the downloader (optional for anonymous downloads) */
  viewerDid?: string;
}

export interface OutputSchema {
  /** Whether the download was recorded */
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
  error?: 'InvalidRequest' | 'NotFound';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
