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
const id = 'pub.chive.actor.discoverAuthorIds';

export type QueryParams = {
  /** Author name to search for */
  name?: string;
  /** Maximum number of matches to return */
  limit: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** The name that was searched */
  searchedName: string;
  matches: AuthorMatch[];
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
  error?: 'AuthenticationRequired';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

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
