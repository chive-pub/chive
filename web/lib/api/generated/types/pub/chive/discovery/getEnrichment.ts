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
const id = 'pub.chive.discovery.getEnrichment';

export type QueryParams = {
  /** Eprint AT-URI */
  uri: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  enrichment?: EnrichmentData;
  /** Whether enrichment data is available */
  available: boolean;
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

export class NotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'NotFound') return new NotFoundError(e);
  }

  return e;
}

export interface EnrichmentData {
  $type?: 'pub.chive.discovery.getEnrichment#enrichmentData';
  uri: string;
  /** Semantic Scholar paper ID */
  semanticScholarId?: string;
  /** OpenAlex work ID */
  openAlexId?: string;
  /** Total citation count */
  citationCount?: number;
  /** Influential citation count */
  influentialCitationCount?: number;
  /** Number of references */
  referencesCount?: number;
  concepts?: Concept[];
  topics?: Topic[];
  lastEnrichedAt?: string;
}

const hashEnrichmentData = 'enrichmentData';

export function isEnrichmentData<V>(v: V) {
  return is$typed(v, id, hashEnrichmentData);
}

export function validateEnrichmentData<V>(v: V) {
  return validate<EnrichmentData & V>(v, id, hashEnrichmentData);
}

export interface Concept {
  $type?: 'pub.chive.discovery.getEnrichment#concept';
  id: string;
  displayName: string;
  wikidataId?: string;
  /** Relevance score (scaled by 1000 for 0.0-1.0 range) */
  score?: number;
}

const hashConcept = 'concept';

export function isConcept<V>(v: V) {
  return is$typed(v, id, hashConcept);
}

export function validateConcept<V>(v: V) {
  return validate<Concept & V>(v, id, hashConcept);
}

export interface Topic {
  $type?: 'pub.chive.discovery.getEnrichment#topic';
  id: string;
  displayName: string;
  subfield?: string;
  field?: string;
  domain?: string;
  /** Relevance score (scaled by 1000 for 0.0-1.0 range) */
  score?: number;
}

const hashTopic = 'topic';

export function isTopic<V>(v: V) {
  return is$typed(v, id, hashTopic);
}

export function validateTopic<V>(v: V) {
  return validate<Topic & V>(v, id, hashTopic);
}
