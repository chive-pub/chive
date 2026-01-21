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
const id = 'pub.chive.actor.autocompleteKeyword';

export type QueryParams = {
  /** Search query for keyword */
  query: string;
  /** Maximum number of suggestions to return */
  limit?: number;
  /** Data sources to query (defaults to both) */
  sources?: 'fast' | 'wikidata' | (string & {})[];
};
export type InputSchema = undefined;

export interface OutputSchema {
  suggestions: KeywordSuggestion[];
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

/** A keyword suggestion from FAST or Wikidata */
export interface KeywordSuggestion {
  $type?: 'pub.chive.actor.autocompleteKeyword#keywordSuggestion';
  /** Identifier from the source system (FAST ID or Wikidata Q-number) */
  id: string;
  /** Display label for the keyword */
  label: string;
  /** Source of the keyword suggestion */
  source: 'fast' | 'wikidata' | 'freetext' | (string & {});
  /** Description of the keyword (Wikidata only) */
  description?: string;
  /** Usage count from FAST database */
  usageCount?: number;
}

const hashKeywordSuggestion = 'keywordSuggestion';

export function isKeywordSuggestion<V>(v: V) {
  return is$typed(v, id, hashKeywordSuggestion);
}

export function validateKeywordSuggestion<V>(v: V) {
  return validate<KeywordSuggestion & V>(v, id, hashKeywordSuggestion);
}
