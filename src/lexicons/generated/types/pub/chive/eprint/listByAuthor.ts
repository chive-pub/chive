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
const id = 'pub.chive.eprint.listByAuthor';

export type QueryParams = {
  /** Author DID */
  did: string;
  limit: number;
  cursor?: string;
  sortBy: 'indexedAt' | 'publishedAt' | 'updatedAt' | (string & {});
  sortOrder: 'asc' | 'desc' | (string & {});
};
export type InputSchema = undefined;

export interface OutputSchema {
  eprints: EprintSummary[];
  cursor?: string;
  total?: number;
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
