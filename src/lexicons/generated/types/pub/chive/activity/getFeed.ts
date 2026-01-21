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
const id = 'pub.chive.activity.getFeed';

export type QueryParams = {
  /** Filter by activity category */
  category?:
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
  /** Filter by activity status */
  status?: 'pending' | 'confirmed' | 'failed' | 'timeout' | (string & {});
  /** Maximum number of results to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  activities: ActivityView[];
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
  error?: 'AuthenticationRequired';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** View of an activity log entry */
export interface ActivityView {
  $type?: 'pub.chive.activity.getFeed#activityView';
  /** Unique activity identifier (UUID) */
  id: string;
  /** DID of user who initiated the action */
  actorDid: string;
  /** NSID of the record collection */
  collection: string;
  /** Record key */
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
  /** Activity status */
  status: 'pending' | 'confirmed' | 'failed' | 'timeout' | (string & {});
  /** When user initiated the action */
  initiatedAt: string;
  /** When firehose confirmed the action */
  confirmedAt?: string;
  /** AT-URI from firehose confirmation */
  firehoseUri?: string;
  /** CID from firehose confirmation */
  firehoseCid?: string;
  /** Target record URI */
  targetUri?: string;
  /** Target record title for display */
  targetTitle?: string;
  /** Latency from UI initiation to firehose confirmation (milliseconds) */
  latencyMs?: number;
  /** Error code if activity failed */
  errorCode?: string;
  /** Error message if activity failed */
  errorMessage?: string;
}

const hashActivityView = 'activityView';

export function isActivityView<V>(v: V) {
  return is$typed(v, id, hashActivityView);
}

export function validateActivityView<V>(v: V) {
  return validate<ActivityView & V>(v, id, hashActivityView);
}
