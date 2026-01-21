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
const id = 'pub.chive.claiming.searchEprints';

export type QueryParams = {
  /** Title or keyword search query */
  query?: string;
  /** Author name to search for */
  author?: string;
  /** Comma-separated list of sources to search */
  sources?: string;
  /** Maximum number of results */
  limit: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  eprints: ExternalEprint[];
  facets?: SearchFacets;
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
  error?: 'InvalidRequest';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

export interface ExternalEprint {
  $type?: 'pub.chive.claiming.searchEprints#externalEprint';
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
  existingChivePaper?: ExistingChivePaper;
}

const hashExternalEprint = 'externalEprint';

export function isExternalEprint<V>(v: V) {
  return is$typed(v, id, hashExternalEprint);
}

export function validateExternalEprint<V>(v: V) {
  return validate<ExternalEprint & V>(v, id, hashExternalEprint);
}

export interface ExternalAuthor {
  $type?: 'pub.chive.claiming.searchEprints#externalAuthor';
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

/** Existing Chive paper if this is a duplicate */
export interface ExistingChivePaper {
  $type?: 'pub.chive.claiming.searchEprints#existingChivePaper';
  /** AT-URI of the existing paper */
  uri: string;
  /** Paper title */
  title: string;
  /** Author list */
  authors: ExistingAuthor[];
  /** When the paper was indexed */
  createdAt: string;
}

const hashExistingChivePaper = 'existingChivePaper';

export function isExistingChivePaper<V>(v: V) {
  return is$typed(v, id, hashExistingChivePaper);
}

export function validateExistingChivePaper<V>(v: V) {
  return validate<ExistingChivePaper & V>(v, id, hashExistingChivePaper);
}

export interface ExistingAuthor {
  $type?: 'pub.chive.claiming.searchEprints#existingAuthor';
  /** Author DID if claimed */
  did?: string;
  /** Author name */
  name: string;
}

const hashExistingAuthor = 'existingAuthor';

export function isExistingAuthor<V>(v: V) {
  return is$typed(v, id, hashExistingAuthor);
}

export function validateExistingAuthor<V>(v: V) {
  return validate<ExistingAuthor & V>(v, id, hashExistingAuthor);
}

export interface SearchFacets {
  $type?: 'pub.chive.claiming.searchEprints#searchFacets';
  /** Result counts by source (key: source name, value: count) */
  sources?: { [_ in string]: unknown };
}

const hashSearchFacets = 'searchFacets';

export function isSearchFacets<V>(v: V) {
  return is$typed(v, id, hashSearchFacets);
}

export function validateSearchFacets<V>(v: V) {
  return validate<SearchFacets & V>(v, id, hashSearchFacets);
}
