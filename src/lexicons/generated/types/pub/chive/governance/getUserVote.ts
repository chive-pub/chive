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
const id = 'pub.chive.governance.getUserVote';

export type QueryParams = {
  /** Proposal identifier */
  proposalId: string;
  /** User DID */
  userDid: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  vote: $Typed<VoteView> | { $type: string };
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

/** View of a vote on a proposal */
export interface VoteView {
  $type?: 'pub.chive.governance.getUserVote#voteView';
  /** Vote identifier */
  id: string;
  /** Vote AT-URI */
  uri: string;
  /** Content identifier */
  cid: string;
  /** Proposal AT-URI */
  proposalUri: string;
  /** Voter DID */
  voterDid: string;
  /** Voter governance role */
  voterRole: 'community-member' | 'reviewer' | 'domain-expert' | 'administrator' | (string & {});
  /** Vote value */
  vote: 'approve' | 'reject' | 'abstain' | 'request-changes' | (string & {});
  /** Weighted vote value (scaled by 1000 for 0.0-1.0 range) */
  weight: number;
  /** Vote rationale */
  rationale?: string;
  /** Vote timestamp */
  createdAt: string;
}

const hashVoteView = 'voteView';

export function isVoteView<V>(v: V) {
  return is$typed(v, id, hashVoteView);
}

export function validateVoteView<V>(v: V) {
  return validate<VoteView & V>(v, id, hashVoteView);
}
