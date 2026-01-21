// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveGraphGetEdge from './getEdge.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.graph.listEdges';

export type QueryParams = {
  /** Filter by source node AT-URI */
  sourceUri?: string;
  /** Filter by target node AT-URI */
  targetUri?: string;
  /** Filter by relation type slug */
  relationSlug?: string;
  /** Filter by lifecycle status */
  status?: 'proposed' | 'established' | 'deprecated' | (string & {});
  /** Maximum results to return */
  limit: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of edges */
  edges: PubChiveGraphGetEdge.GraphEdge[];
  /** Pagination cursor for next page */
  cursor?: string;
  /** Whether more results exist */
  hasMore: boolean;
  /** Total count of matching edges */
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
