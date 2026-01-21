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
const id = 'pub.chive.review.comment';

export interface Main {
  $type: 'pub.chive.review.comment';
  /** Reviewed eprint URI */
  eprintUri: string;
  /** Rich body content with text and node references */
  body: ($Typed<TextItem> | $Typed<NodeRefItem> | $Typed<EprintRefItem> | { $type: string })[];
  target?: TextSpanTarget;
  /** AT-URI of motivation type node (subkind=motivation) */
  motivationUri?: string;
  /** Fallback motivation if motivationUri not available */
  motivationFallback?:
    | 'commenting'
    | 'questioning'
    | 'highlighting'
    | 'replying'
    | 'linking'
    | (string & {});
  /** Parent comment for threading */
  parentComment?: string;
  createdAt: string;
  [k: string]: unknown;
}

const hashMain = 'main';

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain);
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true);
}

export { type Main as Record, isMain as isRecord, validateMain as validateRecord };

/** Plain text content item */
export interface TextItem {
  $type?: 'pub.chive.review.comment#textItem';
  type: 'text';
  content: string;
}

const hashTextItem = 'textItem';

export function isTextItem<V>(v: V) {
  return is$typed(v, id, hashTextItem);
}

export function validateTextItem<V>(v: V) {
  return validate<TextItem & V>(v, id, hashTextItem);
}

/** Reference to a knowledge graph node */
export interface NodeRefItem {
  $type?: 'pub.chive.review.comment#nodeRefItem';
  type: 'nodeRef';
  /** AT-URI of the referenced node */
  uri: string;
  /** Display label (cached from node) */
  label?: string;
  /** Subkind slug for styling */
  subkind?: string;
}

const hashNodeRefItem = 'nodeRefItem';

export function isNodeRefItem<V>(v: V) {
  return is$typed(v, id, hashNodeRefItem);
}

export function validateNodeRefItem<V>(v: V) {
  return validate<NodeRefItem & V>(v, id, hashNodeRefItem);
}

/** Reference to another eprint */
export interface EprintRefItem {
  $type?: 'pub.chive.review.comment#eprintRefItem';
  type: 'eprintRef';
  /** AT-URI of the referenced eprint */
  uri: string;
  /** Eprint title (cached) */
  title?: string;
}

const hashEprintRefItem = 'eprintRefItem';

export function isEprintRefItem<V>(v: V) {
  return is$typed(v, id, hashEprintRefItem);
}

export function validateEprintRefItem<V>(v: V) {
  return validate<EprintRefItem & V>(v, id, hashEprintRefItem);
}

/** Target text span for inline annotations (W3C Web Annotation compatible) */
export interface TextSpanTarget {
  $type?: 'pub.chive.review.comment#textSpanTarget';
  /** AT-URI of specific eprint version */
  versionUri?: string;
  selector:
    | $Typed<TextQuoteSelector>
    | $Typed<TextPositionSelector>
    | $Typed<FragmentSelector>
    | { $type: string };
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
  $type?: 'pub.chive.review.comment#textQuoteSelector';
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

/** W3C Text Position Selector */
export interface TextPositionSelector {
  $type?: 'pub.chive.review.comment#textPositionSelector';
  type: 'TextPositionSelector';
  start: number;
  end: number;
}

const hashTextPositionSelector = 'textPositionSelector';

export function isTextPositionSelector<V>(v: V) {
  return is$typed(v, id, hashTextPositionSelector);
}

export function validateTextPositionSelector<V>(v: V) {
  return validate<TextPositionSelector & V>(v, id, hashTextPositionSelector);
}

/** W3C Fragment Selector */
export interface FragmentSelector {
  $type?: 'pub.chive.review.comment#fragmentSelector';
  type: 'FragmentSelector';
  /** Fragment identifier (e.g., page number, section ID) */
  value: string;
  /** Fragment syntax specification */
  conformsTo?: string;
}

const hashFragmentSelector = 'fragmentSelector';

export function isFragmentSelector<V>(v: V) {
  return is$typed(v, id, hashFragmentSelector);
}

export function validateFragmentSelector<V>(v: V) {
  return validate<FragmentSelector & V>(v, id, hashFragmentSelector);
}
