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
const id = 'pub.chive.tag.getTrending';

export type QueryParams = {
  /** Time window for trending calculation */
  timeWindow?: 'day' | 'week' | 'month' | (string & {});
  /** Maximum number of trending tags to return */
  limit?: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of trending tags */
  tags: TagSummary[];
  /** Time window used for this response */
  timeWindow: 'day' | 'week' | 'month' | (string & {});
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

/** Summary information for a tag */
export interface TagSummary {
  $type?: 'pub.chive.tag.getTrending#tagSummary';
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
  $type?: 'pub.chive.tag.getTrending#promotionTarget';
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
