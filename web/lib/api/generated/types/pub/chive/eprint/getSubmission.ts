// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
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

export interface CallOptions {
  signal?: AbortSignal;
  headers?: HeadersMap;
}

export interface Response {
  success: boolean;
  headers: HeadersMap;
  data: OutputSchema;
}

export class NotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export class StaleError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'NotFound') return new NotFoundError(e);
    if (e.error === 'Stale') return new StaleError(e);
  }

  return e;
}
