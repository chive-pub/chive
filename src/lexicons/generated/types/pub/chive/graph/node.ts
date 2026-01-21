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
const id = 'pub.chive.graph.node';

export interface Main {
  $type: 'pub.chive.graph.node';
  /** UUID identifier (also used as rkey) */
  id: string;
  /** Human-readable URL-safe identifier (e.g., 'pdf', 'computer-science') */
  slug?: string;
  /** Node kind: 'type' for classifications/categories, 'object' for instances */
  kind: 'type' | 'object' | (string & {});
  /** Slug identifying the subkind (e.g., 'field', 'facet', 'institution') */
  subkind?: string;
  /** AT-URI of the subkind type node */
  subkindUri?: string;
  /** Primary display label */
  label: string;
  /** Alternate labels, synonyms, translations */
  alternateLabels?: string[];
  /** Detailed description or scope note */
  description?: string;
  /** External identifier mappings */
  externalIds?: ExternalId[];
  metadata?: NodeMetadata;
  /** Lifecycle status */
  status: 'proposed' | 'provisional' | 'established' | 'deprecated' | (string & {});
  /** AT-URI of the node that supersedes this one */
  deprecatedBy?: string;
  /** AT-URI of the proposal that created this node (null for seeded) */
  proposalUri?: string;
  createdAt: string;
  /** DID of creator or governance */
  createdBy?: string;
  updatedAt?: string;
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

/** External identifier mapping */
export interface ExternalId {
  $type?: 'pub.chive.graph.node#externalId';
  /** Identifier system */
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
    | (string & {});
  /** Identifier value */
  identifier: string;
  /** Full URI for the identifier */
  uri?: string;
  /** SKOS match type */
  matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related' | (string & {});
}

const hashExternalId = 'externalId';

export function isExternalId<V>(v: V) {
  return is$typed(v, id, hashExternalId);
}

export function validateExternalId<V>(v: V) {
  return validate<ExternalId & V>(v, id, hashExternalId);
}

/** Subkind-specific metadata fields */
export interface NodeMetadata {
  $type?: 'pub.chive.graph.node#nodeMetadata';
  /** ISO 3166-1 alpha-2 country code (for institutions) */
  country?: string;
  /** City name (for institutions) */
  city?: string;
  /** Official website URL */
  website?: string;
  /** Organization operational status (for institutions) */
  organizationStatus?: 'active' | 'merged' | 'inactive' | 'defunct' | (string & {});
  /** MIME types (for document-format) */
  mimeTypes?: string[];
  /** SPDX license identifier (for licenses) */
  spdxId?: string;
  /** Display order for UI sorting */
  displayOrder?: number;
  /** Slug of inverse relation (for relation types) */
  inverseSlug?: string;
}

const hashNodeMetadata = 'nodeMetadata';

export function isNodeMetadata<V>(v: V) {
  return is$typed(v, id, hashNodeMetadata);
}

export function validateNodeMetadata<V>(v: V) {
  return validate<NodeMetadata & V>(v, id, hashNodeMetadata);
}
