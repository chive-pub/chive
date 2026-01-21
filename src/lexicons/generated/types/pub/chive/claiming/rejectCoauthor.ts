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
const id = 'pub.chive.claiming.rejectCoauthor';

export type QueryParams = {};

export interface InputSchema {
  /** ID of the co-author request to reject */
  requestId: number;
  /** Optional rejection reason */
  reason?: string;
}

export interface OutputSchema {
  /** Whether the rejection was successful */
  success: boolean;
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
  error?: 'AuthenticationRequired' | 'Forbidden' | 'NotFound';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
