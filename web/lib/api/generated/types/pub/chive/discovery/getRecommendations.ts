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
const id = 'pub.chive.discovery.getRecommendations';

export type QueryParams = {
  /** Maximum number of recommendations */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Signal types to include. 'graph' adds co-citation and PageRank-based recommendations. */
  signals?: 'fields' | 'citations' | 'collaborators' | 'trending' | 'graph' | (string & {})[];
};
export type InputSchema = undefined;

export interface OutputSchema {
  recommendations: RecommendedEprint[];
  /** Pagination cursor for next page */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
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

export class ServiceUnavailableError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
    if (e.error === 'ServiceUnavailable') return new ServiceUnavailableError(e);
  }

  return e;
}

export interface RecommendedEprint {
  $type?: 'pub.chive.discovery.getRecommendations#recommendedEprint';
  uri: string;
  title: string;
  abstract?: string;
  authors?: Author[];
  categories?: string[];
  publicationDate?: string;
  /** Relevance score (scaled by 1000 for 0.0-1.0 range) */
  score: number;
  explanation: RecommendationExplanation;
}

const hashRecommendedEprint = 'recommendedEprint';

export function isRecommendedEprint<V>(v: V) {
  return is$typed(v, id, hashRecommendedEprint);
}

export function validateRecommendedEprint<V>(v: V) {
  return validate<RecommendedEprint & V>(v, id, hashRecommendedEprint);
}

export interface Author {
  $type?: 'pub.chive.discovery.getRecommendations#author';
  name: string;
}

const hashAuthor = 'author';

export function isAuthor<V>(v: V) {
  return is$typed(v, id, hashAuthor);
}

export function validateAuthor<V>(v: V) {
  return validate<Author & V>(v, id, hashAuthor);
}

export interface RecommendationExplanation {
  $type?: 'pub.chive.discovery.getRecommendations#recommendationExplanation';
  /** Type of recommendation signal */
  type:
    | 'semantic'
    | 'citation'
    | 'concept'
    | 'collaborator'
    | 'fields'
    | 'trending'
    | (string & {});
  /** Human-readable explanation */
  text: string;
  /** Signal weight (scaled by 1000 for 0.0-1.0 range) */
  weight: number;
  data?: ExplanationData;
}

const hashRecommendationExplanation = 'recommendationExplanation';

export function isRecommendationExplanation<V>(v: V) {
  return is$typed(v, id, hashRecommendationExplanation);
}

export function validateRecommendationExplanation<V>(v: V) {
  return validate<RecommendationExplanation & V>(v, id, hashRecommendationExplanation);
}

export interface ExplanationData {
  $type?: 'pub.chive.discovery.getRecommendations#explanationData';
  /** Title of paper that triggered similarity match */
  similarPaperTitle?: string;
  /** Number of shared citations */
  sharedCitations?: number;
  /** Concepts that matched user interests */
  matchingConcepts?: string[];
}

const hashExplanationData = 'explanationData';

export function isExplanationData<V>(v: V) {
  return is$typed(v, id, hashExplanationData);
}

export function validateExplanationData<V>(v: V) {
  return validate<ExplanationData & V>(v, id, hashExplanationData);
}
