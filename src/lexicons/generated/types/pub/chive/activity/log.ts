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
const id = 'pub.chive.activity.log';

export type QueryParams = {};

export interface InputSchema {
  /** NSID of the record collection */
  collection: string;
  /** Record key (TID) */
  rkey: string;
  /** Action type */
  action: 'create' | 'update' | 'delete' | (string & {});
  /** Semantic activity category */
  category:
    | 'eprint_submit'
    | 'eprint_update'
    | 'eprint_delete'
    | 'review_create'
    | 'review_update'
    | 'review_delete'
    | 'endorsement_create'
    | 'endorsement_delete'
    | 'tag_create'
    | 'tag_delete'
    | 'profile_update'
    | 'proposal_create'
    | 'vote_create'
    | (string & {});
  /** Target record URI (e.g., the eprint being reviewed) */
  targetUri?: string;
  /** Target record title for display */
  targetTitle?: string;
  /** OpenTelemetry trace ID */
  traceId?: string;
  /** OpenTelemetry span ID */
  spanId?: string;
  /** UI context metadata as JSON string */
  uiContext?: string;
  /** Snapshot of record data being written as JSON string */
  recordSnapshot?: string;
}

export interface OutputSchema {
  /** Created activity ID (UUID) */
  activityId: string;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
  headers?: { [key: string]: string };
}

export interface HandlerError {
  status: number;
  message?: string;
  error?: 'AuthenticationRequired' | 'InvalidRequest';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
