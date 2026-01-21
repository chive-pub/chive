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
const id = 'pub.chive.import.search';

export type QueryParams = {
  /** Search query for title, abstract, or author */
  query?: string;
  /** Filter by external source identifier */
  source?: string;
  /** Filter by claim status */
  claimStatus?: 'unclaimed' | 'pending' | 'claimed' | (string & {});
  /** Filter by author name */
  authorName?: string;
  /** Filter by author ORCID */
  authorOrcid?: string;
  /** Maximum results to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of matching imported eprints */
  eprints: ImportedEprint[];
  /** Cursor for next page */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
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

/** An eprint imported from an external source */
export interface ImportedEprint {
  $type?: 'pub.chive.import.search#importedEprint';
  /** Internal import ID */
  id: number;
  /** External source identifier */
  source: string;
  /** Source-specific identifier */
  externalId: string;
  /** URL to the eprint on the external source */
  url: string;
  /** Eprint title */
  title: string;
  /** Abstract text */
  abstract?: string;
  /** Author list */
  authors: ExternalAuthor[];
  /** Publication date */
  publicationDate?: string;
  /** Subject categories */
  categories?: string[];
  /** DOI if assigned */
  doi?: string;
  /** URL to PDF */
  pdfUrl?: string;
  /** Plugin that imported this eprint */
  importedByPlugin: string;
  /** When the eprint was imported */
  importedAt: string;
  /** When the eprint was last synced */
  lastSyncedAt?: string;
  /** Current sync status */
  syncStatus: 'active' | 'stale' | 'unavailable' | (string & {});
  /** Current claim status */
  claimStatus: 'unclaimed' | 'pending' | 'claimed' | (string & {});
  /** AT-URI of the canonical record if claimed */
  canonicalUri?: string;
  /** DID of the user who claimed this eprint */
  claimedByDid?: string;
  /** When the eprint was claimed */
  claimedAt?: string;
}

const hashImportedEprint = 'importedEprint';

export function isImportedEprint<V>(v: V) {
  return is$typed(v, id, hashImportedEprint);
}

export function validateImportedEprint<V>(v: V) {
  return validate<ImportedEprint & V>(v, id, hashImportedEprint);
}

/** An author from an external source */
export interface ExternalAuthor {
  $type?: 'pub.chive.import.search#externalAuthor';
  /** Author name */
  name: string;
  /** ORCID identifier */
  orcid?: string;
  /** Institutional affiliation */
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
