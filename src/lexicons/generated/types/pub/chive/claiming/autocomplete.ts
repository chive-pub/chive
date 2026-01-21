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
const id = 'pub.chive.claiming.autocomplete';

export type QueryParams = {
  /** Search query prefix */
  query: string;
  /** Maximum number of suggestions to return */
  limit: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of autocomplete suggestions */
  suggestions: Suggestion[];
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

/** An autocomplete suggestion for a claimable eprint */
export interface Suggestion {
  $type?: 'pub.chive.claiming.autocomplete#suggestion';
  /** Eprint title */
  title: string;
  /** First 2 authors joined (e.g., 'Author1, Author2 et al.') */
  authors: string;
  /** External source identifier (e.g., arxiv, biorxiv) */
  source: string;
  /** Source-specific identifier */
  externalId: string;
  /** Title with query portion highlighted using markdown bold */
  highlightedTitle?: string;
  /** User field relevance score (0-100), present if authenticated */
  fieldMatchScore?: number;
}

const hashSuggestion = 'suggestion';

export function isSuggestion<V>(v: V) {
  return is$typed(v, id, hashSuggestion);
}

export function validateSuggestion<V>(v: V) {
  return validate<Suggestion & V>(v, id, hashSuggestion);
}
