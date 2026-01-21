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
const id = 'pub.chive.tag.listForEprint';

export type QueryParams = {
  /** AT-URI of the eprint to list tags for */
  eprintUri: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Tags applied to the eprint */
  tags: UserTag[];
  /** TaxoFolk suggestions based on existing tags */
  suggestions?: TagSuggestion[];
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

/** A user-applied tag on an eprint */
export interface UserTag {
  $type?: 'pub.chive.tag.listForEprint#userTag';
  /** Tag AT-URI */
  uri: string;
  /** Content identifier */
  cid: string;
  /** Tagged eprint AT-URI */
  eprintUri: string;
  author: AuthorRef;
  /** Original display form of the tag */
  displayForm: string;
  /** Normalized form (lowercase, hyphenated) */
  normalizedForm: string;
  /** Creation timestamp */
  createdAt: string;
}

const hashUserTag = 'userTag';

export function isUserTag<V>(v: V) {
  return is$typed(v, id, hashUserTag);
}

export function validateUserTag<V>(v: V) {
  return validate<UserTag & V>(v, id, hashUserTag);
}

/** Reference to an author */
export interface AuthorRef {
  $type?: 'pub.chive.tag.listForEprint#authorRef';
  /** Author DID */
  did: string;
  /** Author handle */
  handle?: string;
  /** Display name */
  displayName?: string;
  /** Avatar URL */
  avatar?: string;
}

const hashAuthorRef = 'authorRef';

export function isAuthorRef<V>(v: V) {
  return is$typed(v, id, hashAuthorRef);
}

export function validateAuthorRef<V>(v: V) {
  return validate<AuthorRef & V>(v, id, hashAuthorRef);
}

/** A tag suggestion from the TaxoFolk system */
export interface TagSuggestion {
  $type?: 'pub.chive.tag.listForEprint#tagSuggestion';
  /** Suggested display form */
  displayForm: string;
  /** Normalized form of the suggestion */
  normalizedForm: string;
  /** Suggestion confidence (0-100, scaled from 0-1) */
  confidence: number;
  /** Source of the suggestion */
  source: 'cooccurrence' | 'authority' | 'facet' | (string & {});
  /** Term that triggered this suggestion */
  matchedTerm?: string;
}

const hashTagSuggestion = 'tagSuggestion';

export function isTagSuggestion<V>(v: V) {
  return is$typed(v, id, hashTagSuggestion);
}

export function validateTagSuggestion<V>(v: V) {
  return validate<TagSuggestion & V>(v, id, hashTagSuggestion);
}
