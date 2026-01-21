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
const id = 'pub.chive.author.getProfile';

export type QueryParams = {
  /** Author DID */
  did: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  profile: AuthorProfile;
  metrics: AuthorMetrics;
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

export class NotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'NotFound') return new NotFoundError(e);
  }

  return e;
}

export interface AuthorProfile {
  $type?: 'pub.chive.author.getProfile#authorProfile';
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  affiliation?: string;
  affiliations?: Affiliation[];
  orcid?: string;
  website?: string;
  pdsEndpoint?: string;
  fields?: string[];
  nameVariants?: string[];
  previousAffiliations?: Affiliation[];
  researchKeywords?: ResearchKeyword[];
  semanticScholarId?: string;
  openAlexId?: string;
  googleScholarId?: string;
  arxivAuthorId?: string;
  openReviewId?: string;
  dblpId?: string;
  scopusAuthorId?: string;
}

const hashAuthorProfile = 'authorProfile';

export function isAuthorProfile<V>(v: V) {
  return is$typed(v, id, hashAuthorProfile);
}

export function validateAuthorProfile<V>(v: V) {
  return validate<AuthorProfile & V>(v, id, hashAuthorProfile);
}

export interface Affiliation {
  $type?: 'pub.chive.author.getProfile#affiliation';
  name: string;
  rorId?: string;
}

const hashAffiliation = 'affiliation';

export function isAffiliation<V>(v: V) {
  return is$typed(v, id, hashAffiliation);
}

export function validateAffiliation<V>(v: V) {
  return validate<Affiliation & V>(v, id, hashAffiliation);
}

export interface ResearchKeyword {
  $type?: 'pub.chive.author.getProfile#researchKeyword';
  label: string;
  fastId?: string;
  wikidataId?: string;
}

const hashResearchKeyword = 'researchKeyword';

export function isResearchKeyword<V>(v: V) {
  return is$typed(v, id, hashResearchKeyword);
}

export function validateResearchKeyword<V>(v: V) {
  return validate<ResearchKeyword & V>(v, id, hashResearchKeyword);
}

export interface AuthorMetrics {
  $type?: 'pub.chive.author.getProfile#authorMetrics';
  totalEprints: number;
  totalViews: number;
  totalDownloads: number;
  totalEndorsements: number;
}

const hashAuthorMetrics = 'authorMetrics';

export function isAuthorMetrics<V>(v: V) {
  return is$typed(v, id, hashAuthorMetrics);
}

export function validateAuthorMetrics<V>(v: V) {
  return validate<AuthorMetrics & V>(v, id, hashAuthorMetrics);
}
