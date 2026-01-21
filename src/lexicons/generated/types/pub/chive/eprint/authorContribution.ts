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
const id = 'pub.chive.eprint.authorContribution';

/** Author affiliation with optional institution node reference */
export interface Affiliation {
  $type?: 'pub.chive.eprint.authorContribution#affiliation';
  /** Organization name (display fallback) */
  name: string;
  /** AT-URI to institution node in knowledge graph (subkind=institution) */
  institutionUri?: string;
  /** ROR ID (e.g., https://ror.org/02mhbdp94) */
  rorId?: string;
  /** Department or division within organization */
  department?: string;
}

const hashAffiliation = 'affiliation';

export function isAffiliation<V>(v: V) {
  return is$typed(v, id, hashAffiliation);
}

export function validateAffiliation<V>(v: V) {
  return validate<Affiliation & V>(v, id, hashAffiliation);
}

/** Author contribution with type and degree node references */
export interface Contribution {
  $type?: 'pub.chive.eprint.authorContribution#contribution';
  /** AT-URI to contribution type node (subkind=contribution-type) */
  typeUri: string;
  /** Contribution type slug for display fallback (e.g., 'conceptualization') */
  typeSlug?: string;
  /** AT-URI to contribution degree node (subkind=contribution-degree) */
  degreeUri?: string;
  /** Contribution degree slug for display fallback */
  degreeSlug: 'lead' | 'equal' | 'supporting' | (string & {});
}

const hashContribution = 'contribution';

export function isContribution<V>(v: V) {
  return is$typed(v, id, hashContribution);
}

export function validateContribution<V>(v: V) {
  return validate<Contribution & V>(v, id, hashContribution);
}

/** Author entry with full contribution metadata */
export interface Main {
  $type?: 'pub.chive.eprint.authorContribution';
  /** Author DID if they have an ATProto account */
  did?: string;
  /** Author display name (required even if DID present) */
  name: string;
  /** ORCID identifier (format: 0000-0000-0000-000X) */
  orcid?: string;
  /** Contact email (for external authors) */
  email?: string;
  /** Position in author list (1-indexed) */
  order: number;
  /** Author affiliations */
  affiliations?: Affiliation[];
  /** CRediT-based contribution types */
  contributions?: Contribution[];
  /** Whether this is a corresponding author */
  isCorrespondingAuthor: boolean;
  /** Whether this author is highlighted (co-first, co-last) */
  isHighlighted: boolean;
}

const hashMain = 'main';

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain);
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain);
}
