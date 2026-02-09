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
  EprintFormData,
  AuthorRef,
  FieldNodeRef,
  FacetValue,
  ExternalLink,
  FundingSource,
} from '../schemas/eprint';
import type {
  FieldProposal,
  Vote,
  ExternalMapping,
  Reference,
  NodeProposal,
  ProposedNode,
  ProposalEvidence,
} from '../schemas/governance';
import { logger } from '@/lib/observability';

const recordLogger = logger.child({ component: 'record-creator' });

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

import type { SupplementaryCategory } from '@/lib/api/generated/types/pub/chive/defs';

/**
 * Eprint record as stored in ATProto.
 */
export interface EprintRecord {
  [key: string]: unknown;
  $type: 'pub.chive.eprint.submission';
  title: string;
  abstract: string;
  authors: AuthorRef[];
  document: BlobRef;
  documentFormat?: string;
  fieldNodes: FieldNodeRef[];
  createdAt: string;
  /**
   * DID of the user who submitted the eprint.
   *
   * @remarks
   * When submitting to a paper's PDS, this records who actually submitted
   * the eprint, even though the record lives in the paper's repository.
   */
  submittedBy?: string;
  supplementaryMaterials?: Array<{
    blob: BlobRef;
    label: string;
    description?: string;
    category: SupplementaryCategory;
    detectedFormat?: string;
    order: number;
  }>;
  facets?: FacetValue[];
  keywords?: string[];
  /** AT-URI to license node (subkind=license) */
  licenseUri?: string;
  /** SPDX license identifier for display fallback */
  licenseSlug?: string;
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

/**
 * Node proposal record as stored in ATProto.
 */
export interface NodeProposalRecord {
  [key: string]: unknown;
  $type: 'pub.chive.graph.nodeProposal';
  proposalType: 'create' | 'update' | 'deprecate' | 'merge';
  kind: 'type' | 'object';
  subkind?: string;
  proposedNode?: ProposedNode;
  targetUri?: string;
  mergeIntoUri?: string;
  rationale: string;
  evidence?: ProposalEvidence[];
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

// =============================================================================
// PROFILE INITIALIZATION
// =============================================================================

/**
 * Ensures the user has a pub.chive.actor.profile record in their PDS.
 *
 * @remarks
 * Called after successful OAuth login to ensure every Chive user has a profile.
 * If the record already exists, this is a no-op. If not, creates a minimal
 * profile record that can be enhanced later.
 *
 * This enables author profile pages to work even for users with no eprints,
 * since we can always fetch profile data from their PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @returns Created/existing record result, or null if check failed
 *
 * @example
 * ```typescript
 * // After OAuth callback succeeds
 * const agent = getCurrentAgent();
 * if (agent) {
 *   await ensureChiveProfile(agent);
 * }
 * ```
 */
export async function ensureChiveProfile(agent: Agent): Promise<CreateRecordResult | null> {
  const did = getAgentDid(agent);
  if (!did) {
    return null;
  }

  try {
    // Check if profile already exists
    const existing = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: 'pub.chive.actor.profile',
      rkey: 'self',
    });

    // Profile exists, return its info
    return {
      uri: existing.data.uri,
      cid: existing.data.cid ?? '',
    };
  } catch (error) {
    // Record not found (404) means we need to create it
    const isNotFound =
      error instanceof Error &&
      (error.message.includes('RecordNotFound') ||
        error.message.includes('Could not find') ||
        error.message.includes('404'));

    if (!isNotFound) {
      // Unexpected error
      recordLogger.error('Error checking for existing profile', error);
      return null;
    }
  }

  // Create minimal profile
  try {
    const record: ChiveProfileRecord = {
      $type: 'pub.chive.actor.profile',
      // No fields required; this just establishes the record exists
    };

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
  } catch (error) {
    recordLogger.error('Error creating profile', error);
    return null;
  }
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
 * Upload a document to the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param file - Document file to upload (PDF, DOCX, HTML, Markdown, LaTeX, etc.)
 * @returns Upload result with BlobRef
 *
 * @example
 * ```typescript
 * const result = await uploadDocument(agent, documentFile);
 * // Use result.blobRef in eprint record
 * ```
 */
export async function uploadDocument(agent: Agent, file: File): Promise<UploadBlobResult> {
  return uploadBlob(agent, file);
}

// =============================================================================
// EPRINT RECORD CREATION
// =============================================================================

/**
 * Create an eprint submission record in a PDS.
 *
 * @remarks
 * This is the primary function for submitting eprints. It:
 * 1. Uploads the document to the target PDS (PDF, DOCX, HTML, etc.)
 * 2. Uploads any supplementary materials
 * 3. Creates the eprint record with blob references
 *
 * The record is created in the target PDS (user's or paper's), NOT in Chive's storage.
 * Chive will index this record when it appears on the firehose.
 *
 * When submitting to a paper's PDS:
 * - The `targetAgent` parameter specifies the paper's authenticated agent
 * - The `submittedBy` field in the record records who submitted (userAgent's DID)
 * - Blobs are uploaded to the paper's PDS
 * - The record is created in the paper's repository
 *
 * @param userAgent - Authenticated ATProto Agent for the submitting user
 * @param data - Form data with files and metadata
 * @param targetAgent - Optional agent for paper PDS (if different from userAgent)
 * @returns Created record result
 *
 * @throws Error if agents are not authenticated
 * @throws Error if document upload fails
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * // Submit to user's own PDS
 * const agent = useAgent();
 * const result = await createEprintRecord(agent, formData);
 *
 * // Submit to paper's PDS
 * const paperAgent = getPaperAgent();
 * const result = await createEprintRecord(agent, formData, paperAgent);
 * ```
 */
export async function createEprintRecord(
  userAgent: Agent,
  data: EprintFormData,
  targetAgent?: Agent
): Promise<CreateRecordResult> {
  const userDid = getAgentDid(userAgent);
  if (!userDid) {
    throw new Error('User agent is not authenticated');
  }

  // Use targetAgent if provided (for paper PDS), otherwise use userAgent
  const agent = targetAgent ?? userAgent;
  const targetDid = getAgentDid(agent);
  if (!targetDid) {
    throw new Error('Target agent is not authenticated');
  }

  // 1. Upload document to target PDS
  const docUpload = await uploadDocument(agent, data.documentFile);

  // 2. Upload supplementary materials (if any)
  const supplementaryBlobs: Array<{
    blob: BlobRef;
    label: string;
    description?: string;
    category: SupplementaryCategory;
    detectedFormat?: string;
    order: number;
  }> = [];

  if (data.supplementaryMaterials && data.supplementaryMaterials.length > 0) {
    for (const supplementary of data.supplementaryMaterials) {
      const upload = await uploadBlob(agent, supplementary.file);
      supplementaryBlobs.push({
        blob: upload.blobRef,
        label: supplementary.label,
        description: supplementary.description,
        category: supplementary.category as SupplementaryCategory,
        detectedFormat: supplementary.detectedFormat,
        order: supplementary.order,
      });
    }
  }

  // 3. Build the record
  const record: EprintRecord = {
    $type: 'pub.chive.eprint.submission',
    title: data.title,
    abstract: data.abstract,
    authors: data.authors,
    document: docUpload.blobRef,
    documentFormat: data.documentFormat,
    fieldNodes: data.fieldNodes,
    createdAt: new Date().toISOString(),
    // Track who submitted, especially important when submitting to paper PDS
    submittedBy: userDid,
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
  if (data.licenseUri) {
    record.licenseUri = data.licenseUri;
  }
  if (data.licenseSlug) {
    record.licenseSlug = data.licenseSlug;
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

  // 4. Create the record in target PDS (user's or paper's)
  const response = await agent.com.atproto.repo.createRecord({
    repo: targetDid,
    collection: 'pub.chive.eprint.submission',
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

/**
 * Create a node proposal record in the user's PDS.
 *
 * @remarks
 * Creates a governance proposal for knowledge graph node changes.
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
 * const result = await createNodeProposalRecord(agent, {
 *   proposalType: 'create',
 *   kind: 'type',
 *   subkind: 'field',
 *   proposedNode: {
 *     label: 'Quantum Machine Learning',
 *     description: 'Intersection of quantum computing and ML...',
 *   },
 *   rationale: 'This field has grown significantly...',
 * });
 * ```
 */
export async function createNodeProposalRecord(
  agent: Agent,
  data: Omit<NodeProposal, 'createdAt'>
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: NodeProposalRecord = {
    $type: 'pub.chive.graph.nodeProposal',
    proposalType: data.proposalType,
    kind: data.kind,
    rationale: data.rationale,
    createdAt: new Date().toISOString(),
  };

  // Add optional fields
  if (data.subkind) {
    record.subkind = data.subkind;
  }
  if (data.proposedNode) {
    record.proposedNode = data.proposedNode;
  }
  if (data.targetUri) {
    record.targetUri = data.targetUri;
  }
  if (data.mergeIntoUri) {
    record.mergeIntoUri = data.mergeIntoUri;
  }
  if (data.evidence && data.evidence.length > 0) {
    record.evidence = data.evidence;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.graph.nodeProposal',
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
 * await deleteRecord(agent, 'at://did:plc:abc/pub.chive.eprint.submission/123');
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
  $type: 'pub.chive.eprint.userTag';
  eprintUri: string;
  tag: string;
  createdAt: string;
}

/**
 * Input for creating a user tag.
 */
export interface CreateTagInput {
  eprintUri: string;
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
 *   eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
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
    $type: 'pub.chive.eprint.userTag',
    eprintUri: input.eprintUri,
    tag: input.displayForm,
    createdAt: new Date().toISOString(),
  };

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.eprint.userTag',
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
  eprintUri: string;
  contributions: string[];
  comment?: string;
  createdAt: string;
}

/**
 * Input for creating an endorsement.
 */
export interface CreateEndorsementInput {
  eprintUri: string;
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
    eprintUri: input.eprintUri,
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

  // First get the existing record to preserve eprintUri
  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.review.endorsement',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as EndorsementRecord;

  const record: EndorsementRecord = {
    $type: 'pub.chive.review.endorsement',
    eprintUri: existing.eprintUri,
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
 * Text span target for inline annotations (lexicon format).
 * Note: boundingRect coordinates are stored as strings to preserve floating-point precision
 * since ATProto Lexicon only supports integer type.
 */
export interface ReviewTextSpanTarget {
  versionUri?: string;
  selector: {
    $type: string;
    type: string;
    exact?: string;
    prefix?: string;
    suffix?: string;
    start?: number;
    end?: number;
    value?: string;
  };
  refinedBy?: {
    $type?: string;
    type?: string;
    pageNumber?: number;
    start?: number;
    end?: number;
    boundingRect?: {
      $type?: string;
      x1: string;
      y1: string;
      x2: string;
      y2: string;
      width: string;
      height: string;
      pageNumber: number;
    };
  };
}

/**
 * Input target from frontend (UnifiedTextSpanTarget format).
 */
export interface InputTextSpanTarget {
  source?: string;
  selector?: {
    $type?: string;
    type?: string;
    exact?: string;
    prefix?: string;
    suffix?: string;
  };
  refinedBy?: {
    type?: string;
    pageNumber?: number;
    start?: number;
    end?: number;
    boundingRect?: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
      pageNumber?: number;
    };
  };
  page?: number;
}

/**
 * Review comment record as stored in ATProto.
 */
export interface ReviewCommentRecord {
  [key: string]: unknown;
  $type: 'pub.chive.review.comment';
  eprintUri: string;
  body: Array<{ $type?: string; type: string; content: string; facets?: unknown[] }>;
  parentComment?: string;
  target?: ReviewTextSpanTarget & {
    refinedBy?: ReviewTextSpanTarget['refinedBy'];
  };
  motivationFallback?: string;
  createdAt: string;
}

/**
 * Facet for rich text formatting in reviews.
 */
export interface ReviewFacet {
  /** Byte range for the facet */
  index: {
    byteStart: number;
    byteEnd: number;
  };
  /** Features (e.g., link) */
  features: Array<{
    $type: string;
    uri?: string;
  }>;
}

/**
 * Input for creating a review.
 */
export interface CreateReviewInput {
  eprintUri: string;
  content: string;
  parentReviewUri?: string;
  target?: InputTextSpanTarget;
  motivation?: string;
  /** Optional facets for rich text (links, etc.) */
  facets?: ReviewFacet[];
}

/**
 * Input for updating a review.
 */
export interface UpdateReviewInput {
  uri: string;
  content: string;
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

  // Build the body array (lexicon requires body, not content)
  const textItem: {
    $type: string;
    type: string;
    content: string;
    facets?: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ $type: string; uri?: string }>;
    }>;
  } = {
    $type: 'pub.chive.review.comment#textItem',
    type: 'text',
    content: input.content,
  };

  // Add facets if provided
  if (input.facets && input.facets.length > 0) {
    textItem.facets = input.facets;
  }

  const body: ReviewCommentRecord['body'] = [textItem];

  const record: ReviewCommentRecord = {
    $type: 'pub.chive.review.comment',
    eprintUri: input.eprintUri,
    body,
    createdAt: new Date().toISOString(),
  };

  if (input.parentReviewUri) {
    record.parentComment = input.parentReviewUri;
  }

  // Transform target from frontend format to lexicon format
  if (input.target?.selector?.exact) {
    record.target = {
      selector: {
        $type: 'pub.chive.review.comment#textQuoteSelector',
        type: 'TextQuoteSelector',
        exact: input.target.selector.exact,
        prefix: input.target.selector.prefix,
        suffix: input.target.selector.suffix,
      },
    };

    // Include refinedBy for position data (pageNumber, boundingRect)
    if (input.target.refinedBy) {
      const inputBoundingRect = input.target.refinedBy.boundingRect;
      record.target.refinedBy = {
        $type: 'pub.chive.review.comment#positionRefinement',
        type: 'TextPositionSelector',
        pageNumber: input.target.refinedBy.pageNumber,
        start: input.target.refinedBy.start,
        end: input.target.refinedBy.end,
        // Serialize boundingRect coordinates to strings for ATProto storage
        // (ATProto Lexicon only supports integer type, not float)
        boundingRect: inputBoundingRect
          ? {
              $type: 'pub.chive.review.comment#boundingRect',
              x1: String(inputBoundingRect.x1),
              y1: String(inputBoundingRect.y1),
              x2: String(inputBoundingRect.x2),
              y2: String(inputBoundingRect.y2),
              width: String(inputBoundingRect.width),
              height: String(inputBoundingRect.height),
              pageNumber:
                inputBoundingRect.pageNumber ?? (input.target.refinedBy.pageNumber ?? 0) + 1,
            }
          : undefined,
      };
    }
  }

  if (input.motivation) {
    record.motivationFallback = input.motivation;
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

/**
 * Update a review comment record in the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Updated review data
 * @returns Updated record result
 */
export async function updateReviewRecord(
  agent: Agent,
  input: UpdateReviewInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(input.uri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot update records belonging to other users');
  }

  // Get the existing record to preserve eprintUri, parentComment, and createdAt
  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.review.comment',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as ReviewCommentRecord;

  // Build the body array with the new content
  const body: ReviewCommentRecord['body'] = [
    {
      $type: 'pub.chive.review.comment#textItem',
      type: 'text',
      content: input.content,
    },
  ];

  const record: ReviewCommentRecord = {
    $type: 'pub.chive.review.comment',
    eprintUri: existing.eprintUri,
    body,
    createdAt: existing.createdAt,
  };

  if (existing.parentComment) {
    record.parentComment = existing.parentComment;
  }

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.review.comment',
    rkey: parsed.rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// ANNOTATION RECORD CREATION
// =============================================================================

/**
 * Annotation comment record as stored in ATProto.
 *
 * @remarks
 * Uses W3C Web Annotation compliant text span targeting. The target
 * field is required (unlike review comments, which can be general).
 */
export interface AnnotationCommentRecord {
  [key: string]: unknown;
  $type: 'pub.chive.annotation.comment';
  eprintUri: string;
  body: Array<{ $type?: string; type: string; content: string; facets?: unknown[] }>;
  target: ReviewTextSpanTarget & {
    refinedBy?: ReviewTextSpanTarget['refinedBy'];
  };
  parentAnnotation?: string;
  motivationFallback?: string;
  createdAt: string;
}

/**
 * Input for creating an annotation comment.
 */
export interface CreateAnnotationInput {
  eprintUri: string;
  content: string;
  target: InputTextSpanTarget;
  parentAnnotationUri?: string;
  motivation?: string;
  /** Optional facets for rich text (links, etc.) */
  facets?: ReviewFacet[];
}

/**
 * Create an annotation comment record in the user's PDS.
 *
 * @remarks
 * Annotations always require a target text span, unlike general reviews.
 * The record is stored in the `pub.chive.annotation.comment` collection
 * and will be indexed by Chive when it appears on the firehose.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Annotation data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if target is not provided
 *
 * @example
 * ```typescript
 * const result = await createAnnotationRecord(agent, {
 *   eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
 *   content: 'This finding contradicts earlier work.',
 *   target: { selector: { exact: 'our results show' } },
 * });
 * ```
 */
export async function createAnnotationRecord(
  agent: Agent,
  input: CreateAnnotationInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  if (!input.target?.selector?.exact) {
    throw new Error('Annotation target with text quote selector is required');
  }

  // Build the body array (lexicon requires body, not content)
  const textItem: {
    $type: string;
    type: string;
    content: string;
    facets?: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ $type: string; uri?: string }>;
    }>;
  } = {
    $type: 'pub.chive.annotation.comment#textItem',
    type: 'text',
    content: input.content,
  };

  // Add facets if provided
  if (input.facets && input.facets.length > 0) {
    textItem.facets = input.facets;
  }

  const body: AnnotationCommentRecord['body'] = [textItem];

  // Transform target from frontend format to lexicon format
  const target: AnnotationCommentRecord['target'] = {
    selector: {
      $type: 'pub.chive.annotation.comment#textQuoteSelector',
      type: 'TextQuoteSelector',
      exact: input.target.selector.exact,
      prefix: input.target.selector.prefix,
      suffix: input.target.selector.suffix,
    },
  };

  // Include refinedBy for position data (pageNumber, boundingRect)
  if (input.target.refinedBy) {
    const inputBoundingRect = input.target.refinedBy.boundingRect;
    target.refinedBy = {
      $type: 'pub.chive.annotation.comment#positionRefinement',
      type: 'TextPositionSelector',
      pageNumber: input.target.refinedBy.pageNumber,
      start: input.target.refinedBy.start,
      end: input.target.refinedBy.end,
      // Serialize boundingRect coordinates to strings for ATProto storage
      // (ATProto Lexicon only supports integer type, not float)
      boundingRect: inputBoundingRect
        ? {
            $type: 'pub.chive.annotation.comment#boundingRect',
            x1: String(inputBoundingRect.x1),
            y1: String(inputBoundingRect.y1),
            x2: String(inputBoundingRect.x2),
            y2: String(inputBoundingRect.y2),
            width: String(inputBoundingRect.width),
            height: String(inputBoundingRect.height),
            pageNumber:
              inputBoundingRect.pageNumber ?? (input.target.refinedBy.pageNumber ?? 0) + 1,
          }
        : undefined,
    };
  }

  const record: AnnotationCommentRecord = {
    $type: 'pub.chive.annotation.comment',
    eprintUri: input.eprintUri,
    body,
    target,
    createdAt: new Date().toISOString(),
  };

  if (input.parentAnnotationUri) {
    record.parentAnnotation = input.parentAnnotationUri;
  }

  if (input.motivation) {
    record.motivationFallback = input.motivation;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.annotation.comment',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Entity link record as stored in ATProto.
 *
 * @remarks
 * Entity links connect a text span in an eprint to a structured entity
 * such as a Wikidata item, knowledge graph node, author, or eprint.
 */
export interface EntityLinkRecord {
  [key: string]: unknown;
  $type: 'pub.chive.annotation.entityLink';
  eprintUri: string;
  target: ReviewTextSpanTarget & {
    refinedBy?: ReviewTextSpanTarget['refinedBy'];
  };
  linkedEntity: {
    $type: string;
    [key: string]: unknown;
  };
  confidence?: number;
  createdAt: string;
}

/**
 * Input for creating an entity link.
 */
export interface CreateEntityLinkInput {
  eprintUri: string;
  target: InputTextSpanTarget;
  linkedEntity: {
    $type: string;
    [key: string]: unknown;
  };
  confidence?: number;
}

/**
 * Create an entity link record in the user's PDS.
 *
 * @remarks
 * Entity links are stored in the `pub.chive.annotation.entityLink` collection.
 * They connect a text span to an external entity for semantic enrichment.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Entity link data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if target is not provided
 *
 * @example
 * ```typescript
 * const result = await createEntityLinkRecord(agent, {
 *   eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
 *   target: { selector: { exact: 'transformer architecture' } },
 *   linkedEntity: {
 *     $type: 'pub.chive.annotation.entityLink#wikidataEntity',
 *     qid: 'Q97109669',
 *     label: 'Transformer (machine learning model)',
 *     url: 'https://www.wikidata.org/wiki/Q97109669',
 *   },
 *   confidence: 0.95,
 * });
 * ```
 */
export async function createEntityLinkRecord(
  agent: Agent,
  input: CreateEntityLinkInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  if (!input.target?.selector?.exact) {
    throw new Error('Entity link target with text quote selector is required');
  }

  // Transform target from frontend format to lexicon format
  const target: EntityLinkRecord['target'] = {
    selector: {
      $type: 'pub.chive.annotation.comment#textQuoteSelector',
      type: 'TextQuoteSelector',
      exact: input.target.selector.exact,
      prefix: input.target.selector.prefix,
      suffix: input.target.selector.suffix,
    },
  };

  // Include refinedBy for position data
  if (input.target.refinedBy) {
    const inputBoundingRect = input.target.refinedBy.boundingRect;
    target.refinedBy = {
      $type: 'pub.chive.annotation.comment#positionRefinement',
      type: 'TextPositionSelector',
      pageNumber: input.target.refinedBy.pageNumber,
      start: input.target.refinedBy.start,
      end: input.target.refinedBy.end,
      boundingRect: inputBoundingRect
        ? {
            $type: 'pub.chive.annotation.comment#boundingRect',
            x1: String(inputBoundingRect.x1),
            y1: String(inputBoundingRect.y1),
            x2: String(inputBoundingRect.x2),
            y2: String(inputBoundingRect.y2),
            width: String(inputBoundingRect.width),
            height: String(inputBoundingRect.height),
            pageNumber:
              inputBoundingRect.pageNumber ?? (input.target.refinedBy.pageNumber ?? 0) + 1,
          }
        : undefined,
    };
  }

  const record: EntityLinkRecord = {
    $type: 'pub.chive.annotation.entityLink',
    eprintUri: input.eprintUri,
    target,
    linkedEntity: input.linkedEntity,
    createdAt: new Date().toISOString(),
  };

  if (input.confidence !== undefined) {
    record.confidence = input.confidence;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.annotation.entityLink',
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
// EPRINT RECORD UPDATES
// =============================================================================

/**
 * Input for adding a co-author to an eprint.
 */
export interface AddCoauthorInput {
  /** AT-URI of the eprint record */
  eprintUri: string;
  /** Index in the authors array where the co-author entry is */
  authorIndex: number;
  /** DID of the co-author to add */
  coauthorDid: string;
}

/**
 * Add a co-author DID to an existing eprint record.
 *
 * @remarks
 * This updates the specified author entry in the eprint record to include
 * the co-author's DID. This is called after approving a co-authorship request.
 *
 * The eprint must belong to the authenticated user (the agent's DID).
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Co-author addition data
 * @returns Updated record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 * @throws Error if author index is invalid
 */
export async function addCoauthorToEprint(
  agent: Agent,
  input: AddCoauthorInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(input.eprintUri);
  if (!parsed) {
    throw new Error('Invalid eprint URI');
  }

  if (parsed.did !== did) {
    throw new Error('Cannot update eprints belonging to other users');
  }

  // Get the existing record
  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: parsed.collection,
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as EprintRecord;

  // Validate author index
  if (input.authorIndex < 0 || input.authorIndex >= existing.authors.length) {
    throw new Error(`Invalid author index: ${input.authorIndex}`);
  }

  // Update the author entry to include the co-author's DID
  const updatedAuthors = [...existing.authors];
  updatedAuthors[input.authorIndex] = {
    ...updatedAuthors[input.authorIndex],
    did: input.coauthorDid,
  };

  // Build the updated record
  const record: EprintRecord = {
    ...existing,
    authors: updatedAuthors,
  };

  // Update the record
  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: parsed.collection,
    rkey: parsed.rkey,
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
 * @param collection - Record collection (e.g., 'pub.chive.eprint.submission')
 * @param rkey - Record key
 * @returns AT-URI string
 *
 * @example
 * ```typescript
 * const uri = buildAtUri('did:plc:abc', 'pub.chive.eprint.submission', '123');
 * // 'at://did:plc:abc/pub.chive.eprint.submission/123'
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
 * const parts = parseAtUri('at://did:plc:abc/pub.chive.eprint.submission/123');
 * // { did: 'did:plc:abc', collection: 'pub.chive.eprint.submission', rkey: '123' }
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

// =============================================================================
// STANDARD.SITE INTEGRATION
// =============================================================================

/**
 * Standard document record as stored in ATProto (site.standard.document).
 *
 * @remarks
 * This record enables cross-platform discovery of eprints across the ATProto
 * publishing ecosystem. When a user creates an eprint, they can optionally
 * create a companion standard.site document that references it.
 */
export interface StandardDocumentRecord {
  [key: string]: unknown;
  $type: 'site.standard.document';
  title: string;
  description?: string;
  content: {
    uri: string;
    cid?: string;
  };
  visibility: 'public' | 'private' | 'unlisted';
  createdAt: string;
  updatedAt?: string;
}

/**
 * Input for creating a standard.site document.
 */
export interface CreateStandardDocumentInput {
  /** Title of the document */
  title: string;
  /** Brief description or abstract (max 2000 chars) */
  description?: string;
  /** AT-URI of the platform-specific content record (e.g., eprint) */
  eprintUri: string;
  /** CID of the content record for verification */
  eprintCid?: string;
}

/**
 * Create a standard.site document record in the user's PDS.
 *
 * @remarks
 * Creates a site.standard.document record that references a Chive eprint.
 * This enables cross-platform discovery across ATProto publishing platforms.
 * The document is created in the user's PDS, following ATProto compliance.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Document data
 * @returns Created record result with URI and CID
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * // After creating an eprint, create a standard.site document
 * const eprintResult = await createEprintRecord(agent, eprintData);
 * const docResult = await createStandardDocument(agent, {
 *   title: eprintData.title,
 *   description: eprintData.abstract.substring(0, 2000),
 *   eprintUri: eprintResult.uri,
 *   eprintCid: eprintResult.cid,
 * });
 * ```
 */
export async function createStandardDocument(
  agent: Agent,
  input: CreateStandardDocumentInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: StandardDocumentRecord = {
    $type: 'site.standard.document',
    title: input.title,
    content: {
      uri: input.eprintUri,
      ...(input.eprintCid && { cid: input.eprintCid }),
    },
    visibility: 'public',
    createdAt: new Date().toISOString(),
  };

  // Add optional description (truncated to 2000 chars per lexicon spec)
  if (input.description) {
    record.description = input.description.substring(0, 2000);
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'site.standard.document',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Input for updating a standard.site document.
 */
export interface UpdateStandardDocumentInput {
  /** AT-URI of the existing document record */
  uri: string;
  /** Updated title */
  title?: string;
  /** Updated description */
  description?: string;
  /** Updated eprint URI (if the underlying record changed) */
  eprintUri?: string;
  /** Updated eprint CID */
  eprintCid?: string;
}

/**
 * Update a standard.site document record in the user's PDS.
 *
 * @remarks
 * Updates an existing site.standard.document record. This is useful when
 * the underlying eprint is updated (new version) or metadata changes.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Updated document data
 * @returns Updated record result with URI and CID
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 * @throws Error if record update fails
 *
 * @example
 * ```typescript
 * // Update the standard.site document after eprint changes
 * await updateStandardDocument(agent, {
 *   uri: existingDocUri,
 *   title: 'Updated Title',
 *   eprintCid: newEprintCid,
 * });
 * ```
 */
export async function updateStandardDocument(
  agent: Agent,
  input: UpdateStandardDocumentInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(input.uri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot update records belonging to other users');
  }

  // Get the existing record to preserve fields not being updated
  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'site.standard.document',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as StandardDocumentRecord;

  // Build updated record, preserving existing values for fields not specified
  const record: StandardDocumentRecord = {
    $type: 'site.standard.document',
    title: input.title ?? existing.title,
    content: {
      uri: input.eprintUri ?? existing.content.uri,
      ...(input.eprintCid
        ? { cid: input.eprintCid }
        : existing.content.cid && { cid: existing.content.cid }),
    },
    visibility: existing.visibility,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  // Update description if provided, otherwise preserve existing
  if (input.description !== undefined) {
    record.description = input.description.substring(0, 2000);
  } else if (existing.description) {
    record.description = existing.description;
  }

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'site.standard.document',
    rkey: parsed.rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}
