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
const id = 'pub.chive.graph.getCommunities';

export type QueryParams = {
  /** Community detection algorithm */
  algorithm: 'louvain' | 'label-propagation' | (string & {});
  /** Maximum communities to return */
  limit: number;
  /** Minimum community size */
  minSize: number;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Detected communities */
  communities: CommunityResult[];
  /** Algorithm used */
  algorithm: 'louvain' | 'label-propagation' | (string & {});
  /** Total communities found */
  total: number;
  /** Timestamp when generated */
  generatedAt: string;
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
}

export type HandlerOutput = HandlerError | HandlerSuccess;

/** Community detection result */
export interface CommunityResult {
  $type?: 'pub.chive.graph.getCommunities#communityResult';
  /** Community identifier */
  communityId: number;
  /** Member URIs */
  members: string[];
  /** Number of members */
  size: number;
  /** Representative members with labels */
  representativeMembers?: RepresentativeMember[];
}

const hashCommunityResult = 'communityResult';

export function isCommunityResult<V>(v: V) {
  return is$typed(v, id, hashCommunityResult);
}

export function validateCommunityResult<V>(v: V) {
  return validate<CommunityResult & V>(v, id, hashCommunityResult);
}

/** Representative community member */
export interface RepresentativeMember {
  $type?: 'pub.chive.graph.getCommunities#representativeMember';
  /** Member AT-URI */
  uri: string;
  /** Member label */
  label: string;
}

const hashRepresentativeMember = 'representativeMember';

export function isRepresentativeMember<V>(v: V) {
  return is$typed(v, id, hashRepresentativeMember);
}

export function validateRepresentativeMember<V>(v: V) {
  return validate<RepresentativeMember & V>(v, id, hashRepresentativeMember);
}
