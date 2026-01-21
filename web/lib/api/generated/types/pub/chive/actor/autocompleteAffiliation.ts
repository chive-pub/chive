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
const id = 'pub.chive.actor.autocompleteAffiliation';

export type QueryParams = {
  /** Search query for institution name */
  query: string;
  /** Maximum number of suggestions to return */
  limit?: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  suggestions: AffiliationSuggestion[];
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

/** An affiliation suggestion from the ROR database */
export interface AffiliationSuggestion {
  $type?: 'pub.chive.actor.autocompleteAffiliation#affiliationSuggestion';
  /** ROR identifier URL (e.g., https://ror.org/02mhbdp94) */
  rorId: string;
  /** Display name of the institution */
  name: string;
  /** Country where the institution is located */
  country: string;
  /** Organization types (e.g., Education, Nonprofit) */
  types: string[];
  /** Institution acronym if available */
  acronym?: string;
}

const hashAffiliationSuggestion = 'affiliationSuggestion';

export function isAffiliationSuggestion<V>(v: V) {
  return is$typed(v, id, hashAffiliationSuggestion);
}

export function validateAffiliationSuggestion<V>(v: V) {
  return validate<AffiliationSuggestion & V>(v, id, hashAffiliationSuggestion);
}
