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
const id = 'pub.chive.graph.getHierarchy';

export type QueryParams = {
  /** Subkind to get hierarchy for (e.g., field) */
  subkind: string;
  /** Relation slug for hierarchy traversal */
  relationSlug?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Root nodes with children */
  roots: HierarchyItem[];
  /** Subkind of hierarchy */
  subkind: string;
  /** Relation used for hierarchy */
  relationSlug: string;
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

/** Hierarchy node with recursive children */
export interface HierarchyItem {
  $type?: 'pub.chive.graph.getHierarchy#hierarchyItem';
  node: PubChiveGraphListNodes.GraphNode;
  /** Child hierarchy items */
  children: HierarchyItem[];
  /** Depth in hierarchy (0 = root) */
  depth: number;
}

const hashHierarchyItem = 'hierarchyItem';

export function isHierarchyItem<V>(v: V) {
  return is$typed(v, id, hashHierarchyItem);
}

export function validateHierarchyItem<V>(v: V) {
  return validate<HierarchyItem & V>(v, id, hashHierarchyItem);
}
