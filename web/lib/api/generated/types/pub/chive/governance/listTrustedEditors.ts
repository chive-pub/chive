// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.governance.listTrustedEditors';

export type QueryParams = {
  /** Filter by role */
  role?:
    | 'community-member'
    | 'trusted-editor'
    | 'graph-editor'
    | 'domain-expert'
    | 'administrator'
    | (string & {});
  /** Maximum number of results to return */
  limit?: number;
  /** Pagination cursor for next page */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of trusted editors */
  editors: TrustedEditor[];
  /** Cursor for next page */
  cursor?: string;
  /** Total number of editors */
  total: number;
}

export interface CallOptions {
  signal?: AbortSignal;
  headers?: HeadersMap;
}

export interface Response {
  success: boolean;
  headers: HeadersMap;
  data: OutputSchema;
}

export class AuthenticationRequiredError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export class UnauthorizedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
    if (e.error === 'Unauthorized') return new UnauthorizedError(e);
  }

  return e;
}

/** Trusted editor record */
export interface TrustedEditor {
  $type?: 'pub.chive.governance.listTrustedEditors#trustedEditor';
  /** Editor DID */
  did: string;
  /** Editor handle */
  handle?: string;
  /** Editor display name */
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
  roleGrantedAt: number;
  /** DID of admin who granted the role */
  roleGrantedBy?: string;
  /** Whether editor has an active PDS delegation */
  hasDelegation: boolean;
  /** Delegation expiration timestamp */
  delegationExpiresAt?: number;
  /** Records created today under delegation */
  recordsCreatedToday?: number;
  /** Daily rate limit for delegation */
  dailyRateLimit?: number;
  metrics: ReputationMetrics;
}

const hashTrustedEditor = 'trustedEditor';

export function isTrustedEditor<V>(v: V) {
  return is$typed(v, id, hashTrustedEditor);
}

export function validateTrustedEditor<V>(v: V) {
  return validate<TrustedEditor & V>(v, id, hashTrustedEditor);
}

/** User reputation metrics for governance */
export interface ReputationMetrics {
  $type?: 'pub.chive.governance.listTrustedEditors#reputationMetrics';
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
