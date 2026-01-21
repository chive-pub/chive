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
const id = 'pub.chive.author.searchAuthors';

export type QueryParams = {
  /** Search query */
  q: string;
  /** Maximum results to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  authors: AuthorSearchResult[];
  /** Cursor for next page */
  cursor?: string;
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

export function toKnownErr(e: any) {
  return e;
}

export interface AuthorSearchResult {
  $type?: 'pub.chive.author.searchAuthors#authorSearchResult';
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
  affiliation?: string;
  eprintCount?: number;
}

const hashAuthorSearchResult = 'authorSearchResult';

export function isAuthorSearchResult<V>(v: V) {
  return is$typed(v, id, hashAuthorSearchResult);
}

export function validateAuthorSearchResult<V>(v: V) {
  return validate<AuthorSearchResult & V>(v, id, hashAuthorSearchResult);
}
