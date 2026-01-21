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
const id = 'pub.chive.claiming.getSubmissionData';

export type QueryParams = {
  /** External source (e.g., arxiv, semanticscholar) */
  source: string;
  /** Source-specific identifier */
  externalId: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Prefilled title */
  title: string;
  /** Prefilled abstract */
  abstract: string;
  /** Prefilled authors */
  authors: SubmissionAuthor[];
  /** Prefilled keywords/categories */
  keywords: string[];
  /** DOI if available */
  doi?: string;
  /** PDF URL if available */
  pdfUrl?: string;
  /** Source system */
  source: string;
  /** Source-specific external ID */
  externalId: string;
  /** External URL to the paper */
  externalUrl: string;
  /** Publication date */
  publicationDate?: string;
  externalIds?: ExternalIds;
  existingChivePaper?: ExistingChivePaper;
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
  error?: 'AuthenticationRequired' | 'NotFound';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

export interface SubmissionAuthor {
  $type?: 'pub.chive.claiming.getSubmissionData#submissionAuthor';
  /** Author order (1-indexed) */
  order: number;
  /** Author name */
  name: string;
  /** ORCID identifier */
  orcid?: string;
  /** Email address */
  email?: string;
  /** Institution affiliation */
  affiliation?: string;
}

const hashSubmissionAuthor = 'submissionAuthor';

export function isSubmissionAuthor<V>(v: V) {
  return is$typed(v, id, hashSubmissionAuthor);
}

export function validateSubmissionAuthor<V>(v: V) {
  return validate<SubmissionAuthor & V>(v, id, hashSubmissionAuthor);
}

export interface ExternalIds {
  $type?: 'pub.chive.claiming.getSubmissionData#externalIds';
  /** arXiv identifier */
  arxivId?: string;
  /** DOI */
  doi?: string;
}

const hashExternalIds = 'externalIds';

export function isExternalIds<V>(v: V) {
  return is$typed(v, id, hashExternalIds);
}

export function validateExternalIds<V>(v: V) {
  return validate<ExternalIds & V>(v, id, hashExternalIds);
}

/** Existing Chive paper if this is a duplicate */
export interface ExistingChivePaper {
  $type?: 'pub.chive.claiming.getSubmissionData#existingChivePaper';
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
  $type?: 'pub.chive.claiming.getSubmissionData#existingAuthor';
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
