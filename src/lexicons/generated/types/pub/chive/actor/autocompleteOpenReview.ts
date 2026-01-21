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
const id = 'pub.chive.actor.autocompleteOpenReview';

export type QueryParams = {
  /** Search query for researcher name */
  query: string;
  /** Maximum number of suggestions to return */
  limit: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  suggestions: OpenReviewSuggestion[];
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

/** An OpenReview profile suggestion */
export interface OpenReviewSuggestion {
  $type?: 'pub.chive.actor.autocompleteOpenReview#openReviewSuggestion';
  /** OpenReview profile ID (e.g., ~John_Smith1) */
  id: string;
  /** Full name of the researcher */
  displayName: string;
  /** Current institution if available */
  institution?: string;
}

const hashOpenReviewSuggestion = 'openReviewSuggestion';

export function isOpenReviewSuggestion<V>(v: V) {
  return is$typed(v, id, hashOpenReviewSuggestion);
}

export function validateOpenReviewSuggestion<V>(v: V) {
  return validate<OpenReviewSuggestion & V>(v, id, hashOpenReviewSuggestion);
}
