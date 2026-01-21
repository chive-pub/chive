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
const id = 'pub.chive.metrics.getTrending';

export type QueryParams = {
  /** Time window for trending calculation */
  window: '24h' | '7d' | '30d';
  /** Maximum number of results to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  trending: TrendingEntry[];
  /** Time window used */
  window: '24h' | '7d' | '30d';
  /** Cursor for next page */
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
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** A trending eprint entry with full metadata */
export interface TrendingEntry {
  $type?: 'pub.chive.metrics.getTrending#trendingEntry';
  /** AT-URI of the eprint */
  uri: string;
  /** CID of the eprint record */
  cid: string;
  /** Eprint title */
  title: string;
  /** Truncated abstract (max 500 chars) */
  abstract: string;
  authors: AuthorRef[];
  /** DID of the submitter */
  submittedBy: string;
  /** DID of the paper identity (if using paper-centric model) */
  paperDid?: string;
  /** Knowledge graph field classifications */
  fields?: FieldRef[];
  /** License identifier */
  license: string;
  /** Original creation timestamp */
  createdAt: string;
  /** When Chive indexed this record */
  indexedAt: string;
  source: SourceInfo;
  metrics?: EprintMetrics;
  /** Views within the trending window */
  viewsInWindow: number;
  /** Position in trending list */
  rank: number;
  /** Rate of view increase (optional) */
  velocity?: number;
}

const hashTrendingEntry = 'trendingEntry';

export function isTrendingEntry<V>(v: V) {
  return is$typed(v, id, hashTrendingEntry);
}

export function validateTrendingEntry<V>(v: V) {
  return validate<TrendingEntry & V>(v, id, hashTrendingEntry);
}

/** Reference to an author with optional ATProto identity */
export interface AuthorRef {
  $type?: 'pub.chive.metrics.getTrending#authorRef';
  /** Author DID (if linked to ATProto identity) */
  did?: string;
  /** Display name */
  name: string;
  /** ORCID identifier */
  orcid?: string;
  /** Contact email */
  email?: string;
  /** Author order position */
  order: number;
  affiliations: Affiliation[];
  contributions: Contribution[];
  /** Whether this is the corresponding author */
  isCorrespondingAuthor?: boolean;
  /** Whether to highlight this author */
  isHighlighted?: boolean;
  /** ATProto handle (if resolved) */
  handle?: string;
  /** Avatar URL (if available) */
  avatarUrl?: string;
}

const hashAuthorRef = 'authorRef';

export function isAuthorRef<V>(v: V) {
  return is$typed(v, id, hashAuthorRef);
}

export function validateAuthorRef<V>(v: V) {
  return validate<AuthorRef & V>(v, id, hashAuthorRef);
}

/** Author affiliation */
export interface Affiliation {
  $type?: 'pub.chive.metrics.getTrending#affiliation';
  /** Institution name */
  name: string;
  /** ROR identifier */
  rorId?: string;
  /** Department name */
  department?: string;
}

const hashAffiliation = 'affiliation';

export function isAffiliation<V>(v: V) {
  return is$typed(v, id, hashAffiliation);
}

export function validateAffiliation<V>(v: V) {
  return validate<Affiliation & V>(v, id, hashAffiliation);
}

/** CRediT contribution role */
export interface Contribution {
  $type?: 'pub.chive.metrics.getTrending#contribution';
  /** AT-URI of the contribution type node */
  typeUri: string;
  /** Contribution type slug */
  typeId: string;
  /** Human-readable contribution label */
  typeLabel: string;
  /** Degree of contribution (lead, supporting, equal) */
  degree?: string;
}

const hashContribution = 'contribution';

export function isContribution<V>(v: V) {
  return is$typed(v, id, hashContribution);
}

export function validateContribution<V>(v: V) {
  return validate<Contribution & V>(v, id, hashContribution);
}

/** Reference to a knowledge graph field node */
export interface FieldRef {
  $type?: 'pub.chive.metrics.getTrending#fieldRef';
  /** Field ID */
  id?: string;
  /** AT-URI of the field node */
  uri: string;
  /** Display label */
  label: string;
  /** Parent field URI */
  parentUri?: string;
}

const hashFieldRef = 'fieldRef';

export function isFieldRef<V>(v: V) {
  return is$typed(v, id, hashFieldRef);
}

export function validateFieldRef<V>(v: V) {
  return validate<FieldRef & V>(v, id, hashFieldRef);
}

/** PDS source information for data transparency */
export interface SourceInfo {
  $type?: 'pub.chive.metrics.getTrending#sourceInfo';
  /** URL of the source PDS */
  pdsEndpoint: string;
  /** Direct URL to fetch the record */
  recordUrl: string;
  /** URL to fetch associated blob */
  blobUrl?: string;
  /** When the record was last verified */
  lastVerifiedAt: string;
  /** Whether the indexed data may be stale */
  stale: boolean;
}

const hashSourceInfo = 'sourceInfo';

export function isSourceInfo<V>(v: V) {
  return is$typed(v, id, hashSourceInfo);
}

export function validateSourceInfo<V>(v: V) {
  return validate<SourceInfo & V>(v, id, hashSourceInfo);
}

/** Current metrics for the eprint */
export interface EprintMetrics {
  $type?: 'pub.chive.metrics.getTrending#eprintMetrics';
  /** Total view count */
  views: number;
  /** Total download count */
  downloads: number;
  /** Endorsement count */
  endorsements?: number;
}

const hashEprintMetrics = 'eprintMetrics';

export function isEprintMetrics<V>(v: V) {
  return is$typed(v, id, hashEprintMetrics);
}

export function validateEprintMetrics<V>(v: V) {
  return validate<EprintMetrics & V>(v, id, hashEprintMetrics);
}
