// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveGraphListNodes from './listNodes.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.graph.getSubkinds';

export type QueryParams = {};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Available subkind type nodes */
  subkinds: PubChiveGraphListNodes.GraphNode[];
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

export function toKnownErr(e: any) {
  return e;
}
