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
const id = 'pub.chive.backlink.getCounts';

export type QueryParams = {
  /** AT-URI of the target eprint */
  targetUri: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Count of Semble collection backlinks */
  sembleCollections: number;
  /** Count of Leaflet list backlinks */
  leafletLists: number;
  /** Count of Whitewind blog backlinks */
  whitewindBlogs: number;
  /** Count of Bluesky post backlinks */
  blueskyPosts: number;
  /** Count of Bluesky embed backlinks */
  blueskyEmbeds: number;
  /** Count of other backlinks */
  other: number;
  /** Total count of all backlinks */
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
