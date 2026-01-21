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
const id = 'pub.chive.claiming.findClaimable';

export type QueryParams = {
  /** Search query (title, author name, DOI) */
  q?: string;
  /** Filter by external source */
  source?:
    | 'arxiv'
    | 'biorxiv'
    | 'medrxiv'
    | 'osf'
    | 'lingbuzz'
    | 'zenodo'
    | 'ssrn'
    | 'philpapers'
    | (string & {});
  /** Maximum number of results to return */
  limit: number;
  /** Pagination cursor for next page */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of claimable eprints */
  eprints: ClaimableEprint[];
  /** Cursor for next page of results */
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
  error?: 'AuthenticationRequired';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** An eprint that can be claimed by the user */
export interface ClaimableEprint {
  $type?: 'pub.chive.claiming.findClaimable#claimableEprint';
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
  /** List of authors */
  authors: EprintAuthor[];
  /** Publication or submission date */
  publicationDate?: string;
  /** DOI if assigned */
  doi?: string;
}

const hashClaimableEprint = 'claimableEprint';

export function isClaimableEprint<V>(v: V) {
  return is$typed(v, id, hashClaimableEprint);
}

export function validateClaimableEprint<V>(v: V) {
  return validate<ClaimableEprint & V>(v, id, hashClaimableEprint);
}

/** Author information from external source */
export interface EprintAuthor {
  $type?: 'pub.chive.claiming.findClaimable#eprintAuthor';
  /** Author display name */
  name: string;
  /** ORCID identifier if available */
  orcid?: string;
  /** Institutional affiliation if available */
  affiliation?: string;
}

const hashEprintAuthor = 'eprintAuthor';

export function isEprintAuthor<V>(v: V) {
  return is$typed(v, id, hashEprintAuthor);
}

export function validateEprintAuthor<V>(v: V) {
  return validate<EprintAuthor & V>(v, id, hashEprintAuthor);
}
