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
const id = 'pub.chive.claiming.getSuggestions';

export type QueryParams = {
  /** Maximum number of suggestions to return */
  limit?: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Suggested papers sorted by match score */
  papers: SuggestedPaper[];
  profileUsed: ProfileMetadata;
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

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
  }

  return e;
}

export interface SuggestedPaper {
  $type?: 'pub.chive.claiming.getSuggestions#suggestedPaper';
  /** Source-specific identifier */
  externalId: string;
  /** Full URL to the eprint */
  url: string;
  /** Eprint title */
  title: string;
  /** Abstract text */
  abstract?: string;
  /** Author list */
  authors: ExternalAuthor[];
  /** Publication date */
  publicationDate?: string;
  /** DOI if assigned */
  doi?: string;
  /** URL to PDF */
  pdfUrl?: string;
  /** Subject categories */
  categories?: string[];
  /** Source system */
  source: string;
  /** Match confidence score (0-100) */
  matchScore: number;
  /** Human-readable match reason */
  matchReason: string;
}

const hashSuggestedPaper = 'suggestedPaper';

export function isSuggestedPaper<V>(v: V) {
  return is$typed(v, id, hashSuggestedPaper);
}

export function validateSuggestedPaper<V>(v: V) {
  return validate<SuggestedPaper & V>(v, id, hashSuggestedPaper);
}

export interface ExternalAuthor {
  $type?: 'pub.chive.claiming.getSuggestions#externalAuthor';
  /** Author name */
  name: string;
  /** ORCID identifier */
  orcid?: string;
  /** Institution affiliation */
  affiliation?: string;
  /** Email address */
  email?: string;
}

const hashExternalAuthor = 'externalAuthor';

export function isExternalAuthor<V>(v: V) {
  return is$typed(v, id, hashExternalAuthor);
}

export function validateExternalAuthor<V>(v: V) {
  return validate<ExternalAuthor & V>(v, id, hashExternalAuthor);
}

/** Profile data used for matching */
export interface ProfileMetadata {
  $type?: 'pub.chive.claiming.getSuggestions#profileMetadata';
  /** User display name */
  displayName?: string;
  /** Name variants used for matching */
  nameVariants: string[];
  /** Whether user has ORCID linked */
  hasOrcid: boolean;
  /** Whether user has external authority IDs */
  hasExternalIds: boolean;
}

const hashProfileMetadata = 'profileMetadata';

export function isProfileMetadata<V>(v: V) {
  return is$typed(v, id, hashProfileMetadata);
}

export function validateProfileMetadata<V>(v: V) {
  return validate<ProfileMetadata & V>(v, id, hashProfileMetadata);
}
