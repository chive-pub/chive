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
const id = 'pub.chive.graph.browseFaceted';

export type QueryParams = {
  /** Optional text query */
  q?: string;
  /** JSON-encoded facet filters keyed by facet slug (e.g., {"methodology":["meta-analysis"]}) */
  facets?: string;
  /** Maximum results to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Matching eprints */
  hits: EprintSummary[];
  /** Available facet refinements */
  facets: FacetDefinition[];
  /** Pagination cursor for next page */
  cursor?: string;
  /** Whether more results exist */
  hasMore: boolean;
  /** Total count of matching eprints */
  total: number;
  /** Impression ID for click tracking */
  impressionId?: string;
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

/** Eprint summary for faceted browse results */
export interface EprintSummary {
  $type?: 'pub.chive.graph.browseFaceted#eprintSummary';
  /** Eprint AT-URI */
  uri: string;
  /** CID of indexed version */
  cid: string;
  /** Eprint title */
  title: string;
  /** Eprint abstract */
  abstract: string;
  /** All authors with contributions */
  authors: AuthorRef[];
  /** DID of human user who submitted */
  submittedBy: string;
  /** Paper DID if paper has its own PDS */
  paperDid?: string;
  /** Subject fields */
  fields?: FieldRef[];
  /** License identifier */
  license: string;
  /** Keywords */
  keywords?: string[];
  /** Creation timestamp */
  createdAt: string;
  /** Index timestamp */
  indexedAt: string;
  source: SourceInfo;
  /** Relevance score (scaled by 1000 for 0.0-1.0 range) */
  score?: number;
  /** Search highlights keyed by field */
  highlights?: { [_ in string]: unknown };
}

const hashEprintSummary = 'eprintSummary';

export function isEprintSummary<V>(v: V) {
  return is$typed(v, id, hashEprintSummary);
}

export function validateEprintSummary<V>(v: V) {
  return validate<EprintSummary & V>(v, id, hashEprintSummary);
}

/** Author reference with contributions */
export interface AuthorRef {
  $type?: 'pub.chive.graph.browseFaceted#authorRef';
  /** Author DID */
  did: string;
  /** Display name */
  name: string;
  /** ORCID identifier */
  orcid?: string;
  /** Contact email */
  email?: string;
  /** Author order (1-based) */
  order: number;
  /** Author affiliations */
  affiliations: AffiliationRef[];
  /** CRediT contributions */
  contributions: ContributionRef[];
  /** Whether this is the corresponding author */
  isCorrespondingAuthor?: boolean;
  /** Whether this author should be highlighted */
  isHighlighted?: boolean;
  /** ATProto handle */
  handle?: string;
  /** Avatar image URL */
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
export interface AffiliationRef {
  $type?: 'pub.chive.graph.browseFaceted#affiliationRef';
  /** Institution name */
  name: string;
  /** ROR identifier */
  rorId?: string;
  /** Department name */
  department?: string;
}

const hashAffiliationRef = 'affiliationRef';

export function isAffiliationRef<V>(v: V) {
  return is$typed(v, id, hashAffiliationRef);
}

export function validateAffiliationRef<V>(v: V) {
  return validate<AffiliationRef & V>(v, id, hashAffiliationRef);
}

/** CRediT contribution */
export interface ContributionRef {
  $type?: 'pub.chive.graph.browseFaceted#contributionRef';
  /** AT-URI of contribution type node */
  typeUri: string;
  /** Contribution type identifier */
  typeId: string;
  /** Contribution type label */
  typeLabel: string;
  /** Degree of contribution */
  degree?: 'lead' | 'equal' | 'supporting' | (string & {});
}

const hashContributionRef = 'contributionRef';

export function isContributionRef<V>(v: V) {
  return is$typed(v, id, hashContributionRef);
}

export function validateContributionRef<V>(v: V) {
  return validate<ContributionRef & V>(v, id, hashContributionRef);
}

/** Subject field reference */
export interface FieldRef {
  $type?: 'pub.chive.graph.browseFaceted#fieldRef';
  /** Field AT-URI */
  uri: string;
  /** Field label */
  label: string;
  /** Field identifier */
  id?: string;
  /** Parent field AT-URI */
  parentUri?: string;
}

const hashFieldRef = 'fieldRef';

export function isFieldRef<V>(v: V) {
  return is$typed(v, id, hashFieldRef);
}

export function validateFieldRef<V>(v: V) {
  return validate<FieldRef & V>(v, id, hashFieldRef);
}

/** Source PDS information */
export interface SourceInfo {
  $type?: 'pub.chive.graph.browseFaceted#sourceInfo';
  /** PDS endpoint URL */
  pdsEndpoint: string;
  /** Direct record URL */
  recordUrl?: string;
  /** Blob URL */
  blobUrl?: string;
  /** Last verification timestamp */
  lastVerifiedAt?: string;
  /** Whether data is potentially stale */
  stale?: boolean;
}

const hashSourceInfo = 'sourceInfo';

export function isSourceInfo<V>(v: V) {
  return is$typed(v, id, hashSourceInfo);
}

export function validateSourceInfo<V>(v: V) {
  return validate<SourceInfo & V>(v, id, hashSourceInfo);
}

/** Facet definition from the knowledge graph */
export interface FacetDefinition {
  $type?: 'pub.chive.graph.browseFaceted#facetDefinition';
  /** Facet slug identifier */
  slug: string;
  /** Display label */
  label: string;
  /** Facet description */
  description?: string;
  /** Available values with counts */
  values: FacetValue[];
}

const hashFacetDefinition = 'facetDefinition';

export function isFacetDefinition<V>(v: V) {
  return is$typed(v, id, hashFacetDefinition);
}

export function validateFacetDefinition<V>(v: V) {
  return validate<FacetDefinition & V>(v, id, hashFacetDefinition);
}

/** Facet value with count */
export interface FacetValue {
  $type?: 'pub.chive.graph.browseFaceted#facetValue';
  /** Facet value */
  value: string;
  /** Display label */
  label?: string;
  /** Number of eprints with this value */
  count: number;
}

const hashFacetValue = 'facetValue';

export function isFacetValue<V>(v: V) {
  return is$typed(v, id, hashFacetValue);
}

export function validateFacetValue<V>(v: V) {
  return validate<FacetValue & V>(v, id, hashFacetValue);
}
