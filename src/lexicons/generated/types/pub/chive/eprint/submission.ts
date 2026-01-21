// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
import { validate as _validate } from '../../../../lexicons.js';
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../../util.js';
import type * as PubChiveEprintAuthorContribution from './authorContribution.js';

const is$typed = _is$typed,
  validate = _validate;
const id = 'pub.chive.eprint.submission';

export interface Main {
  $type: 'pub.chive.eprint.submission';
  /** Eprint title */
  title: string;
  /** Rich abstract with text and node references */
  abstract: ($Typed<TextItem> | $Typed<NodeRefItem> | { $type: string })[];
  /** Plain text abstract for search indexing (auto-generated) */
  abstractPlainText?: string;
  /** Primary manuscript document (PDF, DOCX, HTML, Markdown, LaTeX, or Jupyter) */
  document: BlobRef;
  /** AT-URI to document format node (subkind=document-format) */
  documentFormatUri?: string;
  /** Document format slug for display fallback */
  documentFormatSlug?:
    | 'pdf'
    | 'docx'
    | 'html'
    | 'markdown'
    | 'latex'
    | 'jupyter'
    | 'odt'
    | 'rtf'
    | 'epub'
    | 'txt'
    | (string & {});
  /** Additional materials (appendices, data, code, figures) */
  supplementaryMaterials?: SupplementaryItem[];
  /** All authors with contributions, affiliations, and metadata */
  authors: PubChiveEprintAuthorContribution.Main[];
  /** DID of the human user who submitted this eprint */
  submittedBy: string;
  /** DID of the paper's own account (if paper has its own PDS) */
  paperDid?: string;
  /** Author-provided keywords */
  keywords?: string[];
  /** Field node references (subkind=field) */
  fieldUris?: string[];
  /** Topic node references (subkind=topic) */
  topicUris?: string[];
  /** Facet node references (subkind=facet) */
  facetUris?: string[];
  /** Version number (1-indexed) */
  version?: number;
  /** Previous version URI */
  previousVersion?: string;
  /** AT-URI to license node (subkind=license) */
  licenseUri?: string;
  /** SPDX license identifier for display fallback */
  licenseSlug: 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'CC0-1.0' | 'MIT' | 'Apache-2.0' | (string & {});
  /** AT-URI to publication status node (subkind=publication-status) */
  publicationStatusUri?: string;
  /** Publication status slug for display fallback */
  publicationStatusSlug:
    | 'preprint'
    | 'under_review'
    | 'revision_requested'
    | 'accepted'
    | 'in_press'
    | 'published'
    | 'retracted'
    | (string & {});
  /** AT-URI to paper type node (subkind=paper-type) */
  paperTypeUri?: string;
  /** Paper type slug for display fallback */
  paperTypeSlug?:
    | 'original-research'
    | 'review'
    | 'meta-analysis'
    | 'case-study'
    | 'commentary'
    | 'tutorial'
    | 'survey'
    | (string & {});
  publishedVersion?: PublishedVersion;
  /** Related eprints, datasets, software, and prior versions */
  relatedWorks?: RelatedWork[];
  externalIds?: ExternalIds;
  repositories?: Repositories;
  /** Funding sources and grants */
  funding?: FundingSource[];
  conferencePresentation?: ConferencePresentation;
  /** Creation timestamp */
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

/** A supplementary material item with metadata */
export interface SupplementaryItem {
  $type?: 'pub.chive.eprint.submission#supplementaryItem';
  /** Supplementary file blob reference */
  blob: BlobRef;
  /** User-provided label (e.g., 'Appendix A', 'Figure S1') */
  label: string;
  /** Description of the supplementary material */
  description?: string;
  /** AT-URI to supplementary category node (subkind=supplementary-category) */
  categoryUri?: string;
  /** Category slug for display fallback */
  categorySlug?:
    | 'appendix'
    | 'figure'
    | 'table'
    | 'dataset'
    | 'code'
    | 'notebook'
    | 'video'
    | 'audio'
    | 'presentation'
    | 'protocol'
    | 'questionnaire'
    | 'other'
    | (string & {});
  /** Auto-detected file format */
  detectedFormat?: string;
  /** Display order (1-indexed) */
  order?: number;
}

const hashSupplementaryItem = 'supplementaryItem';

export function isSupplementaryItem<V>(v: V) {
  return is$typed(v, id, hashSupplementaryItem);
}

export function validateSupplementaryItem<V>(v: V) {
  return validate<SupplementaryItem & V>(v, id, hashSupplementaryItem);
}

/** Link to the published version (Version of Record) */
export interface PublishedVersion {
  $type?: 'pub.chive.eprint.submission#publishedVersion';
  /** DOI of the published version (e.g., 10.1234/example) */
  doi?: string;
  /** URL to the published version */
  url?: string;
  /** Publication date */
  publishedAt?: string;
  /** Journal name */
  journal?: string;
  /** Journal abbreviation */
  journalAbbreviation?: string;
  /** Journal ISSN */
  journalIssn?: string;
  /** Publisher name */
  publisher?: string;
  /** Volume number */
  volume?: string;
  /** Issue number */
  issue?: string;
  /** Page range */
  pages?: string;
  /** Article number */
  articleNumber?: string;
  /** Electronic location ID for online-only journals */
  eLocationId?: string;
  /** Open access status */
  accessType?:
    | 'open_access'
    | 'green_oa'
    | 'gold_oa'
    | 'hybrid_oa'
    | 'bronze_oa'
    | 'closed'
    | (string & {});
  /** License URL */
  licenseUrl?: string;
}

const hashPublishedVersion = 'publishedVersion';

export function isPublishedVersion<V>(v: V) {
  return is$typed(v, id, hashPublishedVersion);
}

export function validatePublishedVersion<V>(v: V) {
  return validate<PublishedVersion & V>(v, id, hashPublishedVersion);
}

/** A related work with DataCite-compatible relation type */
export interface RelatedWork {
  $type?: 'pub.chive.eprint.submission#relatedWork';
  /** Identifier value */
  identifier: string;
  /** Type of identifier */
  identifierType:
    | 'doi'
    | 'arxiv'
    | 'pmid'
    | 'pmcid'
    | 'url'
    | 'urn'
    | 'handle'
    | 'isbn'
    | 'issn'
    | 'at-uri'
    | (string & {});
  /** DataCite-compatible relation type */
  relationType:
    | 'isPreprintOf'
    | 'hasPreprint'
    | 'isVersionOf'
    | 'hasVersion'
    | 'isNewVersionOf'
    | 'isPreviousVersionOf'
    | 'isPartOf'
    | 'hasPart'
    | 'references'
    | 'isReferencedBy'
    | 'isSupplementTo'
    | 'isSupplementedBy'
    | 'isContinuedBy'
    | 'continues'
    | 'isDocumentedBy'
    | 'documents'
    | 'isCompiledBy'
    | 'compiles'
    | 'isVariantFormOf'
    | 'isOriginalFormOf'
    | 'isIdenticalTo'
    | 'isReviewedBy'
    | 'reviews'
    | 'isDerivedFrom'
    | 'isSourceOf'
    | 'isRequiredBy'
    | 'requires'
    | 'isObsoletedBy'
    | 'obsoletes'
    | (string & {});
  /** Title of the related work */
  title?: string;
  /** Description of the relation */
  description?: string;
}

const hashRelatedWork = 'relatedWork';

export function isRelatedWork<V>(v: V) {
  return is$typed(v, id, hashRelatedWork);
}

export function validateRelatedWork<V>(v: V) {
  return validate<RelatedWork & V>(v, id, hashRelatedWork);
}

/** External persistent identifiers */
export interface ExternalIds {
  $type?: 'pub.chive.eprint.submission#externalIds';
  /** arXiv identifier */
  arxivId?: string;
  /** PubMed ID */
  pmid?: string;
  /** PubMed Central ID */
  pmcid?: string;
  /** SSRN identifier */
  ssrnId?: string;
  /** OSF identifier */
  osf?: string;
  /** Zenodo DOI */
  zenodoDoi?: string;
  /** OpenAlex identifier */
  openAlexId?: string;
  /** Semantic Scholar identifier */
  semanticScholarId?: string;
  /** CORE identifier */
  coreSid?: string;
  /** Microsoft Academic Graph ID (legacy) */
  magId?: string;
}

const hashExternalIds = 'externalIds';

export function isExternalIds<V>(v: V) {
  return is$typed(v, id, hashExternalIds);
}

export function validateExternalIds<V>(v: V) {
  return validate<ExternalIds & V>(v, id, hashExternalIds);
}

/** Linked code, data, and materials repositories */
export interface Repositories {
  $type?: 'pub.chive.eprint.submission#repositories';
  /** Code repositories */
  code?: CodeRepository[];
  /** Data repositories */
  data?: DataRepository[];
  preregistration?: Preregistration;
  /** Protocol links */
  protocols?: Protocol[];
  /** Physical materials, reagents, plasmids, etc. */
  materials?: Material[];
}

const hashRepositories = 'repositories';

export function isRepositories<V>(v: V) {
  return is$typed(v, id, hashRepositories);
}

export function validateRepositories<V>(v: V) {
  return validate<Repositories & V>(v, id, hashRepositories);
}

/** A code repository link */
export interface CodeRepository {
  $type?: 'pub.chive.eprint.submission#codeRepository';
  /** Repository URL */
  url?: string;
  /** AT-URI to platform node (subkind=platform-code) */
  platformUri?: string;
  /** Platform slug for display fallback */
  platformSlug?:
    | 'github'
    | 'gitlab'
    | 'bitbucket'
    | 'huggingface'
    | 'paperswithcode'
    | 'codeberg'
    | 'sourcehut'
    | 'software_heritage'
    | 'colab'
    | 'kaggle'
    | 'other'
    | (string & {});
  /** User-provided label */
  label?: string;
  /** Software Heritage archive URL */
  archiveUrl?: string;
  /** Software Heritage Identifier */
  swhid?: string;
}

const hashCodeRepository = 'codeRepository';

export function isCodeRepository<V>(v: V) {
  return is$typed(v, id, hashCodeRepository);
}

export function validateCodeRepository<V>(v: V) {
  return validate<CodeRepository & V>(v, id, hashCodeRepository);
}

/** A data repository link */
export interface DataRepository {
  $type?: 'pub.chive.eprint.submission#dataRepository';
  /** Repository URL */
  url?: string;
  /** Dataset DOI */
  doi?: string;
  /** AT-URI to platform node (subkind=platform-data) */
  platformUri?: string;
  /** Platform slug for display fallback */
  platformSlug?:
    | 'huggingface'
    | 'zenodo'
    | 'figshare'
    | 'dryad'
    | 'osf'
    | 'dataverse'
    | 'mendeley_data'
    | 'kaggle'
    | 'wandb'
    | 'other'
    | (string & {});
  /** User-provided label */
  label?: string;
  /** Data availability statement */
  accessStatement?: string;
}

const hashDataRepository = 'dataRepository';

export function isDataRepository<V>(v: V) {
  return is$typed(v, id, hashDataRepository);
}

export function validateDataRepository<V>(v: V) {
  return validate<DataRepository & V>(v, id, hashDataRepository);
}

/** Pre-registration or registered report link */
export interface Preregistration {
  $type?: 'pub.chive.eprint.submission#preregistration';
  /** Pre-registration URL */
  url?: string;
  /** AT-URI to platform node (subkind=platform-preregistration) */
  platformUri?: string;
  /** Platform slug for display fallback */
  platformSlug?: 'osf' | 'aspredicted' | 'clinicaltrials' | 'prospero' | 'other' | (string & {});
  /** Registration date */
  registrationDate?: string;
}

const hashPreregistration = 'preregistration';

export function isPreregistration<V>(v: V) {
  return is$typed(v, id, hashPreregistration);
}

export function validatePreregistration<V>(v: V) {
  return validate<Preregistration & V>(v, id, hashPreregistration);
}

/** A protocol link */
export interface Protocol {
  $type?: 'pub.chive.eprint.submission#protocol';
  /** Protocol URL */
  url?: string;
  /** Protocol DOI */
  doi?: string;
  /** AT-URI to platform node (subkind=platform-protocol) */
  platformUri?: string;
  /** Platform slug for display fallback */
  platformSlug?: 'protocols_io' | 'bio_protocol' | 'other' | (string & {});
}

const hashProtocol = 'protocol';

export function isProtocol<V>(v: V) {
  return is$typed(v, id, hashProtocol);
}

export function validateProtocol<V>(v: V) {
  return validate<Protocol & V>(v, id, hashProtocol);
}

/** A physical material, reagent, or plasmid */
export interface Material {
  $type?: 'pub.chive.eprint.submission#material';
  /** Material URL */
  url?: string;
  /** Research Resource Identifier */
  rrid?: string;
  /** User-provided label */
  label?: string;
}

const hashMaterial = 'material';

export function isMaterial<V>(v: V) {
  return is$typed(v, id, hashMaterial);
}

export function validateMaterial<V>(v: V) {
  return validate<Material & V>(v, id, hashMaterial);
}

/** A funding source */
export interface FundingSource {
  $type?: 'pub.chive.eprint.submission#fundingSource';
  /** Funder name */
  funderName?: string;
  /** AT-URI to funder institution node (subkind=institution) */
  funderUri?: string;
  /** CrossRef Funder Registry DOI */
  funderDoi?: string;
  /** ROR identifier */
  funderRor?: string;
  /** Grant number */
  grantNumber?: string;
  /** Grant title */
  grantTitle?: string;
  /** Grant URL */
  grantUrl?: string;
}

const hashFundingSource = 'fundingSource';

export function isFundingSource<V>(v: V) {
  return is$typed(v, id, hashFundingSource);
}

export function validateFundingSource<V>(v: V) {
  return validate<FundingSource & V>(v, id, hashFundingSource);
}

/** Conference where this work was presented */
export interface ConferencePresentation {
  $type?: 'pub.chive.eprint.submission#conferencePresentation';
  /** Conference name */
  conferenceName?: string;
  /** Conference acronym */
  conferenceAcronym?: string;
  /** AT-URI to conference/event node (subkind=event) */
  conferenceUri?: string;
  /** Conference website URL */
  conferenceUrl?: string;
  /** Conference location */
  conferenceLocation?: string;
  /** Presentation date */
  presentationDate?: string;
  /** AT-URI to presentation type node (subkind=presentation-type) */
  presentationTypeUri?: string;
  /** Presentation type slug for display fallback */
  presentationTypeSlug?:
    | 'oral'
    | 'poster'
    | 'keynote'
    | 'workshop'
    | 'demo'
    | 'other'
    | (string & {});
  /** Proceedings DOI */
  proceedingsDoi?: string;
}

const hashConferencePresentation = 'conferencePresentation';

export function isConferencePresentation<V>(v: V) {
  return is$typed(v, id, hashConferencePresentation);
}

export function validateConferencePresentation<V>(v: V) {
  return validate<ConferencePresentation & V>(v, id, hashConferencePresentation);
}

/** Plain text content item in rich abstract */
export interface TextItem {
  $type?: 'pub.chive.eprint.submission#textItem';
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

/** Reference to a knowledge graph node in rich abstract */
export interface NodeRefItem {
  $type?: 'pub.chive.eprint.submission#nodeRefItem';
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
