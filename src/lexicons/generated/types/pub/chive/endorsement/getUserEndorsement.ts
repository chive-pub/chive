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
const id = 'pub.chive.endorsement.getUserEndorsement';

export type QueryParams = {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** DID of the user */
  userDid: string;
};
export type InputSchema = undefined;
export type OutputSchema = EndorsementView;
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
