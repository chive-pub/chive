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
const id = 'pub.chive.sync.verify';

export type QueryParams = {
  /** AT-URI of the record to verify */
  uri: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** AT-URI of the record */
  uri: string;
  /** Whether the record is indexed */
  indexed: boolean;
  /** Whether the indexed record is in sync with the PDS */
  inSync: boolean;
  /** When the record was indexed */
  indexedAt?: string;
  /** When the record was last synced */
  lastSyncedAt?: string;
  /** Number of days since last sync if stale */
  staleDays?: number;
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
  error?: 'InvalidRequest';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
