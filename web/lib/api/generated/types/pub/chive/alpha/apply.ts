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
const id = 'pub.chive.alpha.apply';

export type QueryParams = {};

export interface InputSchema {
  /** Contact email for notifications */
  email: string;
  /** Organization type */
  sector:
    | 'academia'
    | 'industry'
    | 'government'
    | 'nonprofit'
    | 'healthcare'
    | 'independent'
    | 'other'
    | (string & {});
  /** Custom sector if 'other' selected */
  sectorOther?: string;
  /** Career stage/position */
  careerStage:
    | 'undergraduate'
    | 'graduate-masters'
    | 'graduate-phd'
    | 'postdoc'
    | 'research-staff'
    | 'junior-faculty'
    | 'senior-faculty'
    | 'research-admin'
    | 'librarian'
    | 'science-communicator'
    | 'policy-professional'
    | 'retired'
    | 'other'
    | (string & {});
  /** Custom career stage if 'other' selected */
  careerStageOther?: string;
  /** Institutional affiliations (optional) */
  affiliations?: Affiliation[];
  /** Research keywords */
  researchKeywords: ResearchKeyword[];
  /** Optional motivation statement */
  motivation?: string;
}

export interface OutputSchema {
  /** UUID of the created application */
  applicationId: string;
  /** Application status */
  status: 'none' | 'pending' | 'approved' | 'rejected' | (string & {});
  /** Application creation timestamp */
  createdAt: string;
}

export interface CallOptions {
  signal?: AbortSignal;
  headers?: HeadersMap;
  qp?: QueryParams;
  encoding?: 'application/json';
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

export class InvalidEmailError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export class InvalidRequestError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
    if (e.error === 'InvalidEmail') return new InvalidEmailError(e);
    if (e.error === 'InvalidRequest') return new InvalidRequestError(e);
  }

  return e;
}

/** Institutional affiliation */
export interface Affiliation {
  $type?: 'pub.chive.alpha.apply#affiliation';
  /** Institution name */
  name: string;
  /** ROR ID */
  rorId?: string;
}

const hashAffiliation = 'affiliation';

export function isAffiliation<V>(v: V) {
  return is$typed(v, id, hashAffiliation);
}

export function validateAffiliation<V>(v: V) {
  return validate<Affiliation & V>(v, id, hashAffiliation);
}

/** Research keyword with optional authority identifiers */
export interface ResearchKeyword {
  $type?: 'pub.chive.alpha.apply#researchKeyword';
  /** Keyword label */
  label: string;
  /** FAST authority ID */
  fastId?: string;
  /** Wikidata ID */
  wikidataId?: string;
}

const hashResearchKeyword = 'researchKeyword';

export function isResearchKeyword<V>(v: V) {
  return is$typed(v, id, hashResearchKeyword);
}

export function validateResearchKeyword<V>(v: V) {
  return validate<ResearchKeyword & V>(v, id, hashResearchKeyword);
}
