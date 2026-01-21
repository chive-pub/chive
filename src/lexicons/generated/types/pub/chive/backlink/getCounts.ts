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
