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
const id = 'pub.chive.claiming.completeClaim';

export type QueryParams = {
  /** ID of the claim request to complete */
  claimId: number;
  /** AT-URI of the canonical record created in user's PDS */
  canonicalUri: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** Whether the claim was successfully completed */
  success: boolean;
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
  error?: 'AuthenticationRequired' | 'ClaimNotFound' | 'Unauthorized';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
