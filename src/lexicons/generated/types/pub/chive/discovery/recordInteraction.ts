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
const id = 'pub.chive.discovery.recordInteraction';

export type QueryParams = {};

export interface InputSchema {
  /** AT-URI of the eprint */
  eprintUri: string;
  /** Type of interaction: view (viewed detail page), click (clicked recommendation), endorse (endorsed paper), dismiss (dismissed recommendation), claim (claimed authorship) */
  type: 'view' | 'click' | 'endorse' | 'dismiss' | 'claim' | (string & {});
  /** ID of the recommendation that led to this interaction */
  recommendationId?: string;
}

export interface OutputSchema {
  /** Whether the interaction was successfully recorded */
  recorded: boolean;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
  headers?: { [key: string]: string };
}

export interface HandlerError {
  status: number;
  message?: string;
  error?: 'AuthenticationRequired';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
