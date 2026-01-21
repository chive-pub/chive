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
const id = 'pub.chive.actor.getDiscoverySettings';

export type QueryParams = {};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Enable personalized recommendations based on profile */
  enablePersonalization: boolean;
  /** Show the For You personalized feed */
  enableForYouFeed: boolean;
  forYouSignals: ForYouSignals;
  relatedPapersSignals: RelatedPapersSignals;
  /** How to display citation network */
  citationNetworkDisplay: 'hidden' | 'preview' | 'expanded' | (string & {});
  /** Show explanations for why papers are recommended */
  showRecommendationReasons: boolean;
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

export class PDSNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
    if (e.error === 'PDSNotFound') return new PDSNotFoundError(e);
  }

  return e;
}

/** Configuration for For You feed signals */
export interface ForYouSignals {
  $type?: 'pub.chive.actor.getDiscoverySettings#forYouSignals';
  /** Show papers from user's research fields */
  fields?: boolean;
  /** Show papers citing user's work */
  citations?: boolean;
  /** Show papers from collaborators */
  collaborators?: boolean;
  /** Show trending papers in user's fields */
  trending?: boolean;
}

const hashForYouSignals = 'forYouSignals';

export function isForYouSignals<V>(v: V) {
  return is$typed(v, id, hashForYouSignals);
}

export function validateForYouSignals<V>(v: V) {
  return validate<ForYouSignals & V>(v, id, hashForYouSignals);
}

/** Configuration for related papers panel signals */
export interface RelatedPapersSignals {
  $type?: 'pub.chive.actor.getDiscoverySettings#relatedPapersSignals';
  /** Show citation-based relationships */
  citations?: boolean;
  /** Show topic/concept-based relationships */
  topics?: boolean;
}

const hashRelatedPapersSignals = 'relatedPapersSignals';

export function isRelatedPapersSignals<V>(v: V) {
  return is$typed(v, id, hashRelatedPapersSignals);
}

export function validateRelatedPapersSignals<V>(v: V) {
  return validate<RelatedPapersSignals & V>(v, id, hashRelatedPapersSignals);
}
