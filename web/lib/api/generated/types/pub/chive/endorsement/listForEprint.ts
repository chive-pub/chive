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
const id = 'pub.chive.endorsement.listForEprint';

export type QueryParams = {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** Filter by contribution type */
  contributionType?:
    | 'methodological'
    | 'analytical'
    | 'theoretical'
    | 'empirical'
    | 'conceptual'
    | 'technical'
    | 'data'
    | 'replication'
    | 'reproducibility'
    | 'synthesis'
    | 'interdisciplinary'
    | 'pedagogical'
    | 'visualization'
    | 'societal-impact'
    | 'clinical'
    | (string & {});
  /** Maximum number of results to return */
  limit?: number;
  /** Pagination cursor for next page */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of endorsements */
  endorsements: EndorsementView[];
  summary?: EndorsementSummary;
  /** Cursor for next page */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
  /** Total number of endorsements */
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

export function toKnownErr(e: any) {
  return e;
}

/** View of an endorsement */
export interface EndorsementView {
  $type?: 'pub.chive.endorsement.listForEprint#endorsementView';
  /** Endorsement AT-URI */
  uri: string;
  /** Content identifier */
  cid: string;
  /** Endorsed eprint AT-URI */
  eprintUri: string;
  endorser: AuthorRef;
  /** Contribution types being endorsed */
  contributions: (
    | 'methodological'
    | 'analytical'
    | 'theoretical'
    | 'empirical'
    | 'conceptual'
    | 'technical'
    | 'data'
    | 'replication'
    | 'reproducibility'
    | 'synthesis'
    | 'interdisciplinary'
    | 'pedagogical'
    | 'visualization'
    | 'societal-impact'
    | 'clinical'
    | (string & {})
  )[];
  /** Optional comment */
  comment?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt?: string;
}

const hashEndorsementView = 'endorsementView';

export function isEndorsementView<V>(v: V) {
  return is$typed(v, id, hashEndorsementView);
}

export function validateEndorsementView<V>(v: V) {
  return validate<EndorsementView & V>(v, id, hashEndorsementView);
}

export interface AuthorRef {
  $type?: 'pub.chive.endorsement.listForEprint#authorRef';
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

const hashAuthorRef = 'authorRef';

export function isAuthorRef<V>(v: V) {
  return is$typed(v, id, hashAuthorRef);
}

export function validateAuthorRef<V>(v: V) {
  return validate<AuthorRef & V>(v, id, hashAuthorRef);
}

export interface EndorsementSummary {
  $type?: 'pub.chive.endorsement.listForEprint#endorsementSummary';
  /** Total endorsement count */
  total: number;
  /** Unique endorser count */
  endorserCount: number;
  byType: EndorsementCountByType;
}

const hashEndorsementSummary = 'endorsementSummary';

export function isEndorsementSummary<V>(v: V) {
  return is$typed(v, id, hashEndorsementSummary);
}

export function validateEndorsementSummary<V>(v: V) {
  return validate<EndorsementSummary & V>(v, id, hashEndorsementSummary);
}

/** Map of contribution type slug to endorsement count */
export interface EndorsementCountByType {
  $type?: 'pub.chive.endorsement.listForEprint#endorsementCountByType';
}

const hashEndorsementCountByType = 'endorsementCountByType';

export function isEndorsementCountByType<V>(v: V) {
  return is$typed(v, id, hashEndorsementCountByType);
}

export function validateEndorsementCountByType<V>(v: V) {
  return validate<EndorsementCountByType & V>(v, id, hashEndorsementCountByType);
}
