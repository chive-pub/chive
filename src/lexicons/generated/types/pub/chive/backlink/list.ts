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
const id = 'pub.chive.backlink.list';

export type QueryParams = {
  /** AT-URI of the target eprint */
  targetUri: string;
  /** Filter by source type */
  sourceType?:
    | 'semble.collection'
    | 'leaflet.list'
    | 'whitewind.blog'
    | 'bluesky.post'
    | 'bluesky.embed'
    | 'other'
    | (string & {});
  /** Maximum number of backlinks to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of backlinks */
  backlinks: Backlink[];
  /** Pagination cursor for next page */
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
  error?: 'NotFound';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** Backlink record */
export interface Backlink {
  $type?: 'pub.chive.backlink.list#backlink';
  /** Backlink ID */
  id: number;
  /** AT-URI of the source record */
  sourceUri: string;
  /** Type of the source record */
  sourceType:
    | 'semble.collection'
    | 'leaflet.list'
    | 'whitewind.blog'
    | 'bluesky.post'
    | 'bluesky.embed'
    | 'other'
    | (string & {});
  /** AT-URI of the target eprint */
  targetUri: string;
  /** Optional context about the backlink */
  context?: string;
  /** Timestamp when the backlink was indexed */
  indexedAt: string;
  /** Whether the backlink has been deleted */
  deleted: boolean;
}

const hashBacklink = 'backlink';

export function isBacklink<V>(v: V) {
  return is$typed(v, id, hashBacklink);
}

export function validateBacklink<V>(v: V) {
  return validate<Backlink & V>(v, id, hashBacklink);
}
