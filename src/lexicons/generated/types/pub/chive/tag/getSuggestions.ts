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
const id = 'pub.chive.tag.getSuggestions';

export type QueryParams = {
  /** Query string to get suggestions for */
  q: string;
  /** Maximum number of suggestions to return */
  limit: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of tag suggestions */
  suggestions: TagSuggestion[];
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

/** A tag suggestion from the TaxoFolk system */
export interface TagSuggestion {
  $type?: 'pub.chive.tag.getSuggestions#tagSuggestion';
  /** Suggested display form */
  displayForm: string;
  /** Normalized form of the suggestion */
  normalizedForm: string;
  /** Suggestion confidence (0-100, scaled from 0-1) */
  confidence: number;
  /** Source of the suggestion */
  source: 'cooccurrence' | 'authority' | 'facet' | (string & {});
  /** Term that triggered this suggestion */
  matchedTerm?: string;
}

const hashTagSuggestion = 'tagSuggestion';

export function isTagSuggestion<V>(v: V) {
  return is$typed(v, id, hashTagSuggestion);
}

export function validateTagSuggestion<V>(v: V) {
  return validate<TagSuggestion & V>(v, id, hashTagSuggestion);
}
