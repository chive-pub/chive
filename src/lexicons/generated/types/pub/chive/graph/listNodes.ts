// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveGraphNode from './node.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.graph.listNodes';

export type QueryParams = {
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
  /** List of nodes */
  nodes: GraphNode[];
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

/** Graph node response */
export interface GraphNode {
  $type?: 'pub.chive.graph.listNodes#graphNode';
  /** Node UUID identifier */
  id: string;
  /** AT-URI of the node */
  uri: string;
  /** Content identifier */
  cid?: string;
  /** Node kind: type or object */
  kind: 'type' | 'object' | (string & {});
  /** Subkind slug (e.g., field, institution) */
  subkind?: string;
  /** AT-URI of the subkind type node */
  subkindUri?: string;
  /** Primary display label */
  label: string;
  /** Alternate labels/synonyms */
  alternateLabels?: string[];
  /** Detailed description */
  description?: string;
  /** External identifier mappings */
  externalIds?: PubChiveGraphNode.ExternalId[];
  metadata?: PubChiveGraphNode.NodeMetadata;
  /** Lifecycle status */
  status: 'proposed' | 'provisional' | 'established' | 'deprecated' | (string & {});
  /** AT-URI of superseding node */
  deprecatedBy?: string;
  /** AT-URI of creating proposal */
  proposalUri?: string;
  /** Creation timestamp */
  createdAt: string;
  /** DID of creator */
  createdBy?: string;
  /** Last update timestamp */
  updatedAt?: string;
}

const hashGraphNode = 'graphNode';

export function isGraphNode<V>(v: V) {
  return is$typed(v, id, hashGraphNode);
}

export function validateGraphNode<V>(v: V) {
  return validate<GraphNode & V>(v, id, hashGraphNode);
}
