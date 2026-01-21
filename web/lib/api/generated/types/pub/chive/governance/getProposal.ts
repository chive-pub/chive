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
const id = 'pub.chive.governance.getProposal';

export type QueryParams = {
  /** Proposal identifier */
  proposalId: string;
};
export type InputSchema = undefined;
export type OutputSchema = ProposalView;

export interface CallOptions {
  signal?: AbortSignal;
  headers?: HeadersMap;
}

export interface Response {
  success: boolean;
  headers: HeadersMap;
  data: OutputSchema;
}

export class NotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'NotFound') return new NotFoundError(e);
  }

  return e;
}

/** View of a governance proposal */
export interface ProposalView {
  $type?: 'pub.chive.governance.getProposal#proposalView';
  /** Proposal identifier */
  id: string;
  /** Proposal AT-URI */
  uri: string;
  /** Content identifier */
  cid: string;
  /** Target node URI (for update/merge/deprecate) */
  nodeUri?: string;
  /** Node label (from target node or proposed changes) */
  label?: string;
  /** Proposal type */
  type: 'create' | 'update' | 'merge' | 'deprecate' | (string & {});
  changes: ProposalChanges;
  /** Rationale for the proposal */
  rationale?: string;
  /** Current proposal status */
  status: 'pending' | 'approved' | 'rejected' | 'expired' | (string & {});
  /** DID of the proposer */
  proposedBy: string;
  /** Display name of the proposer */
  proposerName?: string;
  votes: VoteCounts;
  consensus: ConsensusProgress;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt?: string;
  /** Expiration timestamp */
  expiresAt?: string;
}

const hashProposalView = 'proposalView';

export function isProposalView<V>(v: V) {
  return is$typed(v, id, hashProposalView);
}

export function validateProposalView<V>(v: V) {
  return validate<ProposalView & V>(v, id, hashProposalView);
}

/** Proposed changes to a node */
export interface ProposalChanges {
  $type?: 'pub.chive.governance.getProposal#proposalChanges';
  /** Node label */
  label?: string;
  /** Alternate labels */
  alternateLabels?: string[];
  /** Node description */
  description?: string;
  /** External identifiers */
  externalIds?: ExternalId[];
  /** Additional metadata */
  metadata?: { [_ in string]: unknown };
  /** Node kind */
  kind?: 'type' | 'object' | (string & {});
  /** Node subkind */
  subkind?: string;
  /** Target URI for update/deprecate */
  targetUri?: string;
  /** Merge target URI */
  mergeIntoUri?: string;
}

const hashProposalChanges = 'proposalChanges';

export function isProposalChanges<V>(v: V) {
  return is$typed(v, id, hashProposalChanges);
}

export function validateProposalChanges<V>(v: V) {
  return validate<ProposalChanges & V>(v, id, hashProposalChanges);
}

export interface ExternalId {
  $type?: 'pub.chive.governance.getProposal#externalId';
  /** External system name */
  system: string;
  /** Identifier in external system */
  identifier: string;
  /** URI in external system */
  uri?: string;
  /** Match type */
  matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related' | (string & {});
}

const hashExternalId = 'externalId';

export function isExternalId<V>(v: V) {
  return is$typed(v, id, hashExternalId);
}

export function validateExternalId<V>(v: V) {
  return validate<ExternalId & V>(v, id, hashExternalId);
}

export interface VoteCounts {
  $type?: 'pub.chive.governance.getProposal#voteCounts';
  /** Number of approve votes */
  approve: number;
  /** Number of reject votes */
  reject: number;
  /** Number of abstain votes */
  abstain: number;
}

const hashVoteCounts = 'voteCounts';

export function isVoteCounts<V>(v: V) {
  return is$typed(v, id, hashVoteCounts);
}

export function validateVoteCounts<V>(v: V) {
  return validate<VoteCounts & V>(v, id, hashVoteCounts);
}

export interface ConsensusProgress {
  $type?: 'pub.chive.governance.getProposal#consensusProgress';
  /** Current approval percentage (0-100) */
  approvalPercentage: number;
  /** Required threshold for approval (0-100) */
  threshold: number;
  /** Number of voters */
  voterCount: number;
  /** Minimum votes required */
  minimumVotes: number;
  /** Whether consensus has been reached */
  consensusReached: boolean;
  /** Recommended status based on votes */
  recommendedStatus: 'approved' | 'rejected' | 'pending' | (string & {});
}

const hashConsensusProgress = 'consensusProgress';

export function isConsensusProgress<V>(v: V) {
  return is$typed(v, id, hashConsensusProgress);
}

export function validateConsensusProgress<V>(v: V) {
  return validate<ConsensusProgress & V>(v, id, hashConsensusProgress);
}
