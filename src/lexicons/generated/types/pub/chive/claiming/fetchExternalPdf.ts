// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import stream from 'node:stream';
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.claiming.fetchExternalPdf';

export type QueryParams = {
  /** External source identifier (e.g., arxiv, biorxiv, medrxiv) */
  source: string;
  /** Source-specific identifier for the eprint */
  externalId: string;
};
export type InputSchema = undefined;
export type HandlerInput = void;

export interface HandlerSuccess {
  encoding: 'application/pdf';
  body: Uint8Array | stream.Readable;
  headers?: { [key: string]: string };
}

export interface HandlerError {
  status: number;
  message?: string;
  error?:
    | 'AuthenticationRequired'
    | 'InvalidParameters'
    | 'EprintNotFound'
    | 'PdfNotAvailable'
    | 'DomainNotAllowed'
    | 'FetchFailed';
}

export type HandlerOutput = HandlerError | HandlerSuccess;
