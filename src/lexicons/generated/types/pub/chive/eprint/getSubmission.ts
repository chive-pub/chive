// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveEprintSubmission from './submission.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.eprint.getSubmission';

export type QueryParams = {
  /** Eprint URI */
  uri: string;
  /** Specific version CID */
  cid?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  uri: string;
  cid: string;
  value: PubChiveEprintSubmission.Main;
  indexedAt: string;
  /** Source PDS URL (transparency) */
  pdsUrl: string;
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
  error?: 'NotFound' | 'Stale';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
