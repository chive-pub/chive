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
const id = 'pub.chive.endorsement.getUserEndorsement';

export type QueryParams = {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** DID of the user */
  userDid: string;
};
export type InputSchema = undefined;
export type OutputSchema = EndorsementView;

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

/** View of an endorsement */
export interface EndorsementView {
  $type?: 'pub.chive.endorsement.getUserEndorsement#endorsementView';
  /** Endorsement AT-URI */
  uri: string;
  /** Content identifier */
  cid: string;
  /** Endorsed eprint AT-URI */
  eprintUri: string;
  endorser: AuthorRef;
  /** Contribution types being endorsed */
  contributions: (
    | 'methodological'
    | 'analytical'
    | 'theoretical'
    | 'empirical'
    | 'conceptual'
    | 'technical'
    | 'data'
    | 'replication'
    | 'reproducibility'
    | 'synthesis'
    | 'interdisciplinary'
    | 'pedagogical'
    | 'visualization'
    | 'societal-impact'
    | 'clinical'
    | (string & {})
  )[];
  /** Optional comment */
  comment?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt?: string;
}

const hashEndorsementView = 'endorsementView';

export function isEndorsementView<V>(v: V) {
  return is$typed(v, id, hashEndorsementView);
}

export function validateEndorsementView<V>(v: V) {
  return validate<EndorsementView & V>(v, id, hashEndorsementView);
}

export interface AuthorRef {
  $type?: 'pub.chive.endorsement.getUserEndorsement#authorRef';
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

const hashAuthorRef = 'authorRef';

export function isAuthorRef<V>(v: V) {
  return is$typed(v, id, hashAuthorRef);
}

export function validateAuthorRef<V>(v: V) {
  return validate<AuthorRef & V>(v, id, hashAuthorRef);
}
