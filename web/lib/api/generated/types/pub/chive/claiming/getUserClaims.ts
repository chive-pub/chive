// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.claiming.getUserClaims';

export type QueryParams = {
  /** Filter by claim status */
  status?: 'pending' | 'approved' | 'rejected' | 'expired' | (string & {});
  /** Maximum number of claims to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  claims: ClaimWithPaper[];
  /** Pagination cursor for next page */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
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

export class AuthenticationRequiredError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src });
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AuthenticationRequired') return new AuthenticationRequiredError(e);
  }

  return e;
}

export interface ClaimWithPaper {
  $type?: 'pub.chive.claiming.getUserClaims#claimWithPaper';
  /** Claim request ID */
  id: number;
  /** ID of the imported eprint */
  importId: number;
  /** DID of the claimant */
  claimantDid: string;
  /** Claim status */
  status: 'pending' | 'approved' | 'rejected' | 'expired' | (string & {});
  /** AT-URI of the canonical record in user PDS */
  canonicalUri?: string;
  /** Reason for rejection if rejected */
  rejectionReason?: string;
  /** DID of the admin who reviewed */
  reviewedBy?: string;
  /** When the claim was reviewed */
  reviewedAt?: string;
  /** When the claim was created */
  createdAt: string;
  /** When the claim expires */
  expiresAt?: string;
  paper: PaperDetails;
}

const hashClaimWithPaper = 'claimWithPaper';

export function isClaimWithPaper<V>(v: V) {
  return is$typed(v, id, hashClaimWithPaper);
}

export function validateClaimWithPaper<V>(v: V) {
  return validate<ClaimWithPaper & V>(v, id, hashClaimWithPaper);
}

export interface PaperDetails {
  $type?: 'pub.chive.claiming.getUserClaims#paperDetails';
  /** Source system */
  source: string;
  /** Source-specific identifier */
  externalId: string;
  /** URL to the eprint */
  externalUrl: string;
  /** Eprint title */
  title: string;
  /** Author list */
  authors: ExternalAuthor[];
  /** Publication date */
  publicationDate?: string;
  /** DOI if assigned */
  doi?: string;
}

const hashPaperDetails = 'paperDetails';

export function isPaperDetails<V>(v: V) {
  return is$typed(v, id, hashPaperDetails);
}

export function validatePaperDetails<V>(v: V) {
  return validate<PaperDetails & V>(v, id, hashPaperDetails);
}

export interface ExternalAuthor {
  $type?: 'pub.chive.claiming.getUserClaims#externalAuthor';
  /** Author name */
  name: string;
  /** ORCID identifier */
  orcid?: string;
  /** Institution affiliation */
  affiliation?: string;
  /** Email address */
  email?: string;
}

const hashExternalAuthor = 'externalAuthor';

export function isExternalAuthor<V>(v: V) {
  return is$typed(v, id, hashExternalAuthor);
}

export function validateExternalAuthor<V>(v: V) {
  return validate<ExternalAuthor & V>(v, id, hashExternalAuthor);
}
