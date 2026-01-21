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
const id = 'pub.chive.actor.discoverAuthorIds';

export type QueryParams = {
  /** Author name to search for */
  name?: string;
  /** Maximum number of matches to return */
  limit?: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** The name that was searched */
  searchedName: string;
  matches: AuthorMatch[];
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

/** A potential author match from academic databases */
export interface AuthorMatch {
  $type?: 'pub.chive.actor.discoverAuthorIds#authorMatch';
  /** Display name from the database */
  displayName: string;
  /** Current institutional affiliation */
  institution?: string;
  /** Number of works attributed to this author */
  worksCount: number;
  /** Total citation count */
  citedByCount: number;
  ids: ExternalIds;
}

const hashAuthorMatch = 'authorMatch';

export function isAuthorMatch<V>(v: V) {
  return is$typed(v, id, hashAuthorMatch);
}

export function validateAuthorMatch<V>(v: V) {
  return validate<AuthorMatch & V>(v, id, hashAuthorMatch);
}

/** External author identifiers from various databases */
export interface ExternalIds {
  $type?: 'pub.chive.actor.discoverAuthorIds#externalIds';
  /** OpenAlex author ID (e.g., A5023888391) */
  openalex?: string;
  /** Semantic Scholar author ID */
  semanticScholar?: string;
  /** ORCID identifier */
  orcid?: string;
  /** DBLP author identifier */
  dblp?: string;
}

const hashExternalIds = 'externalIds';

export function isExternalIds<V>(v: V) {
  return is$typed(v, id, hashExternalIds);
}

export function validateExternalIds<V>(v: V) {
  return validate<ExternalIds & V>(v, id, hashExternalIds);
}
