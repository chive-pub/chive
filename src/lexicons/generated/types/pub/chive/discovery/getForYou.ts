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
const id = 'pub.chive.discovery.getForYou';

export type QueryParams = {
  /** Maximum number of recommendations */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  recommendations: RecommendedEprint[];
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
  error?: 'AuthenticationRequired' | 'ServiceUnavailable';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

export interface RecommendedEprint {
  $type?: 'pub.chive.discovery.getForYou#recommendedEprint';
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
  $type?: 'pub.chive.discovery.getForYou#author';
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
  $type?: 'pub.chive.discovery.getForYou#recommendationExplanation';
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
  $type?: 'pub.chive.discovery.getForYou#explanationData';
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
