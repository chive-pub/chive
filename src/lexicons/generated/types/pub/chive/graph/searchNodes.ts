// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveGraphListNodes from './listNodes.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.graph.searchNodes';

export type QueryParams = {
  /** Search query */
  query: string;
  /** Filter by node kind */
  kind?: 'type' | 'object' | (string & {});
  /** Filter by subkind slug */
  subkind?: string;
  /** Filter by lifecycle status */
  status?: 'proposed' | 'provisional' | 'established' | 'deprecated' | (string & {});
  /** Maximum results to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Search results */
  nodes: PubChiveGraphListNodes.GraphNode[];
  /** Pagination cursor for next page */
  cursor?: string;
  /** Whether more results exist */
  hasMore: boolean;
  /** Total count of matching nodes */
  total: number;
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
