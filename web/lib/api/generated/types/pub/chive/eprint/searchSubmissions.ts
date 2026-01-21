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
const id = 'pub.chive.eprint.searchSubmissions';

export type QueryParams = {
  /** Search query. If omitted, returns recent eprints (browsing mode) */
  q?: string;
  /** Filter by author DID */
  author?: string;
  /** Filter by field node URIs (subkind=field) */
  fieldUris?: string[];
  /** Filter by topic node URIs (subkind=topic) */
  topicUris?: string[];
  /** Filter by facet node URIs (subkind=facet) */
  facetUris?: string[];
  /** Filter by paper type node URI (subkind=paper-type) */
  paperTypeUri?: string;
  /** Filter by publication status node URI (subkind=publication-status) */
  publicationStatusUri?: string;
  /** Filter by submission date (from) */
  dateFrom?: string;
  /** Filter by submission date (to) */
  dateTo?: string;
  limit?: number;
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  hits: SearchHit[];
  cursor?: string;
  /** Total number of matching documents */
  total?: number;
  facetAggregations?: FacetAggregation[];
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

/** A search result hit */
export interface SearchHit {
  $type?: 'pub.chive.eprint.searchSubmissions#searchHit';
  /** AT-URI of the matched eprint */
  uri: string;
  /** Relevance score (scaled by 1000 for precision) */
  score: number;
  highlight?: HighlightResult;
}

const hashSearchHit = 'searchHit';

export function isSearchHit<V>(v: V) {
  return is$typed(v, id, hashSearchHit);
}

export function validateSearchHit<V>(v: V) {
  return validate<SearchHit & V>(v, id, hashSearchHit);
}

/** Highlighted text fragments with search matches */
export interface HighlightResult {
  $type?: 'pub.chive.eprint.searchSubmissions#highlightResult';
  /** Title fragments with <em> highlighting */
  title?: string[];
  /** Abstract fragments with <em> highlighting */
  abstract?: string[];
}

const hashHighlightResult = 'highlightResult';

export function isHighlightResult<V>(v: V) {
  return is$typed(v, id, hashHighlightResult);
}

export function validateHighlightResult<V>(v: V) {
  return validate<HighlightResult & V>(v, id, hashHighlightResult);
}

/** Aggregation for a facet dimension */
export interface FacetAggregation {
  $type?: 'pub.chive.eprint.searchSubmissions#facetAggregation';
  /** Dimension identifier (e.g., 'field', 'topic', 'paperType') */
  dimension: string;
  /** Subkind slug for the dimension's nodes */
  subkind: string;
  /** Display label for the dimension */
  label?: string;
  values: FacetValue[];
}

const hashFacetAggregation = 'facetAggregation';

export function isFacetAggregation<V>(v: V) {
  return is$typed(v, id, hashFacetAggregation);
}

export function validateFacetAggregation<V>(v: V) {
  return validate<FacetAggregation & V>(v, id, hashFacetAggregation);
}

/** A facet value with node reference */
export interface FacetValue {
  $type?: 'pub.chive.eprint.searchSubmissions#facetValue';
  /** AT-URI of the knowledge graph node */
  uri: string;
  /** Node slug for URL generation */
  slug?: string;
  /** Display label */
  label: string;
  /** Number of documents with this facet value */
  count: number;
}

const hashFacetValue = 'facetValue';

export function isFacetValue<V>(v: V) {
  return is$typed(v, id, hashFacetValue);
}

export function validateFacetValue<V>(v: V) {
  return validate<FacetValue & V>(v, id, hashFacetValue);
}
