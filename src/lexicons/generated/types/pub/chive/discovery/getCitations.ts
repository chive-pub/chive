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
const id = 'pub.chive.discovery.getCitations';

export type QueryParams = {
  /** AT-URI of the eprint */
  uri: string;
  /** Citation direction: citing (papers this cites), cited-by (papers citing this), or both */
  direction: 'citing' | 'cited-by' | 'both' | (string & {});
  /** Maximum number of citations to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
  /** Only return influential citations */
  onlyInfluential: boolean;
};
export type InputSchema = undefined;

export interface OutputSchema {
  eprint: EprintRef;
  counts: CitationCounts;
  citations: Citation[];
  /** Pagination cursor for next page */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
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
  error?: 'NotFound' | 'ServiceUnavailable';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

export interface EprintRef {
  $type?: 'pub.chive.discovery.getCitations#eprintRef';
  uri: string;
  title: string;
}

const hashEprintRef = 'eprintRef';

export function isEprintRef<V>(v: V) {
  return is$typed(v, id, hashEprintRef);
}

export function validateEprintRef<V>(v: V) {
  return validate<EprintRef & V>(v, id, hashEprintRef);
}

export interface CitationCounts {
  $type?: 'pub.chive.discovery.getCitations#citationCounts';
  /** Number of papers citing this eprint */
  citedByCount: number;
  /** Number of papers this eprint references */
  referencesCount: number;
  /** Number of influential citations */
  influentialCitedByCount: number;
}

const hashCitationCounts = 'citationCounts';

export function isCitationCounts<V>(v: V) {
  return is$typed(v, id, hashCitationCounts);
}

export function validateCitationCounts<V>(v: V) {
  return validate<CitationCounts & V>(v, id, hashCitationCounts);
}

export interface Citation {
  $type?: 'pub.chive.discovery.getCitations#citation';
  /** AT-URI of the citing paper */
  citingUri: string;
  /** AT-URI of the cited paper */
  citedUri: string;
  /** Whether this is an influential citation */
  isInfluential?: boolean;
  /** Source of citation data (e.g., semantic-scholar, openalex) */
  source: string;
  /** When this citation was discovered */
  discoveredAt?: string;
}

const hashCitation = 'citation';

export function isCitation<V>(v: V) {
  return is$typed(v, id, hashCitation);
}

export function validateCitation<V>(v: V) {
  return validate<Citation & V>(v, id, hashCitation);
}
