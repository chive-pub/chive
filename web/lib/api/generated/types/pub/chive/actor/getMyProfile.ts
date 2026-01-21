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
const id = 'pub.chive.actor.getMyProfile';

export type QueryParams = {};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Display name */
  displayName?: string;
  /** Biography text */
  bio?: string;
  /** ORCID identifier */
  orcid?: string;
  /** Current institutional affiliations */
  affiliations?: Affiliation[];
  /** Research field identifiers */
  fields?: string[];
  /** Alternative name forms for paper matching */
  nameVariants?: string[];
  /** Past institutional affiliations */
  previousAffiliations?: Affiliation[];
  /** Research topics and keywords */
  researchKeywords?: ResearchKeyword[];
  /** Semantic Scholar author ID */
  semanticScholarId?: string;
  /** OpenAlex author ID */
  openAlexId?: string;
  /** Google Scholar profile ID */
  googleScholarId?: string;
  /** arXiv author identifier */
  arxivAuthorId?: string;
  /** OpenReview profile ID */
  openReviewId?: string;
  /** DBLP author identifier */
  dblpId?: string;
  /** Scopus author ID */
  scopusAuthorId?: string;
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

/** Institutional affiliation */
export interface Affiliation {
  $type?: 'pub.chive.actor.getMyProfile#affiliation';
  /** Organization name */
  name: string;
  /** ROR ID for the institution */
  rorId?: string;
}

const hashAffiliation = 'affiliation';

export function isAffiliation<V>(v: V) {
  return is$typed(v, id, hashAffiliation);
}

export function validateAffiliation<V>(v: V) {
  return validate<Affiliation & V>(v, id, hashAffiliation);
}

/** Research keyword with optional authority IDs */
export interface ResearchKeyword {
  $type?: 'pub.chive.actor.getMyProfile#researchKeyword';
  /** Keyword label */
  label: string;
  /** FAST subject heading ID */
  fastId?: string;
  /** Wikidata entity ID */
  wikidataId?: string;
}

const hashResearchKeyword = 'researchKeyword';

export function isResearchKeyword<V>(v: V) {
  return is$typed(v, id, hashResearchKeyword);
}

export function validateResearchKeyword<V>(v: V) {
  return validate<ResearchKeyword & V>(v, id, hashResearchKeyword);
}
