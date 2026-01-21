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
const id = 'pub.chive.discovery.recordInteraction';

export type QueryParams = {};

export interface InputSchema {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** Type of interaction: view (viewed detail page), click (clicked recommendation), endorse (endorsed paper), dismiss (dismissed recommendation), claim (claimed authorship) */
  type: 'view' | 'click' | 'endorse' | 'dismiss' | 'claim' | (string & {});
  /** ID of the recommendation that led to this interaction */
  recommendationId?: string;
}

export interface OutputSchema {
  /** Whether the interaction was successfully recorded */
  recorded: boolean;
}

export interface CallOptions {
  signal?: AbortSignal;
  headers?: HeadersMap;
  qp?: QueryParams;
  encoding?: 'application/json';
}

export interface Response {
  success: boolean;
  headers: HeadersMap;
  data: OutputSchema;
}

export class AuthenticationRequiredError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
  }

  return e;
}
