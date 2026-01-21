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
const id = 'pub.chive.activity.getCorrelationMetrics';

export type QueryParams = {};
export type InputSchema = undefined;

export interface OutputSchema {
  metrics: MetricsEntry[];
  /** Current count of pending activities */
  pendingCount: number;
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
  error?: 'AuthenticationRequired' | 'AuthorizationRequired';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** Correlation metrics for a time bucket and category */
export interface MetricsEntry {
  $type?: 'pub.chive.activity.getCorrelationMetrics#metricsEntry';
  /** Hour bucket timestamp */
  hour: string;
  /** Activity category */
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
  /** Total activities in this bucket */
  total: number;
  /** Number of confirmed activities */
  confirmed: number;
  /** Number of failed activities */
  failed: number;
  /** Number of timed out activities */
  timeout: number;
  /** Number of pending activities */
  pending: number;
  /** Confirmation rate as percentage (0-100) */
  confirmationRatePct: number;
  /** Average latency in milliseconds */
  avgLatencyMs?: number;
  /** 95th percentile latency in milliseconds */
  p95LatencyMs?: number;
}

const hashMetricsEntry = 'metricsEntry';

export function isMetricsEntry<V>(v: V) {
  return is$typed(v, id, hashMetricsEntry);
}

export function validateMetricsEntry<V>(v: V) {
  return validate<MetricsEntry & V>(v, id, hashMetricsEntry);
}
