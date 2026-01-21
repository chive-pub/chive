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
const id = 'pub.chive.sync.checkStaleness';

export type QueryParams = {
  /** AT-URI of the record to check */
  uri: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  uri: string;
  /** Whether indexed data is stale */
  isStale: boolean;
  /** When the record was indexed */
  indexedAt?: string;
  /** CID in our index */
  indexedCid?: string;
  /** Current CID on PDS */
  pdsCid?: string;
  /** Source PDS URL */
  pdsUrl?: string;
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
  error?: 'NotFound';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
