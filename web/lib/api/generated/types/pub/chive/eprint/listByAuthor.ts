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
const id = 'pub.chive.eprint.listByAuthor';

export type QueryParams = {
  /** Author DID */
  did: string;
  limit?: number;
  cursor?: string;
  sortBy?: 'indexedAt' | 'publishedAt' | 'updatedAt' | (string & {});
  sortOrder?: 'asc' | 'desc' | (string & {});
};
export type InputSchema = undefined;

export interface OutputSchema {
  eprints: EprintSummary[];
  cursor?: string;
  total?: number;
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

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'NotFound') return new NotFoundError(e);
  }

  return e;
}

export interface EprintSummary {
  $type?: 'pub.chive.eprint.listByAuthor#eprintSummary';
  uri: string;
  cid?: string;
  title: string;
  authors?: AuthorRef[];
  abstract?: string;
  fields?: string[];
  indexedAt: string;
  publishedAt?: string;
}

const hashEprintSummary = 'eprintSummary';

export function isEprintSummary<V>(v: V) {
  return is$typed(v, id, hashEprintSummary);
}

export function validateEprintSummary<V>(v: V) {
  return validate<EprintSummary & V>(v, id, hashEprintSummary);
}

export interface AuthorRef {
  $type?: 'pub.chive.eprint.listByAuthor#authorRef';
  did: string;
  handle?: string;
  displayName?: string;
}

const hashAuthorRef = 'authorRef';

export function isAuthorRef<V>(v: V) {
  return is$typed(v, id, hashAuthorRef);
}

export function validateAuthorRef<V>(v: V) {
  return validate<AuthorRef & V>(v, id, hashAuthorRef);
}
