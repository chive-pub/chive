/**
 * ATProto record creation utilities for Chive.
 *
 * @remarks
 * Provides functions for creating ATProto records in user PDSes.
 * These utilities enforce ATProto compliance: user data lives in user PDSes,
 * and Chive AppView only indexes from the firehose.
 *
 * @see https://atproto.com/specs/record-key
 * @packageDocumentation
 */

import type { Agent } from '@atproto/api';
import type { BlobRef } from '@atproto/lexicon';
import type {
  PreprintFormData,
  AuthorRef,
  FieldNodeRef,
  FacetValue,
  ExternalLink,
  FundingSource,
} from '../schemas/preprint';
import type { FieldProposal, Vote, ExternalMapping, Reference } from '../schemas/governance';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of creating an ATProto record.
 */
export interface CreateRecordResult {
  /** AT-URI of the created record */
  uri: string;
  /** CID of the created record */
  cid: string;
}

/**
 * Result of uploading a blob.
 */
export interface UploadBlobResult {
  /** Blob reference for use in records */
  blobRef: BlobRef;
  /** Size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

/**
 * Preprint record as stored in ATProto.
 */
export interface PreprintRecord {
  [key: string]: unknown;
  $type: 'pub.chive.preprint.submission';
  title: string;
  abstract: string;
  authors: AuthorRef[];
  document: BlobRef;
  fieldNodes: FieldNodeRef[];
  createdAt: string;
  supplementaryMaterials?: Array<{
    file: BlobRef;
    description: string;
    type?: string;
  }>;
  facets?: FacetValue[];
  keywords?: string[];
  license?: string;
  doi?: string;
  previousVersion?: { uri: string; cid: string };
  externalLinks?: ExternalLink[];
  fundingInfo?: FundingSource[];
  conflictOfInterest?: string;
  preregistration?: string;
}

/**
 * Field proposal record as stored in ATProto.
 */
export interface FieldProposalRecord {
  [key: string]: unknown;
  $type: 'pub.chive.graph.fieldProposal';
  fieldName: string;
  description: string;
  proposalType: 'create' | 'modify' | 'merge' | 'deprecate';
  createdAt: string;
  alternateNames?: string[];
  fieldType?: string;
  parentFieldUri?: string;
  existingFieldUri?: string;
  mergeTargetUri?: string;
  externalMappings?: ExternalMapping[];
  rationale?: string;
  references?: Reference[];
  discussionUri?: string;
}

/**
 * Vote record as stored in ATProto.
 */
export interface VoteRecord {
  [key: string]: unknown;
  $type: 'pub.chive.graph.vote';
  proposalUri: string;
  vote: 'approve' | 'reject' | 'abstain' | 'request-changes';
  rationale?: string;
  createdAt: string;
}

// =============================================================================
// BLOB UPLOAD
// =============================================================================

/**
 * Get the authenticated DID from an agent.
 *
 * @param agent - ATProto Agent
 * @returns User's DID or undefined if not authenticated
 */
function getAgentDid(agent: Agent): string | undefined {
  // The Agent class exposes did as a getter that returns session?.did
  // Use type assertion to access it since types may vary across versions
  return (agent as unknown as { did?: string }).did;
}

/**
 * Upload a file blob to the user's PDS.
 *
 * @remarks
 * Uploads the file to the authenticated user's PDS.
 * Returns a BlobRef that can be used in ATProto records.
 *
 * @param agent - Authenticated ATProto Agent
 * @param file - File to upload
 * @returns Upload result with BlobRef
 *
 * @throws Error if agent is not authenticated
 * @throws Error if upload fails
 *
 * @example
 * ```typescript
 * const agent = useAgent();
 * if (!agent) throw new Error('Not authenticated');
 *
 * const result = await uploadBlob(agent, pdfFile);
 * console.log('Uploaded:', result.blobRef);
 * ```
 */
export async function uploadBlob(agent: Agent, file: File): Promise<UploadBlobResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const response = await agent.uploadBlob(uint8Array, {
    encoding: file.type || 'application/octet-stream',
  });

  return {
    blobRef: response.data.blob,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
}

/**
 * Upload a PDF document to the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param file - PDF file to upload
 * @returns Upload result with BlobRef
 *
 * @throws Error if file is not a PDF
 *
 * @example
 * ```typescript
 * const result = await uploadPdfDocument(agent, pdfFile);
 * // Use result.blobRef in preprint record
 * ```
 */
export async function uploadPdfDocument(agent: Agent, file: File): Promise<UploadBlobResult> {
  if (file.type !== 'application/pdf') {
    throw new Error('File must be a PDF');
  }

  return uploadBlob(agent, file);
}

// =============================================================================
// PREPRINT RECORD CREATION
// =============================================================================

/**
 * Create a preprint submission record in the user's PDS.
 *
 * @remarks
 * This is the primary function for submitting preprints. It:
 * 1. Uploads the PDF document to the user's PDS
 * 2. Uploads any supplementary materials
 * 3. Creates the preprint record with blob references
 *
 * The record is created in the user's PDS, NOT in Chive's storage.
 * Chive will index this record when it appears on the firehose.
 *
 * @param agent - Authenticated ATProto Agent
 * @param data - Form data with files and metadata
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if PDF upload fails
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * const agent = useAgent();
 * if (!agent) throw new Error('Not authenticated');
 *
 * const result = await createPreprintRecord(agent, {
 *   pdfFile: myPdfFile,
 *   title: 'My Research Paper',
 *   abstract: 'This paper presents...',
 *   authors: [{ did: agent.session.did, order: 1, name: 'Alice' }],
 *   fieldNodes: [{ uri: 'at://did:plc:governance/pub.chive.graph.field/ml' }],
 * });
 *
 * console.log('Published at:', result.uri);
 * ```
 */
export async function createPreprintRecord(
  agent: Agent,
  data: PreprintFormData
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  // 1. Upload PDF document
  const pdfUpload = await uploadPdfDocument(agent, data.pdfFile);

  // 2. Upload supplementary materials (if any)
  const supplementaryBlobs: Array<{
    file: BlobRef;
    description: string;
    type?: string;
  }> = [];

  if (data.supplementaryFiles && data.supplementaryFiles.length > 0) {
    for (const supplementary of data.supplementaryFiles) {
      const upload = await uploadBlob(agent, supplementary.file);
      supplementaryBlobs.push({
        file: upload.blobRef,
        description: supplementary.description,
        type: supplementary.type,
      });
    }
  }

  // 3. Build the record
  const record: PreprintRecord = {
    $type: 'pub.chive.preprint.submission',
    title: data.title,
    abstract: data.abstract,
    authors: data.authors,
    document: pdfUpload.blobRef,
    fieldNodes: data.fieldNodes,
    createdAt: new Date().toISOString(),
  };

  // Add optional fields
  if (supplementaryBlobs.length > 0) {
    record.supplementaryMaterials = supplementaryBlobs;
  }
  if (data.facets && data.facets.length > 0) {
    record.facets = data.facets;
  }
  if (data.keywords && data.keywords.length > 0) {
    record.keywords = data.keywords;
  }
  if (data.license) {
    record.license = data.license;
  }
  if (data.doi) {
    record.doi = data.doi;
  }
  if (data.preregistration) {
    record.preregistration = data.preregistration;
  }
  if (data.conflictOfInterest) {
    record.conflictOfInterest = data.conflictOfInterest;
  }
  if (data.externalLinks && data.externalLinks.length > 0) {
    record.externalLinks = data.externalLinks;
  }
  if (data.fundingInfo && data.fundingInfo.length > 0) {
    record.fundingInfo = data.fundingInfo;
  }

  // 4. Create the record in user's PDS
  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.preprint.submission',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// GOVERNANCE RECORD CREATION
// =============================================================================

/**
 * Create a field proposal record in the user's PDS.
 *
 * @remarks
 * Creates a governance proposal for knowledge graph changes.
 * The proposal is stored in the user's PDS and will be indexed by Chive.
 * Community members can then vote on the proposal.
 *
 * @param agent - Authenticated ATProto Agent
 * @param data - Proposal data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * const result = await createFieldProposalRecord(agent, {
 *   fieldName: 'Quantum Machine Learning',
 *   description: 'Intersection of quantum computing and ML...',
 *   proposalType: 'create',
 *   rationale: 'This field has grown significantly...',
 * });
 * ```
 */
export async function createFieldProposalRecord(
  agent: Agent,
  data: Omit<FieldProposal, 'createdAt'>
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: FieldProposalRecord = {
    $type: 'pub.chive.graph.fieldProposal',
    fieldName: data.fieldName,
    description: data.description,
    proposalType: data.proposalType,
    createdAt: new Date().toISOString(),
  };

  // Add optional fields
  if (data.alternateNames && data.alternateNames.length > 0) {
    record.alternateNames = data.alternateNames;
  }
  if (data.fieldType) {
    record.fieldType = data.fieldType;
  }
  if (data.parentFieldUri) {
    record.parentFieldUri = data.parentFieldUri;
  }
  if (data.existingFieldUri) {
    record.existingFieldUri = data.existingFieldUri;
  }
  if (data.mergeTargetUri) {
    record.mergeTargetUri = data.mergeTargetUri;
  }
  if (data.externalMappings && data.externalMappings.length > 0) {
    record.externalMappings = data.externalMappings;
  }
  if (data.rationale) {
    record.rationale = data.rationale;
  }
  if (data.references && data.references.length > 0) {
    record.references = data.references;
  }
  if (data.discussionUri) {
    record.discussionUri = data.discussionUri;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.graph.fieldProposal',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Create a vote record in the user's PDS.
 *
 * @remarks
 * Records a vote on a governance proposal.
 * The vote is stored in the voter's PDS and indexed by Chive for tallying.
 *
 * @param agent - Authenticated ATProto Agent
 * @param data - Vote data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * const result = await createVoteRecord(agent, {
 *   proposalUri: 'at://did:plc:abc/pub.chive.graph.fieldProposal/123',
 *   vote: 'approve',
 *   rationale: 'This field is well-defined and needed.',
 * });
 * ```
 */
export async function createVoteRecord(
  agent: Agent,
  data: Omit<Vote, 'createdAt'>
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: VoteRecord = {
    $type: 'pub.chive.graph.vote',
    proposalUri: data.proposalUri,
    vote: data.vote,
    createdAt: new Date().toISOString(),
  };

  if (data.rationale) {
    record.rationale = data.rationale;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.graph.vote',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// RECORD DELETION
// =============================================================================

/**
 * Delete a record from the user's PDS.
 *
 * @remarks
 * Users can delete their own records. This removes the record from their PDS.
 * Chive will process the deletion from the firehose and update its index.
 *
 * @param agent - Authenticated ATProto Agent
 * @param uri - AT-URI of the record to delete
 * @returns Promise that resolves when deletion is complete
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 * @throws Error if deletion fails
 *
 * @example
 * ```typescript
 * await deleteRecord(agent, 'at://did:plc:abc/pub.chive.preprint.submission/123');
 * ```
 */
export async function deleteRecord(agent: Agent, uri: string): Promise<void> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  // Parse AT-URI to extract repo, collection, and rkey
  const match = /^at:\/\/(did:[^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) {
    throw new Error('Invalid AT-URI format');
  }

  const [, repo, collection, rkey] = match;

  // Verify the record belongs to the authenticated user
  if (repo !== did) {
    throw new Error('Cannot delete records belonging to other users');
  }

  await agent.com.atproto.repo.deleteRecord({
    repo,
    collection,
    rkey,
  });
}

// =============================================================================
// TAG RECORD CREATION
// =============================================================================

/**
 * User tag record as stored in ATProto.
 */
export interface UserTagRecord {
  [key: string]: unknown;
  $type: 'pub.chive.preprint.userTag';
  preprintUri: string;
  tag: string;
  createdAt: string;
}

/**
 * Input for creating a user tag.
 */
export interface CreateTagInput {
  preprintUri: string;
  displayForm: string;
}

/**
 * Create a user tag record in the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Tag data
 * @returns Created record result
 *
 * @example
 * ```typescript
 * const result = await createTagRecord(agent, {
 *   preprintUri: 'at://did:plc:abc/pub.chive.preprint.submission/123',
 *   displayForm: 'machine learning',
 * });
 * ```
 */
export async function createTagRecord(
  agent: Agent,
  input: CreateTagInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: UserTagRecord = {
    $type: 'pub.chive.preprint.userTag',
    preprintUri: input.preprintUri,
    tag: input.displayForm,
    createdAt: new Date().toISOString(),
  };

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.preprint.userTag',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// ENDORSEMENT RECORD CREATION
// =============================================================================

/**
 * Endorsement record as stored in ATProto.
 */
export interface EndorsementRecord {
  [key: string]: unknown;
  $type: 'pub.chive.review.endorsement';
  preprintUri: string;
  contributions: string[];
  comment?: string;
  createdAt: string;
}

/**
 * Input for creating an endorsement.
 */
export interface CreateEndorsementInput {
  preprintUri: string;
  contributions: string[];
  comment?: string;
}

/**
 * Create an endorsement record in the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Endorsement data
 * @returns Created record result
 */
export async function createEndorsementRecord(
  agent: Agent,
  input: CreateEndorsementInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: EndorsementRecord = {
    $type: 'pub.chive.review.endorsement',
    preprintUri: input.preprintUri,
    contributions: input.contributions,
    createdAt: new Date().toISOString(),
  };

  if (input.comment) {
    record.comment = input.comment;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.review.endorsement',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Input for updating an endorsement.
 */
export interface UpdateEndorsementInput {
  uri: string;
  contributions: string[];
  comment?: string;
}

/**
 * Update an endorsement record in the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Updated endorsement data
 * @returns Updated record result
 */
export async function updateEndorsementRecord(
  agent: Agent,
  input: UpdateEndorsementInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(input.uri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot update records belonging to other users');
  }

  // First get the existing record to preserve preprintUri
  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.review.endorsement',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as EndorsementRecord;

  const record: EndorsementRecord = {
    $type: 'pub.chive.review.endorsement',
    preprintUri: existing.preprintUri,
    contributions: input.contributions,
    createdAt: existing.createdAt,
  };

  if (input.comment) {
    record.comment = input.comment;
  }

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.review.endorsement',
    rkey: parsed.rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// REVIEW RECORD CREATION
// =============================================================================

/**
 * Review comment record as stored in ATProto.
 */
export interface ReviewCommentRecord {
  [key: string]: unknown;
  $type: 'pub.chive.review.comment';
  preprintUri: string;
  content: string;
  lineNumber?: number;
  parentComment?: string;
  createdAt: string;
}

/**
 * Input for creating a review.
 */
export interface CreateReviewInput {
  preprintUri: string;
  content: string;
  lineNumber?: number;
  parentReviewUri?: string;
}

/**
 * Create a review comment record in the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Review data
 * @returns Created record result
 */
export async function createReviewRecord(
  agent: Agent,
  input: CreateReviewInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: ReviewCommentRecord = {
    $type: 'pub.chive.review.comment',
    preprintUri: input.preprintUri,
    content: input.content,
    createdAt: new Date().toISOString(),
  };

  if (input.lineNumber !== undefined) {
    record.lineNumber = input.lineNumber;
  }
  if (input.parentReviewUri) {
    record.parentComment = input.parentReviewUri;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.review.comment',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// PROFILE RECORD CREATION/UPDATE
// =============================================================================

/**
 * Chive profile record as stored in ATProto.
 */
export interface ChiveProfileRecord {
  [key: string]: unknown;
  $type: 'pub.chive.actor.profile';
  displayName?: string;
  bio?: string;
  orcid?: string;
  affiliations?: Array<{ name: string; rorId?: string }>;
  fields?: string[];
  nameVariants?: string[];
  previousAffiliations?: Array<{ name: string; rorId?: string }>;
  researchKeywords?: Array<{ label: string; fastId?: string; wikidataId?: string }>;
  semanticScholarId?: string;
  openAlexId?: string;
  googleScholarId?: string;
  arxivAuthorId?: string;
  openReviewId?: string;
  dblpId?: string;
  scopusAuthorId?: string;
}

/**
 * Input for updating a Chive profile.
 */
export interface UpdateChiveProfileInput {
  displayName?: string;
  bio?: string;
  orcid?: string | null;
  affiliations?: Array<{ name: string; rorId?: string }>;
  fields?: string[];
  nameVariants?: string[];
  previousAffiliations?: Array<{ name: string; rorId?: string }>;
  researchKeywords?: Array<{ label: string; fastId?: string; wikidataId?: string }>;
  semanticScholarId?: string | null;
  openAlexId?: string | null;
  googleScholarId?: string | null;
  arxivAuthorId?: string | null;
  openReviewId?: string | null;
  dblpId?: string | null;
  scopusAuthorId?: string | null;
}

/**
 * Create or update the user's Chive profile in their PDS.
 *
 * @remarks
 * Uses putRecord with 'self' as the rkey (ATProto convention for profile records).
 * This creates the record if it doesn't exist, or updates it if it does.
 *
 * @param agent - Authenticated ATProto Agent
 * @param data - Profile data
 * @returns Created/updated record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * const agent = getCurrentAgent();
 * if (!agent) throw new Error('Not authenticated');
 *
 * const result = await updateChiveProfileRecord(agent, {
 *   displayName: 'Dr. Jane Smith',
 *   orcid: '0000-0002-1825-0097',
 *   affiliations: [{ name: 'MIT', rorId: 'https://ror.org/042nb2s44' }],
 * });
 * ```
 */
export async function updateChiveProfileRecord(
  agent: Agent,
  data: UpdateChiveProfileInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  // Build the record (only include non-null/non-undefined fields)
  const record: ChiveProfileRecord = {
    $type: 'pub.chive.actor.profile',
  };

  if (data.displayName) record.displayName = data.displayName;
  if (data.bio) record.bio = data.bio;
  if (data.orcid) record.orcid = data.orcid;
  if (data.affiliations?.length) record.affiliations = data.affiliations;
  if (data.fields?.length) record.fields = data.fields;
  if (data.nameVariants?.length) record.nameVariants = data.nameVariants;
  if (data.previousAffiliations?.length) record.previousAffiliations = data.previousAffiliations;
  if (data.researchKeywords?.length) record.researchKeywords = data.researchKeywords;
  if (data.semanticScholarId) record.semanticScholarId = data.semanticScholarId;
  if (data.openAlexId) record.openAlexId = data.openAlexId;
  if (data.googleScholarId) record.googleScholarId = data.googleScholarId;
  if (data.arxivAuthorId) record.arxivAuthorId = data.arxivAuthorId;
  if (data.openReviewId) record.openReviewId = data.openReviewId;
  if (data.dblpId) record.dblpId = data.dblpId;
  if (data.scopusAuthorId) record.scopusAuthorId = data.scopusAuthorId;

  // Use putRecord with 'self' as rkey (ATProto convention for profile records)
  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.actor.profile',
    rkey: 'self',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Check if the agent is authenticated and ready for record operations.
 *
 * @param agent - ATProto Agent or null
 * @returns True if agent is authenticated
 */
export function isAgentAuthenticated(agent: Agent | null): agent is Agent {
  return agent !== null && getAgentDid(agent) !== undefined;
}

/**
 * Get the authenticated user's DID.
 *
 * @param agent - Authenticated ATProto Agent
 * @returns User's DID
 *
 * @throws Error if agent is not authenticated
 */
export function getAuthenticatedDid(agent: Agent): string {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }
  return did;
}

/**
 * Build an AT-URI from components.
 *
 * @param did - User's DID
 * @param collection - Record collection (e.g., 'pub.chive.preprint.submission')
 * @param rkey - Record key
 * @returns AT-URI string
 *
 * @example
 * ```typescript
 * const uri = buildAtUri('did:plc:abc', 'pub.chive.preprint.submission', '123');
 * // 'at://did:plc:abc/pub.chive.preprint.submission/123'
 * ```
 */
export function buildAtUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

/**
 * Parse an AT-URI into components.
 *
 * @param uri - AT-URI string
 * @returns Parsed components or null if invalid
 *
 * @example
 * ```typescript
 * const parts = parseAtUri('at://did:plc:abc/pub.chive.preprint.submission/123');
 * // { did: 'did:plc:abc', collection: 'pub.chive.preprint.submission', rkey: '123' }
 * ```
 */
export function parseAtUri(uri: string): {
  did: string;
  collection: string;
  rkey: string;
} | null {
  const match = /^at:\/\/(did:[^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) {
    return null;
  }
  return {
    did: match[1],
    collection: match[2],
    rkey: match[3],
  };
}
