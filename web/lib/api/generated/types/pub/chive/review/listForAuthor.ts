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
const id = 'pub.chive.review.listForAuthor';

export type QueryParams = {
  /** DID of the reviewer */
  reviewerDid: string;
  /** Filter by W3C Web Annotation motivation */
  motivation?:
    | 'commenting'
    | 'highlighting'
    | 'questioning'
    | 'replying'
    | 'assessing'
    | 'bookmarking'
    | 'classifying'
    | 'describing'
    | 'editing'
    | 'linking'
    | 'moderating'
    | 'tagging'
    | (string & {});
  /** Only include inline annotations with text span targets */
  inlineOnly?: boolean;
  /** Maximum number of results to return */
  limit?: number;
  /** Pagination cursor for next page */
  cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
  /** List of reviews by the author */
  reviews: ReviewView[];
  /** Cursor for next page */
  cursor?: string;
  /** Whether more results are available */
  hasMore: boolean;
  /** Total number of reviews by this author */
  total?: number;
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

/** View of a review/comment */
export interface ReviewView {
  $type?: 'pub.chive.review.listForAuthor#reviewView';
  /** Review AT-URI */
  uri: string;
  /** Content identifier */
  cid: string;
  author: AuthorRef;
  /** AT-URI of the eprint being reviewed */
  eprintUri: string;
  /** Plain text content of the review */
  content: string;
  body?: AnnotationBody;
  target?: TextSpanTarget;
  /** W3C Web Annotation motivation */
  motivation:
    | 'commenting'
    | 'highlighting'
    | 'questioning'
    | 'replying'
    | 'assessing'
    | 'bookmarking'
    | 'classifying'
    | 'describing'
    | 'editing'
    | 'linking'
    | 'moderating'
    | 'tagging'
    | (string & {});
  /** Parent review URI for threaded replies */
  parentReviewUri?: string;
  /** Number of direct replies */
  replyCount: number;
  /** When the review was created */
  createdAt: string;
  /** When the review was indexed */
  indexedAt: string;
}

const hashReviewView = 'reviewView';

export function isReviewView<V>(v: V) {
  return is$typed(v, id, hashReviewView);
}

export function validateReviewView<V>(v: V) {
  return validate<ReviewView & V>(v, id, hashReviewView);
}

export interface AuthorRef {
  $type?: 'pub.chive.review.listForAuthor#authorRef';
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

const hashAuthorRef = 'authorRef';

export function isAuthorRef<V>(v: V) {
  return is$typed(v, id, hashAuthorRef);
}

export function validateAuthorRef<V>(v: V) {
  return validate<AuthorRef & V>(v, id, hashAuthorRef);
}

/** Rich text body with optional facets */
export interface AnnotationBody {
  $type?: 'pub.chive.review.listForAuthor#annotationBody';
  /** Plain text content */
  text: string;
  /** Rich text facets for mentions, links, and tags */
  facets?: RichTextFacet[];
}

const hashAnnotationBody = 'annotationBody';

export function isAnnotationBody<V>(v: V) {
  return is$typed(v, id, hashAnnotationBody);
}

export function validateAnnotationBody<V>(v: V) {
  return validate<AnnotationBody & V>(v, id, hashAnnotationBody);
}

export interface RichTextFacet {
  $type?: 'pub.chive.review.listForAuthor#richTextFacet';
  index: ByteSlice;
  features: ($Typed<MentionFacet> | $Typed<LinkFacet> | $Typed<TagFacet> | { $type: string })[];
}

const hashRichTextFacet = 'richTextFacet';

export function isRichTextFacet<V>(v: V) {
  return is$typed(v, id, hashRichTextFacet);
}

export function validateRichTextFacet<V>(v: V) {
  return validate<RichTextFacet & V>(v, id, hashRichTextFacet);
}

/** Byte slice for facet positioning */
export interface ByteSlice {
  $type?: 'pub.chive.review.listForAuthor#byteSlice';
  byteStart: number;
  byteEnd: number;
}

const hashByteSlice = 'byteSlice';

export function isByteSlice<V>(v: V) {
  return is$typed(v, id, hashByteSlice);
}

export function validateByteSlice<V>(v: V) {
  return validate<ByteSlice & V>(v, id, hashByteSlice);
}

export interface MentionFacet {
  $type?: 'pub.chive.review.listForAuthor#mentionFacet';
  $type?: 'app.bsky.richtext.facet#mention';
  did: string;
}

const hashMentionFacet = 'mentionFacet';

export function isMentionFacet<V>(v: V) {
  return is$typed(v, id, hashMentionFacet);
}

export function validateMentionFacet<V>(v: V) {
  return validate<MentionFacet & V>(v, id, hashMentionFacet);
}

export interface LinkFacet {
  $type?: 'pub.chive.review.listForAuthor#linkFacet';
  $type?: 'app.bsky.richtext.facet#link';
  uri: string;
}

const hashLinkFacet = 'linkFacet';

export function isLinkFacet<V>(v: V) {
  return is$typed(v, id, hashLinkFacet);
}

export function validateLinkFacet<V>(v: V) {
  return validate<LinkFacet & V>(v, id, hashLinkFacet);
}

export interface TagFacet {
  $type?: 'pub.chive.review.listForAuthor#tagFacet';
  $type?: 'app.bsky.richtext.facet#tag';
  tag: string;
}

const hashTagFacet = 'tagFacet';

export function isTagFacet<V>(v: V) {
  return is$typed(v, id, hashTagFacet);
}

export function validateTagFacet<V>(v: V) {
  return validate<TagFacet & V>(v, id, hashTagFacet);
}

/** Target text span for inline annotations (W3C Web Annotation compatible) */
export interface TextSpanTarget {
  $type?: 'pub.chive.review.listForAuthor#textSpanTarget';
  /** Eprint AT-URI */
  source: string;
  selector?: TextQuoteSelector;
  refinedBy?: TextPositionSelector;
  /** Page number (deprecated, use refinedBy.pageNumber) */
  page?: number;
}

const hashTextSpanTarget = 'textSpanTarget';

export function isTextSpanTarget<V>(v: V) {
  return is$typed(v, id, hashTextSpanTarget);
}

export function validateTextSpanTarget<V>(v: V) {
  return validate<TextSpanTarget & V>(v, id, hashTextSpanTarget);
}

/** W3C Text Quote Selector */
export interface TextQuoteSelector {
  $type?: 'pub.chive.review.listForAuthor#textQuoteSelector';
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
}

const hashTextQuoteSelector = 'textQuoteSelector';

export function isTextQuoteSelector<V>(v: V) {
  return is$typed(v, id, hashTextQuoteSelector);
}

export function validateTextQuoteSelector<V>(v: V) {
  return validate<TextQuoteSelector & V>(v, id, hashTextQuoteSelector);
}

/** W3C Text Position Selector with optional page info */
export interface TextPositionSelector {
  $type?: 'pub.chive.review.listForAuthor#textPositionSelector';
  type: 'TextPositionSelector';
  start: number;
  end: number;
  /** Page number in PDF */
  pageNumber?: number;
}

const hashTextPositionSelector = 'textPositionSelector';

export function isTextPositionSelector<V>(v: V) {
  return is$typed(v, id, hashTextPositionSelector);
}

export function validateTextPositionSelector<V>(v: V) {
  return validate<TextPositionSelector & V>(v, id, hashTextPositionSelector);
}
