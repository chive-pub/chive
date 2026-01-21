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
const id = 'pub.chive.graph.getRelations';

export type QueryParams = {};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Available relation types */
  relations: RelationType[];
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

/** Relation type definition */
export interface RelationType {
  $type?: 'pub.chive.graph.getRelations#relationType';
  /** Relation slug identifier */
  slug: string;
  /** Display label */
  label: string;
  /** Relation description */
  description?: string;
  /** Slug of inverse relation */
  inverseSlug?: string;
}

const hashRelationType = 'relationType';

export function isRelationType<V>(v: V) {
  return is$typed(v, id, hashRelationType);
}

export function validateRelationType<V>(v: V) {
  return validate<RelationType & V>(v, id, hashRelationType);
}
