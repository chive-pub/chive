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
const id = 'pub.chive.actor.autocompleteOrcid';

export type QueryParams = {
  /** Search query for researcher name or ORCID */
  query: string;
  /** Maximum number of suggestions to return */
  limit: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  suggestions: OrcidSuggestion[];
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

/** An ORCID profile suggestion */
export interface OrcidSuggestion {
  $type?: 'pub.chive.actor.autocompleteOrcid#orcidSuggestion';
  /** ORCID identifier (e.g., 0000-0002-1825-0097) */
  orcid: string;
  /** Given (first) names */
  givenNames?: string;
  /** Family (last) name */
  familyName?: string;
  /** Current institutional affiliation */
  affiliation?: string;
}

const hashOrcidSuggestion = 'orcidSuggestion';

export function isOrcidSuggestion<V>(v: V) {
  return is$typed(v, id, hashOrcidSuggestion);
}

export function validateOrcidSuggestion<V>(v: V) {
  return validate<OrcidSuggestion & V>(v, id, hashOrcidSuggestion);
}
