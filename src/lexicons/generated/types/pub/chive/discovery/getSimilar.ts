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
const id = 'pub.chive.discovery.getSimilar';

export type QueryParams = {
  /** AT-URI of the eprint */
  uri: string;
  /** Maximum number of similar papers */
  limit: number;
  /** Types of relationships to include. 'co-citation' and 'bibliographic-coupling' use graph analysis. */
  includeTypes?:
    | 'semantic'
    | 'citation'
    | 'topic'
    | 'author'
    | 'co-citation'
    | 'bibliographic-coupling'
    | (string & {})[];
};
export type InputSchema = undefined;

export interface OutputSchema {
  eprint: EprintRef;
  related: RelatedEprint[];
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
  $type?: 'pub.chive.discovery.getSimilar#eprintRef';
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

export interface RelatedEprint {
  $type?: 'pub.chive.discovery.getSimilar#relatedEprint';
  uri: string;
  title: string;
  abstract?: string;
  authors?: Author[];
  categories?: string[];
  publicationDate?: string;
  /** Similarity score (scaled by 1000 for 0.0-1.0 range) */
  score: number;
  /** Type of relationship to the source eprint */
  relationshipType:
    | 'cites'
    | 'cited-by'
    | 'co-cited'
    | 'semantically-similar'
    | 'same-author'
    | 'same-topic'
    | 'bibliographic-coupling'
    | (string & {});
  /** Human-readable explanation of the relationship */
  explanation: string;
  /** Number of shared references (for bibliographic coupling) */
  sharedReferences?: number;
  /** Number of papers that cite both (for co-citation) */
  sharedCiters?: number;
}

const hashRelatedEprint = 'relatedEprint';

export function isRelatedEprint<V>(v: V) {
  return is$typed(v, id, hashRelatedEprint);
}

export function validateRelatedEprint<V>(v: V) {
  return validate<RelatedEprint & V>(v, id, hashRelatedEprint);
}

export interface Author {
  $type?: 'pub.chive.discovery.getSimilar#author';
  name: string;
}

const hashAuthor = 'author';

export function isAuthor<V>(v: V) {
  return is$typed(v, id, hashAuthor);
}

export function validateAuthor<V>(v: V) {
  return validate<Author & V>(v, id, hashAuthor);
}
