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
const id = 'pub.chive.review.entityLink';

export interface Main {
  $type: 'pub.chive.review.entityLink';
  /** AT-URI of the eprint containing the linked text */
  eprintUri: string;
  target: TextSpanTarget;
  linkedEntity:
    | $Typed<GraphNodeLink>
    | $Typed<ExternalIdLink>
    | $Typed<AuthorLink>
    | $Typed<EprintLink>
    | { $type: string };
  /** Confidence score for the link (scaled by 1000 for 0.0-1.0 range) */
  confidence?: number;
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

/** W3C Web Annotation target for text spans */
export interface TextSpanTarget {
  $type?: 'pub.chive.review.entityLink#textSpanTarget';
  /** AT-URI of the source document */
  source: string;
  selector: TextQuoteSelector;
  refinedBy?: TextPositionSelector;
}

const hashTextSpanTarget = 'textSpanTarget';

export function isTextSpanTarget<V>(v: V) {
  return is$typed(v, id, hashTextSpanTarget);
}

export function validateTextSpanTarget<V>(v: V) {
  return validate<TextSpanTarget & V>(v, id, hashTextSpanTarget);
}

/** W3C TextQuoteSelector for resilient text matching */
export interface TextQuoteSelector {
  $type?: 'pub.chive.review.entityLink#textQuoteSelector';
  type: 'TextQuoteSelector';
  /** The exact text to match */
  exact: string;
  /** Text immediately before the match */
  prefix?: string;
  /** Text immediately after the match */
  suffix?: string;
}

const hashTextQuoteSelector = 'textQuoteSelector';

export function isTextQuoteSelector<V>(v: V) {
  return is$typed(v, id, hashTextQuoteSelector);
}

export function validateTextQuoteSelector<V>(v: V) {
  return validate<TextQuoteSelector & V>(v, id, hashTextQuoteSelector);
}

/** W3C TextPositionSelector for character-based targeting */
export interface TextPositionSelector {
  $type?: 'pub.chive.review.entityLink#textPositionSelector';
  type: 'TextPositionSelector';
  /** Start character offset */
  start: number;
  /** End character offset */
  end: number;
  /** Page number in the document */
  pageNumber: number;
}

const hashTextPositionSelector = 'textPositionSelector';

export function isTextPositionSelector<V>(v: V) {
  return is$typed(v, id, hashTextPositionSelector);
}

export function validateTextPositionSelector<V>(v: V) {
  return validate<TextPositionSelector & V>(v, id, hashTextPositionSelector);
}

/** Link to a knowledge graph node (type or object, with optional subkind) */
export interface GraphNodeLink {
  $type?: 'pub.chive.review.entityLink#graphNodeLink';
  type: 'graphNode';
  /** AT-URI of the graph node */
  uri: string;
  /** Node UUID identifier */
  id?: string;
  /** Human-readable slug (e.g., 'computer-science') */
  slug?: string;
  /** Display label for the node */
  label: string;
  /** Node kind: 'type' for classifications, 'object' for instances */
  kind: 'type' | 'object' | (string & {});
  /** Subkind slug (e.g., 'field', 'facet', 'institution', 'contribution-type') */
  subkind?: string;
  /** AT-URI of the subkind type node */
  subkindUri?: string;
}

const hashGraphNodeLink = 'graphNodeLink';

export function isGraphNodeLink<V>(v: V) {
  return is$typed(v, id, hashGraphNodeLink);
}

export function validateGraphNodeLink<V>(v: V) {
  return validate<GraphNodeLink & V>(v, id, hashGraphNodeLink);
}

/** Link to an external identifier (Wikidata, ROR, ORCID, etc.) */
export interface ExternalIdLink {
  $type?: 'pub.chive.review.entityLink#externalIdLink';
  type: 'externalId';
  /** External identifier system */
  system:
    | 'wikidata'
    | 'ror'
    | 'orcid'
    | 'isni'
    | 'viaf'
    | 'lcsh'
    | 'fast'
    | 'credit'
    | 'spdx'
    | 'fundref'
    | 'mesh'
    | 'aat'
    | 'gnd'
    | 'anzsrc'
    | 'arxiv'
    | 'doi'
    | 'pmid'
    | 'pmcid'
    | (string & {});
  /** Identifier value (e.g., Q42 for Wikidata) */
  identifier: string;
  /** Display label for the entity */
  label: string;
  /** Full URI for the external entity */
  uri?: string;
}

const hashExternalIdLink = 'externalIdLink';

export function isExternalIdLink<V>(v: V) {
  return is$typed(v, id, hashExternalIdLink);
}

export function validateExternalIdLink<V>(v: V) {
  return validate<ExternalIdLink & V>(v, id, hashExternalIdLink);
}

/** Link to an ATProto author */
export interface AuthorLink {
  $type?: 'pub.chive.review.entityLink#authorLink';
  type: 'author';
  /** Author's DID */
  did: string;
  /** Author's handle */
  handle?: string;
  /** Author's display name */
  displayName: string;
  /** Author's ORCID (if available) */
  orcid?: string;
}

const hashAuthorLink = 'authorLink';

export function isAuthorLink<V>(v: V) {
  return is$typed(v, id, hashAuthorLink);
}

export function validateAuthorLink<V>(v: V) {
  return validate<AuthorLink & V>(v, id, hashAuthorLink);
}

/** Link to another eprint/preprint */
export interface EprintLink {
  $type?: 'pub.chive.review.entityLink#eprintLink';
  type: 'eprint';
  /** AT-URI of the eprint */
  uri: string;
  /** Eprint title */
  title: string;
  /** DOI if available */
  doi?: string;
}

const hashEprintLink = 'eprintLink';

export function isEprintLink<V>(v: V) {
  return is$typed(v, id, hashEprintLink);
}

export function validateEprintLink<V>(v: V) {
  return validate<EprintLink & V>(v, id, hashEprintLink);
}
