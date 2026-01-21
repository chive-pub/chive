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
const id = 'pub.chive.notification.listReviewsOnMyPapers';

export type QueryParams = {
  /** Maximum results to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Only return unread notifications */
  unreadOnly?: boolean;
};
export type InputSchema = undefined;

export interface OutputSchema {
  notifications: ReviewNotification[];
  cursor?: string;
  unreadCount?: number;
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

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
  }

  return e;
}

export interface ReviewNotification {
  $type?: 'pub.chive.notification.listReviewsOnMyPapers#reviewNotification';
  /** Review AT-URI */
  uri: string;
  eprintUri: string;
  eprintTitle?: string;
  reviewer: AuthorRef;
  /** Preview of review content */
  preview?: string;
  createdAt: string;
  isRead?: boolean;
}

const hashReviewNotification = 'reviewNotification';

export function isReviewNotification<V>(v: V) {
  return is$typed(v, id, hashReviewNotification);
}

export function validateReviewNotification<V>(v: V) {
  return validate<ReviewNotification & V>(v, id, hashReviewNotification);
}

export interface AuthorRef {
  $type?: 'pub.chive.notification.listReviewsOnMyPapers#authorRef';
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
