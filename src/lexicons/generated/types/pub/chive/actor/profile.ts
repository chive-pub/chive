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
const id = 'pub.chive.actor.profile';

/** Institutional affiliation referencing an institution node */
export interface Affiliation {
  $type?: 'pub.chive.actor.profile#affiliation';
  /** AT-URI of institution node (subkind=institution) */
  institutionUri?: string;
  /** Organization name (display fallback if no institutionUri) */
  name: string;
  /** ROR ID (e.g., https://ror.org/02mhbdp94) for legacy/external data */
  rorId?: string;
}

const hashAffiliation = 'affiliation';

export function isAffiliation<V>(v: V) {
  return is$typed(v, id, hashAffiliation);
}

export function validateAffiliation<V>(v: V) {
  return validate<Affiliation & V>(v, id, hashAffiliation);
}

/** Research keyword referencing a topic node */
export interface Keyword {
  $type?: 'pub.chive.actor.profile#keyword';
  /** AT-URI of topic node (subkind=topic) */
  topicUri?: string;
  /** Keyword label (display fallback if no topicUri) */
  label: string;
  /** FAST subject heading ID for legacy/external data */
  fastId?: string;
  /** Wikidata entity ID (e.g., Q12345) for legacy/external data */
  wikidataId?: string;
}

const hashKeyword = 'keyword';

export function isKeyword<V>(v: V) {
  return is$typed(v, id, hashKeyword);
}

export function validateKeyword<V>(v: V) {
  return validate<Keyword & V>(v, id, hashKeyword);
}

export interface Main {
  $type: 'pub.chive.actor.profile';
  displayName?: string;
  bio?: string;
  avatar?: BlobRef;
  /** ORCID identifier */
  orcid?: string;
  /** Current institutional affiliations with optional ROR IDs */
  affiliations?: Affiliation[];
  /** AT-URIs of field nodes (subkind=field) */
  fieldUris?: string[];
  /** Alternative name forms for paper matching (e.g., maiden name, transliterations, initials like 'J. Smith') */
  nameVariants?: string[];
  /** Past institutional affiliations that may appear on older papers */
  previousAffiliations?: Affiliation[];
  /** Research topics and keywords with optional authority IDs */
  researchKeywords?: Keyword[];
  /** Semantic Scholar author ID */
  semanticScholarId?: string;
  /** OpenAlex author ID (e.g., A5023888391) */
  openAlexId?: string;
  /** Google Scholar profile ID */
  googleScholarId?: string;
  /** arXiv author identifier */
  arxivAuthorId?: string;
  /** OpenReview profile ID */
  openReviewId?: string;
  /** DBLP author identifier (e.g., homepages/s/JohnSmith) */
  dblpId?: string;
  /** Scopus author ID */
  scopusAuthorId?: string;
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
