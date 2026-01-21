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
const id = 'pub.chive.governance.listElevationRequests';

export type QueryParams = {
  /** Maximum number of results to return */
  limit: number;
  /** Pagination cursor for next page */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of elevation requests */
  requests: ElevationRequest[];
  /** Cursor for next page */
  cursor?: string;
  /** Total number of requests */
  total: number;
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
  error?: 'AuthenticationRequired' | 'Unauthorized';
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** Elevation request record */
export interface ElevationRequest {
  $type?: 'pub.chive.governance.listElevationRequests#elevationRequest';
  /** Request identifier */
  id: string;
  /** Requester DID */
  did: string;
  /** Requester handle */
  handle?: string;
  /** Requester display name */
  displayName?: string;
  /** Role being requested */
  requestedRole: 'trusted-editor' | 'administrator' | (string & {});
  /** Current role */
  currentRole: 'community-member' | 'trusted-editor' | 'administrator' | (string & {});
  /** Request timestamp */
  requestedAt: string;
  metrics: ReputationMetrics;
  /** Admin verification notes */
  verificationNotes?: string;
}

const hashElevationRequest = 'elevationRequest';

export function isElevationRequest<V>(v: V) {
  return is$typed(v, id, hashElevationRequest);
}

export function validateElevationRequest<V>(v: V) {
  return validate<ElevationRequest & V>(v, id, hashElevationRequest);
}

/** User reputation metrics for governance */
export interface ReputationMetrics {
  $type?: 'pub.chive.governance.listElevationRequests#reputationMetrics';
  /** User DID */
  did: string;
  /** Account creation timestamp */
  accountCreatedAt: number;
  /** Account age in days */
  accountAgeDays: number;
  /** Total eprints authored */
  eprintCount: number;
  /** Eprints with substantial endorsements */
  wellEndorsedEprintCount: number;
  /** Total endorsements received */
  totalEndorsements: number;
  /** Governance proposals submitted */
  proposalCount: number;
  /** Votes cast */
  voteCount: number;
  /** Proposals that were approved */
  successfulProposals: number;
  /** Moderation warnings received */
  warningCount: number;
  /** Policy violations recorded */
  violationCount: number;
  /** Computed reputation score */
  reputationScore: number;
  /** Current governance role */
  role:
    | 'community-member'
    | 'trusted-editor'
    | 'graph-editor'
    | 'domain-expert'
    | 'administrator'
    | (string & {});
  /** Whether user meets trusted editor criteria */
  eligibleForTrustedEditor: boolean;
  /** List of missing eligibility criteria */
  missingCriteria: string[];
}

const hashReputationMetrics = 'reputationMetrics';

export function isReputationMetrics<V>(v: V) {
  return is$typed(v, id, hashReputationMetrics);
}

export function validateReputationMetrics<V>(v: V) {
  return validate<ReputationMetrics & V>(v, id, hashReputationMetrics);
}
