// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
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

export interface CallOptions {
  signal?: AbortSignal;
  headers?: HeadersMap;
}

export interface Response {
  success: boolean;
  headers: HeadersMap;
  data: OutputSchema;
}

export class InvalidRequestError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidRequest') return new InvalidRequestError(e);
  }

  return e;
}
