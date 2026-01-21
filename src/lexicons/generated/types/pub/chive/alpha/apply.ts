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

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
  headers?: { [key: string]: string };
}

export interface HandlerError {
  status: number;
  message?: string;
  error?: 'AuthenticationRequired' | 'InvalidEmail' | 'InvalidRequest';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

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
