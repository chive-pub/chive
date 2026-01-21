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
const id = 'pub.chive.notification.listEndorsementsOnMyPapers';

export type QueryParams = {
  limit: number;
  cursor?: string;
  unreadOnly: boolean;
};
export type InputSchema = undefined;

export interface OutputSchema {
  notifications: EndorsementNotification[];
  cursor?: string;
  unreadCount?: number;
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

export interface EndorsementNotification {
  $type?: 'pub.chive.notification.listEndorsementsOnMyPapers#endorsementNotification';
  uri: string;
  eprintUri: string;
  eprintTitle?: string;
  endorser: AuthorRef;
  contributions: string[];
  comment?: string;
  createdAt: string;
  isRead?: boolean;
}

const hashEndorsementNotification = 'endorsementNotification';

export function isEndorsementNotification<V>(v: V) {
  return is$typed(v, id, hashEndorsementNotification);
}

export function validateEndorsementNotification<V>(v: V) {
  return validate<EndorsementNotification & V>(v, id, hashEndorsementNotification);
}

export interface AuthorRef {
  $type?: 'pub.chive.notification.listEndorsementsOnMyPapers#authorRef';
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
