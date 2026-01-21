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
const id = 'pub.chive.tag.search';

export type QueryParams = {
  /** Search query */
  q: string;
  /** Maximum number of results to return */
  limit: number;
  /** Pagination cursor for next page */
  cursor?: string;
  /** Minimum quality score (0-100, scaled from 0-1) */
  minQuality?: number;
  /** Include tags flagged as potential spam */
  includeSpam: boolean;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Search results */
  tags: TagSummary[];
  /** Cursor for next page */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
  /** Total count of matching tags */
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
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** Summary information for a tag */
export interface TagSummary {
  $type?: 'pub.chive.tag.search#tagSummary';
  /** Normalized tag form (lowercase, hyphenated) */
  normalizedForm: string;
  /** All display forms used for this tag */
  displayForms: string[];
  /** Number of eprints tagged with this tag */
  usageCount: number;
  /** Tag quality score (0-100, scaled from 0-1) */
  qualityScore: number;
  /** Whether the tag has been promoted to a facet or authority */
  isPromoted: boolean;
  promotedTo?: PromotionTarget;
}

const hashTagSummary = 'tagSummary';

export function isTagSummary<V>(v: V) {
  return is$typed(v, id, hashTagSummary);
}

export function validateTagSummary<V>(v: V) {
  return validate<TagSummary & V>(v, id, hashTagSummary);
}

/** Target of tag promotion */
export interface PromotionTarget {
  $type?: 'pub.chive.tag.search#promotionTarget';
  /** Type of promotion target */
  type: 'facet' | 'authority' | (string & {});
  /** URI of the promotion target */
  uri: string;
}

const hashPromotionTarget = 'promotionTarget';

export function isPromotionTarget<V>(v: V) {
  return is$typed(v, id, hashPromotionTarget);
}

export function validatePromotionTarget<V>(v: V) {
  return validate<PromotionTarget & V>(v, id, hashPromotionTarget);
}
