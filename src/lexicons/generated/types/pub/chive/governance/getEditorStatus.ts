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
const id = 'pub.chive.governance.getEditorStatus';

export type QueryParams = {
  /** User DID (defaults to authenticated user) */
  did?: string;
};
export type InputSchema = undefined;
export type OutputSchema = EditorStatus;
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

/** Editor status and metrics */
export interface EditorStatus {
  $type?: 'pub.chive.governance.getEditorStatus#editorStatus';
  /** User DID */
  did: string;
  /** User display name */
  displayName?: string;
  /** Current governance role */
  role:
    | 'community-member'
    | 'trusted-editor'
    | 'graph-editor'
    | 'domain-expert'
    | 'administrator'
    | (string & {});
  /** Timestamp when role was granted */
  roleGrantedAt?: number;
  /** DID of admin who granted the role */
  roleGrantedBy?: string;
  /** Whether user has an active PDS delegation */
  hasDelegation: boolean;
  /** Delegation expiration timestamp */
  delegationExpiresAt?: number;
  /** Collections the delegation covers */
  delegationCollections?: string[];
  /** Records created today under delegation */
  recordsCreatedToday?: number;
  /** Daily rate limit for delegation */
  dailyRateLimit?: number;
  metrics: ReputationMetrics;
}

const hashEditorStatus = 'editorStatus';

export function isEditorStatus<V>(v: V) {
  return is$typed(v, id, hashEditorStatus);
}

export function validateEditorStatus<V>(v: V) {
  return validate<EditorStatus & V>(v, id, hashEditorStatus);
}

/** User reputation metrics for governance */
export interface ReputationMetrics {
  $type?: 'pub.chive.governance.getEditorStatus#reputationMetrics';
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
