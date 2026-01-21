// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveGraphEdge from './edge.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.graph.getEdge';

export type QueryParams = {
  /** Edge AT-URI */
  uri: string;
};
export type InputSchema = undefined;
export type OutputSchema = GraphEdge;
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

/** Graph edge response */
export interface GraphEdge {
  $type?: 'pub.chive.graph.getEdge#graphEdge';
  /** Edge UUID identifier */
  id: string;
  /** AT-URI of the edge */
  uri: string;
  /** Content identifier */
  cid?: string;
  /** AT-URI of source node */
  sourceUri: string;
  /** AT-URI of target node */
  targetUri: string;
  /** AT-URI of relation type node */
  relationUri?: string;
  /** Relation slug (broader, narrower, related, etc.) */
  relationSlug: string;
  /** Edge weight (scaled by 1000 for 0.0-1.0 range) */
  weight?: number;
  metadata?: PubChiveGraphEdge.EdgeMetadata;
  /** Edge lifecycle status */
  status: 'proposed' | 'established' | 'deprecated' | (string & {});
  /** AT-URI of creating proposal */
  proposalUri?: string;
  /** Creation timestamp */
  createdAt: string;
  /** DID of creator */
  createdBy?: string;
  /** Last update timestamp */
  updatedAt?: string;
}

const hashGraphEdge = 'graphEdge';

export function isGraphEdge<V>(v: V) {
  return is$typed(v, id, hashGraphEdge);
}

export function validateGraphEdge<V>(v: V) {
  return validate<GraphEdge & V>(v, id, hashGraphEdge);
}
