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
  publishedVersion?: {
    doi?: string;
    url?: string;
    publishedAt?: string;
    journal?: string;
    journalAbbreviation?: string;
    journalIssn?: string;
    publisher?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    articleNumber?: string;
    eLocationId?: string;
    accessType?: string;
    licenseUrl?: string;
  };
  externalIds?: {
    arxivId?: string;
    pmid?: string;
    pmcid?: string;
    ssrnId?: string;
    osf?: string;
    zenodoDoi?: string;
    openAlexId?: string;
    semanticScholarId?: string;
    coreSid?: string;
    magId?: string;
  };
  repositories?: {
    code?: Array<{
      url?: string;
      platformUri?: string;
      platformSlug?: string;
      label?: string;
      archiveUrl?: string;
      swhid?: string;
    }>;
    data?: Array<{
      url?: string;
      doi?: string;
      platformUri?: string;
      platformSlug?: string;
      label?: string;
      accessStatement?: string;
    }>;
    preregistration?: {
      url?: string;
      platformUri?: string;
      platformSlug?: string;
      registrationDate?: string;
    };
    protocols?: Array<{
      url?: string;
      doi?: string;
      platformUri?: string;
      platformSlug?: string;
    }>;
    materials?: Array<{
      url?: string;
      rrid?: string;
      label?: string;
    }>;
  };
  funding?: Array<{
    funderName?: string;
    funderUri?: string;
    funderDoi?: string;
    funderRor?: string;
    grantNumber?: string;
    grantTitle?: string;
    grantUrl?: string;
  }>;
  conferencePresentation?: {
    conferenceName?: string;
    conferenceAcronym?: string;
    conferenceUri?: string;
    conferenceUrl?: string;
    conferenceIteration?: string;
    conferenceLocation?: string;
    presentationDate?: string;
    presentationTypeUri?: string;
    presentationTypeSlug?: string;
    proceedingsDoi?: string;
  };
  publicationStatus?: string;
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

  // Publication status
  if (data.publicationStatus) {
    record.publicationStatus = data.publicationStatus;
  }

  // Published version metadata
  if (data.publishedVersion) {
    const pv = Object.fromEntries(
      Object.entries(data.publishedVersion).filter(([_, v]) => v !== undefined && v !== '')
    );
    if (Object.keys(pv).length > 0) {
      record.publishedVersion = pv;
    }
  }

  // External identifiers
  if (data.externalIds) {
    const ids = Object.fromEntries(
      Object.entries(data.externalIds).filter(([_, v]) => v !== undefined && v !== '')
    );
    if (Object.keys(ids).length > 0) {
      record.externalIds = ids;
    }
  }

  // Repositories (code, data, preregistration)
  if (data.repositories) {
    const repos: EprintRecord['repositories'] = {};
    if (data.repositories.code && data.repositories.code.length > 0) {
      repos.code = data.repositories.code;
    }
    if (data.repositories.data && data.repositories.data.length > 0) {
      repos.data = data.repositories.data;
    }
    if (data.repositories.preregistration?.url) {
      repos.preregistration = data.repositories.preregistration;
    }
    if (data.repositories.protocols && data.repositories.protocols.length > 0) {
      repos.protocols = data.repositories.protocols;
    }
    if (data.repositories.materials && data.repositories.materials.length > 0) {
      repos.materials = data.repositories.materials;
    }
    if (Object.keys(repos).length > 0) {
      record.repositories = repos;
    }
  }

  // Funding (canonical field; fundingInfo above is for backward compatibility)
  if (data.funding && data.funding.length > 0) {
    record.funding = data.funding;
  }

  // Conference presentation
  if (data.conferencePresentation) {
    const cp = Object.fromEntries(
      Object.entries(data.conferencePresentation).filter(([_, v]) => v !== undefined && v !== '')
    );
    if (Object.keys(cp).length > 0) {
      record.conferencePresentation = cp;
    }
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
  fieldUris?: string[];
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
  if (data.fields?.length) record.fieldUris = data.fields;
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

// =============================================================================
// CITATION RECORD CREATION
// =============================================================================

/**
 * Cited work metadata for a user-curated citation.
 */
export interface CitedWork {
  title: string;
  doi?: string;
  arxivId?: string;
  url?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  chiveUri?: string;
}

/**
 * Citation record as stored in ATProto.
 */
export interface CitationRecord {
  [key: string]: unknown;
  $type: 'pub.chive.eprint.citation';
  eprintUri: string;
  citedWork: CitedWork;
  citationType?: string;
  context?: string;
  createdAt: string;
}

/**
 * Input for creating a citation record.
 */
export interface CreateCitationInput {
  eprintUri: string;
  citedWork: CitedWork;
  citationType?: string;
  context?: string;
}

/**
 * Create a citation record in the user's PDS.
 *
 * @remarks
 * Records a user-curated citation link between an eprint and a cited work.
 * The citation is stored in the user's PDS and will be indexed by Chive
 * when it appears on the firehose.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Citation data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * const result = await createCitationRecord(agent, {
 *   eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
 *   citedWork: {
 *     title: 'Attention Is All You Need',
 *     doi: '10.5555/3295222.3295349',
 *     authors: ['Vaswani, A.', 'Shazeer, N.'],
 *     year: 2017,
 *     venue: 'NeurIPS',
 *   },
 *   citationType: 'extends',
 *   context: 'We build on the transformer architecture from this work.',
 * });
 * ```
 */
export async function createCitationRecord(
  agent: Agent,
  input: CreateCitationInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: CitationRecord = {
    $type: 'pub.chive.eprint.citation',
    eprintUri: input.eprintUri,
    citedWork: input.citedWork,
    createdAt: new Date().toISOString(),
  };

  if (input.citationType) {
    record.citationType = input.citationType;
  }
  if (input.context) {
    record.context = input.context;
  }

  recordLogger.info('Creating citation record', {
    eprintUri: input.eprintUri,
    citedWorkTitle: input.citedWork.title,
  });

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.eprint.citation',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// RELATED WORK RECORD CREATION
// =============================================================================

/**
 * Related work record as stored in ATProto.
 */
export interface RelatedWorkRecord {
  [key: string]: unknown;
  $type: 'pub.chive.eprint.relatedWork';
  eprintUri: string;
  relatedUri: string;
  relationType: string;
  description?: string;
  createdAt: string;
}

/**
 * Input for creating a related work record.
 */
export interface CreateRelatedWorkInput {
  eprintUri: string;
  relatedUri: string;
  relationType: string;
  description?: string;
}

/**
 * Create a related work record in the user's PDS.
 *
 * @remarks
 * Records a user-curated relationship between two eprints.
 * The link is stored in the user's PDS and will be indexed by Chive
 * when it appears on the firehose.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Related work data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * const result = await createRelatedWorkRecord(agent, {
 *   eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
 *   relatedUri: 'at://did:plc:xyz/pub.chive.eprint.submission/456',
 *   relationType: 'extends',
 *   description: 'This work extends our earlier framework.',
 * });
 * ```
 */
export async function createRelatedWorkRecord(
  agent: Agent,
  input: CreateRelatedWorkInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: RelatedWorkRecord = {
    $type: 'pub.chive.eprint.relatedWork',
    eprintUri: input.eprintUri,
    relatedUri: input.relatedUri,
    relationType: input.relationType,
    createdAt: new Date().toISOString(),
  };

  if (input.description) {
    record.description = input.description;
  }

  recordLogger.info('Creating related work record', {
    eprintUri: input.eprintUri,
    relatedUri: input.relatedUri,
    relationType: input.relationType,
  });

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.eprint.relatedWork',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// COLLECTION NODE CRUD
// =============================================================================

/**
 * Collection node record as stored in ATProto.
 *
 * @remarks
 * Collections are graph nodes with kind='object' and subkind='collection'.
 * They live in the user's PDS and are indexed by Chive from the firehose.
 */
export interface CollectionNodeRecord {
  [key: string]: unknown;
  $type: 'pub.chive.graph.node';
  id: string;
  kind: 'object';
  subkind: 'collection';
  label: string;
  description?: string;
  metadata: {
    visibility: 'listed' | 'unlisted';
    itemOrder: string[];
    enableCosmikMirror?: boolean;
    [key: string]: unknown;
  };
  status: 'established';
  createdAt: string;
}

/**
 * Input for creating a collection node.
 */
export interface CreateCollectionNodeInput {
  /** Display name of the collection */
  name: string;
  /** Optional description */
  description?: string;
  /** Visibility setting */
  visibility: 'listed' | 'unlisted';
  /** Optional tags for categorization */
  tags?: string[];
  /** Whether to mirror to Cosmik */
  enableCosmikMirror?: boolean;
}

/**
 * Create a collection node record in the user's PDS.
 *
 * @remarks
 * Collections are personal graph nodes with kind='object' and subkind='collection'.
 * The record is stored in the user's PDS and will be indexed by Chive
 * when it appears on the firehose.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Collection data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record creation fails
 *
 * @example
 * ```typescript
 * const result = await createCollectionNode(agent, {
 *   name: 'Reading List: NLP',
 *   description: 'Papers on natural language processing',
 *   visibility: 'listed',
 *   tags: ['nlp', 'machine-learning'],
 * });
 * ```
 */
export async function createCollectionNode(
  agent: Agent,
  input: CreateCollectionNodeInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const id = crypto.randomUUID();

  const record: CollectionNodeRecord = {
    $type: 'pub.chive.graph.node',
    id,
    kind: 'object',
    subkind: 'collection',
    label: input.name,
    metadata: {
      visibility: input.visibility,
      itemOrder: [],
    },
    status: 'established',
    createdAt: new Date().toISOString(),
  };

  if (input.description) {
    record.description = input.description;
  }
  if (input.tags && input.tags.length > 0) {
    record.metadata.tags = input.tags;
  }
  if (input.enableCosmikMirror !== undefined) {
    record.metadata.enableCosmikMirror = input.enableCosmikMirror;
  }

  recordLogger.info('Creating collection node', { name: input.name });

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: id,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Input for updating a collection node.
 */
export interface UpdateCollectionNodeInput {
  /** AT-URI of the collection node */
  uri: string;
  /** Updated name */
  name?: string;
  /** Updated description */
  description?: string;
  /** Updated visibility */
  visibility?: 'listed' | 'unlisted';
  /** Updated tags */
  tags?: string[];
}

/**
 * Update a collection node record in the user's PDS.
 *
 * @remarks
 * Uses putRecord to update the graph node. Preserves existing fields
 * that are not specified in the input.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Updated collection data
 * @returns Updated record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 *
 * @example
 * ```typescript
 * const result = await updateCollectionNode(agent, {
 *   uri: 'at://did:plc:abc/pub.chive.graph.node/uuid-123',
 *   name: 'Updated Reading List',
 *   visibility: 'unlisted',
 * });
 * ```
 */
export async function updateCollectionNode(
  agent: Agent,
  input: UpdateCollectionNodeInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(input.uri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot update records belonging to other users');
  }

  // Fetch existing record to preserve unchanged fields
  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as CollectionNodeRecord;

  const record: CollectionNodeRecord = {
    ...existing,
    label: input.name ?? existing.label,
    metadata: {
      ...existing.metadata,
      visibility: input.visibility ?? existing.metadata.visibility,
    },
  };

  if (input.description !== undefined) {
    record.description = input.description;
  }
  if (input.tags !== undefined) {
    record.metadata.tags = input.tags;
  }

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Options for deleting a collection node.
 */
export interface DeleteCollectionOptions {
  /** Whether to re-parent subcollections to the deleted collection's parent */
  cascadeSubcollections?: boolean;
}

/**
 * Delete a collection node and its associated edges from the user's PDS.
 *
 * @remarks
 * Cascade logic:
 * 1. Queries subcollections and parent of this collection
 * 2. Lists all edges from this collection (CONTAINS and SUBCOLLECTION_OF)
 * 3. Deletes SUBCOLLECTION_OF edges from subcollections to this collection
 * 4. If a parent exists and cascadeSubcollections is true, creates new
 *    SUBCOLLECTION_OF edges from each subcollection to the parent
 * 5. Deletes all CONTAINS edges from this collection
 * 6. Deletes the SUBCOLLECTION_OF edge from this collection to its parent
 * 7. Deletes the collection node itself
 *
 * @param agent - Authenticated ATProto Agent
 * @param uri - AT-URI of the collection node to delete
 * @param options - Deletion options
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 *
 * @example
 * ```typescript
 * await deleteCollectionNode(agent, collectionUri, {
 *   cascadeSubcollections: true,
 * });
 * ```
 */
export async function deleteCollectionNode(
  agent: Agent,
  uri: string,
  options?: DeleteCollectionOptions
): Promise<void> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(uri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot delete records belonging to other users');
  }

  // List all edges where this collection is the source (CONTAINS and SUBCOLLECTION_OF edges)
  const edgesFromThis = await listPersonalEdgesForSource(agent, did, uri);

  // List all edges where this collection is the target (SUBCOLLECTION_OF from children)
  const edgesToThis = await listPersonalEdgesForTarget(agent, did, uri);

  // Identify subcollection edges (edges where children have SUBCOLLECTION_OF pointing to this)
  const subcollectionEdgesFromChildren = edgesToThis.filter(
    (e) => e.relationSlug === 'subcollection-of'
  );

  // Identify the SUBCOLLECTION_OF edge from this collection to its parent
  const parentEdge = edgesFromThis.find((e) => e.relationSlug === 'subcollection-of');

  // Step 1: Delete SUBCOLLECTION_OF edges from subcollections to this collection
  for (const edge of subcollectionEdgesFromChildren) {
    await deleteRecord(agent, edge.uri);
  }

  // Step 2: If parent exists and cascade is enabled, re-parent subcollections
  if (parentEdge && options?.cascadeSubcollections) {
    const parentUri = parentEdge.targetUri;
    for (const edge of subcollectionEdgesFromChildren) {
      await addSubcollection(agent, {
        childCollectionUri: edge.sourceUri,
        parentCollectionUri: parentUri,
      });
    }
  }

  // Step 3: Delete all CONTAINS edges from this collection
  const containsEdges = edgesFromThis.filter((e) => e.relationSlug === 'contains');
  for (const edge of containsEdges) {
    await deleteRecord(agent, edge.uri);
  }

  // Step 4: Delete SUBCOLLECTION_OF edge from this collection to parent
  if (parentEdge) {
    await deleteRecord(agent, parentEdge.uri);
  }

  // Step 5: Delete the collection node itself
  await deleteRecord(agent, uri);
}

// =============================================================================
// COLLECTION EDGE OPERATIONS
// =============================================================================

/**
 * Input for adding an item to a collection.
 *
 * @remarks
 * All collection items are personal graph nodes. The `itemUri` must be the
 * AT-URI of a `pub.chive.graph.node` record in the user's PDS.
 */
export interface AddItemToCollectionInput {
  /** AT-URI of the collection */
  collectionUri: string;
  /** AT-URI of the personal graph node to add */
  itemUri: string;
  /** User-entered display label for this item */
  label?: string;
  /** Optional note about why this item is in the collection */
  note?: string;
  /** Optional sort order within the collection */
  order?: number;
}

/**
 * Add an item to a collection by creating a CONTAINS edge.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Item addition data
 * @returns Created edge record result
 *
 * @throws Error if agent is not authenticated
 *
 * @example
 * ```typescript
 * const result = await addItemToCollection(agent, {
 *   collectionUri: 'at://did:plc:abc/pub.chive.graph.node/uuid-123',
 *   itemUri: 'at://did:plc:xyz/pub.chive.eprint.submission/tid-456',
 *   itemType: 'eprint',
 *   note: 'Foundational transformer paper',
 * });
 * ```
 */
export async function addItemToCollection(
  agent: Agent,
  input: AddItemToCollectionInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const id = crypto.randomUUID();

  const record: PersonalEdgeRecord = {
    $type: 'pub.chive.graph.edge',
    id,
    sourceUri: input.collectionUri,
    targetUri: input.itemUri,
    relationSlug: 'contains',
    metadata: {} as Record<string, unknown>,
    status: 'established',
    createdAt: new Date().toISOString(),
  };

  if (input.label) {
    record.metadata.label = input.label;
  }
  if (input.note) {
    record.metadata.note = input.note;
  }
  if (input.order !== undefined) {
    record.metadata.order = input.order;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.graph.edge',
    rkey: id,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Remove an item from a collection by deleting the CONTAINS edge.
 *
 * @param agent - Authenticated ATProto Agent
 * @param edgeUri - AT-URI of the CONTAINS edge to delete
 *
 * @throws Error if agent is not authenticated
 *
 * @example
 * ```typescript
 * await removeItemFromCollection(agent, edgeUri);
 * ```
 */
export async function removeItemFromCollection(agent: Agent, edgeUri: string): Promise<void> {
  await deleteRecord(agent, edgeUri);
}

/**
 * Input for adding a subcollection relationship.
 */
export interface AddSubcollectionInput {
  /** AT-URI of the child collection */
  childCollectionUri: string;
  /** AT-URI of the parent collection */
  parentCollectionUri: string;
}

/**
 * Add a subcollection relationship by creating a SUBCOLLECTION_OF edge.
 *
 * @remarks
 * Creates a 'subcollection-of' edge from the child to the parent.
 * The child is the source, the parent is the target.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Subcollection relationship data
 * @returns Created edge record result
 *
 * @throws Error if agent is not authenticated
 *
 * @example
 * ```typescript
 * const result = await addSubcollection(agent, {
 *   childCollectionUri: 'at://did:plc:abc/pub.chive.graph.node/child-uuid',
 *   parentCollectionUri: 'at://did:plc:abc/pub.chive.graph.node/parent-uuid',
 * });
 * ```
 */
export async function addSubcollection(
  agent: Agent,
  input: AddSubcollectionInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const id = crypto.randomUUID();

  const record: PersonalEdgeRecord = {
    $type: 'pub.chive.graph.edge',
    id,
    sourceUri: input.childCollectionUri,
    targetUri: input.parentCollectionUri,
    relationSlug: 'subcollection-of',
    metadata: {},
    status: 'established',
    createdAt: new Date().toISOString(),
  };

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.graph.edge',
    rkey: id,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Remove a subcollection relationship by deleting the SUBCOLLECTION_OF edge.
 *
 * @remarks
 * Only deletes the edge; the subcollection node itself is not removed.
 *
 * @param agent - Authenticated ATProto Agent
 * @param edgeUri - AT-URI of the SUBCOLLECTION_OF edge to delete
 *
 * @throws Error if agent is not authenticated
 *
 * @example
 * ```typescript
 * await removeSubcollection(agent, edgeUri);
 * ```
 */
export async function removeSubcollection(agent: Agent, edgeUri: string): Promise<void> {
  await deleteRecord(agent, edgeUri);
}

/**
 * Input for moving a subcollection to a new parent.
 */
export interface MoveSubcollectionInput {
  /** AT-URI of the subcollection being moved */
  subcollectionUri: string;
  /** AT-URI of the old SUBCOLLECTION_OF edge to delete */
  oldParentEdgeUri: string;
  /** AT-URI of the new parent collection */
  newParentUri: string;
}

/**
 * Move a subcollection from one parent to another.
 *
 * @remarks
 * Deletes the old SUBCOLLECTION_OF edge and creates a new one to the new parent.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Move operation data
 *
 * @throws Error if agent is not authenticated
 *
 * @example
 * ```typescript
 * await moveSubcollection(agent, {
 *   subcollectionUri: childUri,
 *   oldParentEdgeUri: existingEdgeUri,
 *   newParentUri: newParentCollectionUri,
 * });
 * ```
 */
export async function moveSubcollection(
  agent: Agent,
  input: MoveSubcollectionInput
): Promise<void> {
  // Delete old parent edge
  await deleteRecord(agent, input.oldParentEdgeUri);

  // Create new parent edge
  await addSubcollection(agent, {
    childCollectionUri: input.subcollectionUri,
    parentCollectionUri: input.newParentUri,
  });
}

/**
 * Update the note on a collection item edge.
 *
 * @param agent - Authenticated ATProto Agent
 * @param edgeUri - AT-URI of the edge to update
 * @param note - New note text
 * @returns Updated record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 *
 * @example
 * ```typescript
 * const result = await updateEdgeNote(agent, edgeUri, 'Updated annotation');
 * ```
 */
export async function updateEdgeNote(
  agent: Agent,
  edgeUri: string,
  note: string
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(edgeUri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot update records belonging to other users');
  }

  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.graph.edge',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as PersonalEdgeRecord;

  const record: PersonalEdgeRecord = {
    ...existing,
    metadata: {
      ...existing.metadata,
      note,
    },
  };

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.graph.edge',
    rkey: parsed.rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Update metadata fields (label, note) on a collection item edge.
 *
 * @param agent - Authenticated ATProto Agent
 * @param edgeUri - AT-URI of the edge to update
 * @param updates - Fields to update
 * @returns Updated record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 */
export async function updateEdgeMetadata(
  agent: Agent,
  edgeUri: string,
  updates: { label?: string; note?: string }
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(edgeUri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot update records belonging to other users');
  }

  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.graph.edge',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as PersonalEdgeRecord;

  const record: PersonalEdgeRecord = {
    ...existing,
    metadata: {
      ...existing.metadata,
      ...(updates.label !== undefined && { label: updates.label }),
      ...(updates.note !== undefined && { note: updates.note }),
    },
  };

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.graph.edge',
    rkey: parsed.rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Reorder items within a collection by updating the node's itemOrder metadata.
 *
 * @param agent - Authenticated ATProto Agent
 * @param collectionUri - AT-URI of the collection node
 * @param itemOrder - Ordered array of item AT-URIs
 * @returns Updated record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 *
 * @example
 * ```typescript
 * const result = await reorderCollectionItems(agent, collectionUri, [
 *   'at://did:plc:abc/pub.chive.eprint.submission/item-1',
 *   'at://did:plc:abc/pub.chive.eprint.submission/item-2',
 * ]);
 * ```
 */
export async function reorderCollectionItems(
  agent: Agent,
  collectionUri: string,
  itemOrder: string[]
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(collectionUri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot update records belonging to other users');
  }

  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as CollectionNodeRecord;

  const record: CollectionNodeRecord = {
    ...existing,
    metadata: {
      ...existing.metadata,
      itemOrder,
    },
  };

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// PERSONAL GRAPH OPERATIONS
// =============================================================================

/**
 * Personal graph edge record as stored in ATProto.
 */
export interface PersonalEdgeRecord {
  [key: string]: unknown;
  $type: 'pub.chive.graph.edge';
  id: string;
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
  metadata: Record<string, unknown>;
  status: 'established';
  createdAt: string;
}

/**
 * Personal graph node record as stored in ATProto.
 */
export interface PersonalNodeRecord {
  [key: string]: unknown;
  $type: 'pub.chive.graph.node';
  id: string;
  kind: string;
  subkind: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status: 'established';
  createdAt: string;
}

/**
 * Input for creating a personal graph node.
 */
export interface CreatePersonalNodeInput {
  /** Node kind (e.g., 'object', 'type') */
  kind: string;
  /** Node subkind (e.g., 'concept', 'reading-list') */
  subkind: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Update a personal graph node's label and/or description in the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param nodeUri - AT-URI of the node to update
 * @param updates - Fields to update
 * @returns Updated record result
 *
 * @throws Error if agent is not authenticated
 * @throws Error if record doesn't belong to user
 */
export async function updatePersonalNode(
  agent: Agent,
  nodeUri: string,
  updates: { label?: string; description?: string }
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(nodeUri);
  if (!parsed || parsed.did !== did) {
    throw new Error('Cannot update records belonging to other users');
  }

  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as PersonalNodeRecord;

  const record: PersonalNodeRecord = {
    ...existing,
    ...(updates.label !== undefined && { label: updates.label }),
    ...(updates.description !== undefined && { description: updates.description }),
  };

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Create a personal graph node in the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Node data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 *
 * @example
 * ```typescript
 * const result = await createPersonalNode(agent, {
 *   kind: 'object',
 *   subkind: 'concept',
 *   label: 'Attention Mechanism',
 *   description: 'Self-attention and variants',
 * });
 * ```
 */
export async function createPersonalNode(
  agent: Agent,
  input: CreatePersonalNodeInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const id = crypto.randomUUID();

  const record: PersonalNodeRecord = {
    $type: 'pub.chive.graph.node',
    id,
    kind: input.kind,
    subkind: input.subkind,
    label: input.label,
    status: 'established',
    createdAt: new Date().toISOString(),
  };

  if (input.description) {
    record.description = input.description;
  }
  if (input.metadata) {
    record.metadata = input.metadata;
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: id,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Input for creating a personal graph edge.
 */
export interface CreatePersonalEdgeInput {
  /** AT-URI of the source node */
  sourceUri: string;
  /** AT-URI of the target node */
  targetUri: string;
  /** Relation type slug (e.g., 'related-to', 'depends-on') */
  relationSlug: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a personal graph edge in the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Edge data
 * @returns Created record result
 *
 * @throws Error if agent is not authenticated
 *
 * @example
 * ```typescript
 * const result = await createPersonalEdge(agent, {
 *   sourceUri: 'at://did:plc:abc/pub.chive.graph.node/node-1',
 *   targetUri: 'at://did:plc:abc/pub.chive.graph.node/node-2',
 *   relationSlug: 'related-to',
 * });
 * ```
 */
export async function createPersonalEdge(
  agent: Agent,
  input: CreatePersonalEdgeInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const id = crypto.randomUUID();

  const record: PersonalEdgeRecord = {
    $type: 'pub.chive.graph.edge',
    id,
    sourceUri: input.sourceUri,
    targetUri: input.targetUri,
    relationSlug: input.relationSlug,
    metadata: input.metadata ?? {},
    status: 'established',
    createdAt: new Date().toISOString(),
  };

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.graph.edge',
    rkey: id,
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// PROFILE CONFIGURATION
// =============================================================================

/**
 * Profile config record as stored in ATProto.
 */
export interface ProfileConfigRecord {
  [key: string]: unknown;
  $type: 'pub.chive.actor.profileConfig';
  profileType?: string;
  sections: Array<{
    id: string;
    visible: boolean;
    order: number;
  }>;
  featuredCollectionUri?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Input for updating profile configuration.
 */
export interface UpdateProfileConfigInput {
  /** Profile type (e.g., 'individual', 'lab', 'organization') */
  profileType?: string;
  /** Ordered list of profile sections with visibility */
  sections: Array<{
    id: string;
    visible: boolean;
    order: number;
  }>;
  /** AT-URI of the featured collection on the profile */
  featuredCollectionUri?: string;
}

/**
 * Create or update the user's profile configuration in their PDS.
 *
 * @remarks
 * Uses putRecord with 'self' as rkey (ATProto convention for singleton records).
 * Controls how the user's profile page is rendered, including section visibility,
 * ordering, and which collection to feature prominently.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Profile configuration data
 * @returns Created/updated record result
 *
 * @throws Error if agent is not authenticated
 *
 * @example
 * ```typescript
 * const result = await updateProfileConfig(agent, {
 *   profileType: 'individual',
 *   sections: [
 *     { id: 'publications', visible: true, order: 0 },
 *     { id: 'collections', visible: true, order: 1 },
 *     { id: 'endorsements', visible: false, order: 2 },
 *   ],
 *   featuredCollectionUri: 'at://did:plc:abc/pub.chive.graph.node/uuid-123',
 * });
 * ```
 */
export async function updateProfileConfig(
  agent: Agent,
  input: UpdateProfileConfigInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: ProfileConfigRecord = {
    $type: 'pub.chive.actor.profileConfig',
    sections: input.sections,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (input.profileType) {
    record.profileType = input.profileType;
  }
  if (input.featuredCollectionUri) {
    record.featuredCollectionUri = input.featuredCollectionUri;
  }

  const response = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.actor.profileConfig',
    rkey: 'self',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// COSMIK INTEGRATION
// =============================================================================

/**
 * Maps Chive visibility to Semble's accessType values.
 */
function toCosmikAccessType(visibility: string): 'OPEN' | 'CLOSED' {
  return visibility === 'unlisted' ? 'CLOSED' : 'OPEN';
}

/**
 * Semble URL metadata matching `network.cosmik.card#urlMetadata`.
 *
 * @remarks
 * Semble requires `$type` on metadata objects for proper parsing. Confirmed
 * by inspecting Semble's own card rewrites in the PDS.
 *
 * @see https://github.com/cosmik-network/semble
 */
export interface CosmikUrlMetadata {
  $type: 'network.cosmik.card#urlMetadata';
  title?: string;
  description?: string;
  author?: string;
  siteName?: string;
  type?: string;
}

/**
 * Converts an AT-URI or bare DID to a Chive HTTP URL for Semble cards.
 *
 * @remarks
 * Semble fetches card URLs to build previews. AT-URIs and bare DIDs are not
 * fetchable, so we convert them to proper Chive web URLs.
 */
function toChiveUrl(itemUri: string, itemType?: string, subkind?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chive.pub';

  // Author/person items: URI is a bare DID
  if (itemType === 'author' || subkind === 'person') {
    const did = itemUri.startsWith('did:') ? itemUri : itemUri.split('/')[2];
    return `${origin}/authors/${did}`;
  }

  // Eprints: URI is an AT-URI for an eprint submission
  if (itemType === 'eprint' || subkind === 'eprint') {
    return `${origin}/eprints/${encodeURIComponent(itemUri)}`;
  }

  // Collections
  if (subkind === 'collection') {
    return `${origin}/collections/${encodeURIComponent(itemUri)}`;
  }

  // Default: generic graph node link
  return `${origin}/graph?node=${encodeURIComponent(itemUri)}`;
}

/**
 * Cosmik card record matching Semble's expected schema.
 *
 * @remarks
 * Cards represent individual URLs with nested content blocks.
 * Semble expects `type: 'URL'` (uppercase) and a `content` object.
 *
 * @see https://github.com/cosmik-network/semble
 */
export interface CosmikCardRecord {
  [key: string]: unknown;
  $type: 'network.cosmik.card';
  type: 'URL';
  url: string;
  content: {
    $type: 'network.cosmik.card#urlContent';
    url: string;
    metadata?: CosmikUrlMetadata;
  };
  createdAt: string;
}

/**
 * Item metadata from the collection wizard, used to build rich Semble card content.
 */
interface ItemMetadata {
  subkind?: string;
  description?: string;
  authors?: string[];
  handle?: string;
  kind?: string;
  avatarUrl?: string;
  isPersonal?: boolean;
}

/**
 * Builds typed Semble card metadata from a collection item's subkind and metadata.
 *
 * @param label - Display label for the item
 * @param subkind - Node subkind (eprint, person, field, institution, event, concept, reference)
 * @param metadata - Additional item metadata from the wizard
 * @returns Typed UrlMetadata object for Semble
 */
function buildSembleCardMetadata(
  label: string,
  subkind?: string,
  metadata?: ItemMetadata
): CosmikUrlMetadata {
  const result: CosmikUrlMetadata = {
    $type: 'network.cosmik.card#urlMetadata',
    title: label,
    siteName: 'Chive',
  };

  switch (subkind) {
    case 'eprint':
      if (metadata?.authors?.length) {
        result.author = metadata.authors.join(', ');
      }
      result.type = 'article';
      break;
    case 'field':
      result.description = metadata?.description || 'Research field';
      break;
    case 'institution':
      result.description = metadata?.description || 'Research institution';
      break;
    case 'event':
      result.description = metadata?.description || 'Academic event';
      break;
    case 'concept':
      result.description = metadata?.description || 'Concept';
      break;
    default:
      if (metadata?.description) {
        result.description = metadata.description;
      }
      break;
  }

  return result;
}

/**
 * Cosmik collection record matching Semble's expected schema.
 *
 * @remarks
 * Uses `name` (not `title`), `accessType` (not `visibility`), and does
 * not embed items. Items are linked via separate collectionLink records.
 */
export interface CosmikCollectionRecord {
  [key: string]: unknown;
  $type: 'network.cosmik.collection';
  name: string;
  description?: string;
  accessType: 'OPEN' | 'CLOSED';
  collaborators: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Cosmik collectionLink record matching Semble's expected schema.
 *
 * @remarks
 * Links a card to a collection. Uses ATProto StrongRef format
 * (`{ uri, cid }`) for both the card and collection references.
 */
export interface CosmikCollectionLinkRecord {
  [key: string]: unknown;
  $type: 'network.cosmik.collectionLink';
  card: { uri: string; cid: string };
  collection: { uri: string; cid: string };
  addedBy: string;
  addedAt: string;
  createdAt: string;
}

/**
 * Mapping of a single Cosmik item's record URIs, stored in Chive node metadata.
 */
export interface CosmikItemMapping {
  cardUri: string;
  cardCid: string;
  linkUri: string;
  linkCid: string;
}

/**
 * Create a Cosmik card record for a URL.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Card data
 * @returns Created record result
 *
 * @internal
 */
export async function createCosmikCard(
  agent: Agent,
  input: {
    url: string;
    title?: string;
    subkind?: string;
    itemType?: string;
    itemMetadata?: ItemMetadata;
  }
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const metadata = buildSembleCardMetadata(
    input.title ?? input.url,
    input.subkind,
    input.itemMetadata
  );

  // Convert AT-URIs/DIDs to fetchable Chive HTTP URLs
  const httpUrl = toChiveUrl(input.url, input.itemType, input.subkind);

  const record: CosmikCardRecord = {
    $type: 'network.cosmik.card',
    type: 'URL',
    url: httpUrl,
    content: {
      $type: 'network.cosmik.card#urlContent',
      url: httpUrl,
      metadata,
    },
    createdAt: new Date().toISOString(),
  };

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'network.cosmik.card',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Create a Cosmik collectionLink record linking a card to a collection.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Link data with StrongRefs
 * @returns Created record result
 *
 * @internal
 */
export async function createCosmikCollectionLink(
  agent: Agent,
  input: {
    cardUri: string;
    cardCid: string;
    collectionUri: string;
    collectionCid: string;
  }
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const now = new Date().toISOString();

  const record: CosmikCollectionLinkRecord = {
    $type: 'network.cosmik.collectionLink',
    card: { uri: input.cardUri, cid: input.cardCid },
    collection: { uri: input.collectionUri, cid: input.collectionCid },
    addedBy: did,
    addedAt: now,
    createdAt: now,
  };

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'network.cosmik.collectionLink',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

/**
 * Create a Cosmik mirror of a Chive collection using Semble's three-record model.
 *
 * @remarks
 * Creates a `network.cosmik.collection` record, then for each item creates
 * a `network.cosmik.card` and `network.cosmik.collectionLink`. Updates the
 * Chive collection node's metadata with all Cosmik URIs for future sync.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Mirror data
 * @returns Created Cosmik collection URI and item mappings
 */
export async function createCosmikMirror(
  agent: Agent,
  input: {
    /** AT-URI of the Chive collection node */
    collectionUri: string;
    /** Display name for the Cosmik collection */
    title: string;
    /** Optional description */
    description?: string;
    /** Visibility setting */
    visibility: 'listed' | 'unlisted';
    /** Items to create cards for */
    items: Array<{
      /** URL or AT-URI of the item */
      url: string;
      /** Display title */
      title?: string;
      /** Node subkind for rich card metadata */
      subkind?: string;
      /** Item type from the wizard (eprint, author, graphNode) */
      itemType?: string;
      /** Additional metadata for rich card content */
      metadata?: ItemMetadata;
    }>;
  }
): Promise<{
  cosmikCollectionUri: string;
  cosmikCollectionCid: string;
  cosmikItems: Record<string, CosmikItemMapping>;
}> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  recordLogger.info('Creating Cosmik mirror', {
    collectionUri: input.collectionUri,
    itemCount: input.items.length,
  });

  const now = new Date().toISOString();

  // Step 1: Create Cosmik collection record
  const collectionRecord: CosmikCollectionRecord = {
    $type: 'network.cosmik.collection',
    name: input.title,
    accessType: toCosmikAccessType(input.visibility),
    collaborators: [],
    createdAt: now,
    updatedAt: now,
  };

  if (input.description) {
    collectionRecord.description = input.description;
  }

  const collectionResponse = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'network.cosmik.collection',
    record: collectionRecord,
  });

  const cosmikCollectionUri = collectionResponse.data.uri;
  const cosmikCollectionCid = collectionResponse.data.cid;

  // Step 2: Create cards and links for each item
  const cosmikItems: Record<string, CosmikItemMapping> = {};

  for (const item of input.items) {
    const card = await createCosmikCard(agent, {
      url: item.url,
      title: item.title,
      subkind: item.subkind,
      itemType: item.itemType,
      itemMetadata: item.metadata,
    });

    const link = await createCosmikCollectionLink(agent, {
      cardUri: card.uri,
      cardCid: card.cid,
      collectionUri: cosmikCollectionUri,
      collectionCid: cosmikCollectionCid,
    });

    cosmikItems[item.url] = {
      cardUri: card.uri,
      cardCid: card.cid,
      linkUri: link.uri,
      linkCid: link.cid,
    };
  }

  // Step 3: Update the Chive collection node's metadata with Cosmik URIs
  const parsed = parseAtUri(input.collectionUri);
  if (parsed && parsed.did === did) {
    const existingResponse = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: 'pub.chive.graph.node',
      rkey: parsed.rkey,
    });

    const existing = existingResponse.data.value as CollectionNodeRecord;

    const updatedRecord: CollectionNodeRecord = {
      ...existing,
      metadata: {
        ...existing.metadata,
        cosmikCollectionUri,
        cosmikCollectionCid,
        cosmikItems,
      },
    };

    await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: 'pub.chive.graph.node',
      rkey: parsed.rkey,
      record: updatedRecord,
    });
  }

  recordLogger.info('Cosmik mirror created', {
    cosmikCollectionUri,
    cardCount: Object.keys(cosmikItems).length,
  });

  return { cosmikCollectionUri, cosmikCollectionCid, cosmikItems };
}

/**
 * Update a Cosmik collection record (name, description, accessType).
 *
 * @remarks
 * Fetches the existing record, merges changes, and puts it back.
 * Fire-and-forget: callers should wrap in try/catch.
 *
 * @param agent - Authenticated ATProto Agent
 * @param cosmikCollectionUri - AT-URI of the Cosmik collection
 * @param changes - Fields to update
 */
export async function updateCosmikCollection(
  agent: Agent,
  cosmikCollectionUri: string,
  changes: {
    name?: string;
    description?: string;
    visibility?: string;
  }
): Promise<void> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const parsed = parseAtUri(cosmikCollectionUri);
  if (!parsed) return;

  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: parsed.did,
    collection: 'network.cosmik.collection',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as CosmikCollectionRecord;

  const updatedRecord: CosmikCollectionRecord = {
    ...existing,
    updatedAt: new Date().toISOString(),
  };

  if (changes.name !== undefined) updatedRecord.name = changes.name;
  if (changes.description !== undefined) updatedRecord.description = changes.description;
  if (changes.visibility !== undefined)
    updatedRecord.accessType = toCosmikAccessType(changes.visibility);

  await agent.com.atproto.repo.putRecord({
    repo: parsed.did,
    collection: 'network.cosmik.collection',
    rkey: parsed.rkey,
    record: updatedRecord,
  });

  recordLogger.info('Cosmik collection updated', { cosmikCollectionUri });
}

/**
 * Delete an entire Cosmik mirror: all links, cards, and the collection.
 *
 * @remarks
 * Best-effort deletion. Logs warnings for individual failures but continues.
 *
 * @param agent - Authenticated ATProto Agent
 * @param cosmikCollectionUri - AT-URI of the Cosmik collection
 * @param cosmikItems - Mapping of item URLs to Cosmik record URIs
 */
export async function deleteCosmikMirror(
  agent: Agent,
  cosmikCollectionUri: string,
  cosmikItems?: Record<string, CosmikItemMapping>
): Promise<void> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  recordLogger.info('Deleting Cosmik mirror', { cosmikCollectionUri });

  // Delete all links and cards first
  if (cosmikItems) {
    for (const [url, mapping] of Object.entries(cosmikItems)) {
      try {
        await deleteCosmikRecord(agent, mapping.linkUri);
      } catch (err) {
        recordLogger.warn('Failed to delete Cosmik link', { url, linkUri: mapping.linkUri, err });
      }
      try {
        await deleteCosmikRecord(agent, mapping.cardUri);
      } catch (err) {
        recordLogger.warn('Failed to delete Cosmik card', { url, cardUri: mapping.cardUri, err });
      }
    }
  }

  // Delete the collection record
  try {
    await deleteCosmikRecord(agent, cosmikCollectionUri);
  } catch (err) {
    recordLogger.warn('Failed to delete Cosmik collection', { cosmikCollectionUri, err });
  }

  recordLogger.info('Cosmik mirror deleted', { cosmikCollectionUri });
}

/**
 * Delete a single ATProto record by AT-URI.
 *
 * @internal
 */
async function deleteCosmikRecord(agent: Agent, uri: string): Promise<void> {
  const parsed = parseAtUri(uri);
  if (!parsed) return;

  await agent.com.atproto.repo.deleteRecord({
    repo: parsed.did,
    collection: parsed.collection,
    rkey: parsed.rkey,
  });
}

/**
 * Add a single item to an existing Cosmik mirror.
 *
 * @remarks
 * Creates a card and collectionLink, then updates the Chive node's
 * `cosmikItems` metadata with the new mapping.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Item and collection data
 * @returns The created card and link URIs
 */
export async function addCosmikItem(
  agent: Agent,
  input: {
    chiveCollectionUri: string;
    cosmikCollectionUri: string;
    cosmikCollectionCid: string;
    url: string;
    title?: string;
    subkind?: string;
    itemType?: string;
    itemMetadata?: ItemMetadata;
  }
): Promise<CosmikItemMapping> {
  const card = await createCosmikCard(agent, {
    url: input.url,
    title: input.title,
    subkind: input.subkind,
    itemType: input.itemType,
    itemMetadata: input.itemMetadata,
  });

  const link = await createCosmikCollectionLink(agent, {
    cardUri: card.uri,
    cardCid: card.cid,
    collectionUri: input.cosmikCollectionUri,
    collectionCid: input.cosmikCollectionCid,
  });

  const mapping: CosmikItemMapping = {
    cardUri: card.uri,
    cardCid: card.cid,
    linkUri: link.uri,
    linkCid: link.cid,
  };

  // Update node metadata with the new item mapping
  await updateCosmikItemsMetadata(agent, input.chiveCollectionUri, {
    [input.url]: mapping,
  });

  return mapping;
}

/**
 * Remove a single item from a Cosmik mirror.
 *
 * @remarks
 * Deletes the collectionLink and card records, then removes the entry
 * from the Chive node's `cosmikItems` metadata.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - URIs of the records to delete
 */
export async function removeCosmikItem(
  agent: Agent,
  input: {
    chiveCollectionUri: string;
    url: string;
    cardUri: string;
    linkUri: string;
  }
): Promise<void> {
  // Delete link first, then card
  try {
    await deleteCosmikRecord(agent, input.linkUri);
  } catch (err) {
    recordLogger.warn('Failed to delete Cosmik link', { linkUri: input.linkUri, err });
  }
  try {
    await deleteCosmikRecord(agent, input.cardUri);
  } catch (err) {
    recordLogger.warn('Failed to delete Cosmik card', { cardUri: input.cardUri, err });
  }

  // Remove from node metadata
  await removeCosmikItemMetadata(agent, input.chiveCollectionUri, input.url);
}

/**
 * Merge new Cosmik item mappings into the Chive node's metadata.
 *
 * @internal
 */
async function updateCosmikItemsMetadata(
  agent: Agent,
  chiveCollectionUri: string,
  newItems: Record<string, CosmikItemMapping>
): Promise<void> {
  const did = getAgentDid(agent);
  if (!did) return;

  const parsed = parseAtUri(chiveCollectionUri);
  if (!parsed || parsed.did !== did) return;

  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as CollectionNodeRecord;
  const currentItems = (existing.metadata.cosmikItems ?? {}) as Record<string, CosmikItemMapping>;

  const updatedRecord: CollectionNodeRecord = {
    ...existing,
    metadata: {
      ...existing.metadata,
      cosmikItems: { ...currentItems, ...newItems },
    },
  };

  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
    record: updatedRecord,
  });
}

/**
 * Remove a single item's Cosmik mapping from the Chive node's metadata.
 *
 * @internal
 */
async function removeCosmikItemMetadata(
  agent: Agent,
  chiveCollectionUri: string,
  url: string
): Promise<void> {
  const did = getAgentDid(agent);
  if (!did) return;

  const parsed = parseAtUri(chiveCollectionUri);
  if (!parsed || parsed.did !== did) return;

  const existingResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
  });

  const existing = existingResponse.data.value as CollectionNodeRecord;
  const currentItems = {
    ...((existing.metadata.cosmikItems ?? {}) as Record<string, CosmikItemMapping>),
  };
  delete currentItems[url];

  const updatedRecord: CollectionNodeRecord = {
    ...existing,
    metadata: {
      ...existing.metadata,
      cosmikItems: currentItems,
    },
  };

  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'pub.chive.graph.node',
    rkey: parsed.rkey,
    record: updatedRecord,
  });
}

// =============================================================================
// CHANGELOG RECORDS
// =============================================================================

/**
 * Input for creating a changelog record.
 */
export interface CreateChangelogInput {
  /** AT-URI of the eprint this changelog belongs to */
  eprintUri: string;
  /** Semantic version this changelog describes */
  version: { major: number; minor: number; patch: number };
  /** Previous semantic version */
  previousVersion?: { major: number; minor: number; patch: number };
  /** One-line summary of changes */
  summary?: string;
  /** Structured changelog sections */
  sections: Array<{
    category: string;
    items: Array<{
      description: string;
      changeType?: string;
      location?: string;
      reviewReference?: string;
    }>;
  }>;
  /** Response to peer review feedback */
  reviewerResponse?: string;
}

/**
 * Creates a changelog record in the user's PDS.
 *
 * @param agent - authenticated ATProto agent
 * @param input - changelog data including version, sections, and optional summary
 * @returns the created record's URI and CID
 *
 * @example
 * ```typescript
 * const result = await createChangelogRecord(agent, {
 *   eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
 *   version: { major: 1, minor: 1, patch: 0 },
 *   previousVersion: { major: 1, minor: 0, patch: 0 },
 *   summary: 'Updated methodology section',
 *   sections: [{
 *     category: 'methodology',
 *     items: [{ description: 'Replaced sampling method', changeType: 'changed' }],
 *   }],
 * });
 * ```
 */
export async function createChangelogRecord(
  agent: Agent,
  input: CreateChangelogInput
): Promise<CreateRecordResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  const record: Record<string, unknown> = {
    $type: 'pub.chive.eprint.changelog',
    eprintUri: input.eprintUri,
    version: input.version,
    sections: input.sections,
    createdAt: new Date().toISOString(),
  };

  if (input.previousVersion) {
    record.previousVersion = input.previousVersion;
  }

  if (input.summary) {
    record.summary = input.summary;
  }

  if (input.reviewerResponse) {
    record.reviewerResponse = input.reviewerResponse;
  }

  recordLogger.info('Creating changelog record', {
    eprintUri: input.eprintUri,
    version: `${input.version.major}.${input.version.minor}.${input.version.patch}`,
  });

  const response = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: 'pub.chive.eprint.changelog',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// =============================================================================
// INTERNAL HELPERS (for collection cascade operations)
// =============================================================================

/**
 * Minimal edge representation for cascade operations.
 */
interface MinimalEdge {
  uri: string;
  sourceUri: string;
  targetUri: string;
  relationSlug: string;
}

/**
 * Lists personal graph edges where the given URI is the source.
 *
 * @remarks
 * Uses listRecords to scan the user's edge collection. This is used
 * internally for cascade deletion of collection nodes.
 */
async function listPersonalEdgesForSource(
  agent: Agent,
  did: string,
  sourceUri: string
): Promise<MinimalEdge[]> {
  const edges: MinimalEdge[] = [];

  try {
    const response = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: 'pub.chive.graph.edge',
      limit: 100,
    });

    for (const item of response.data.records) {
      const record = item.value as PersonalEdgeRecord;
      if (record.sourceUri === sourceUri) {
        edges.push({
          uri: item.uri,
          sourceUri: record.sourceUri,
          targetUri: record.targetUri,
          relationSlug: record.relationSlug,
        });
      }
    }
  } catch {
    recordLogger.warn('Failed to list edges for source', { sourceUri });
  }

  return edges;
}

/**
 * Lists personal graph edges where the given URI is the target.
 *
 * @remarks
 * Uses listRecords to scan the user's edge collection. This is used
 * internally for cascade deletion of collection nodes.
 */
async function listPersonalEdgesForTarget(
  agent: Agent,
  did: string,
  targetUri: string
): Promise<MinimalEdge[]> {
  const edges: MinimalEdge[] = [];

  try {
    const response = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: 'pub.chive.graph.edge',
      limit: 100,
    });

    for (const item of response.data.records) {
      const record = item.value as PersonalEdgeRecord;
      if (record.targetUri === targetUri) {
        edges.push({
          uri: item.uri,
          sourceUri: record.sourceUri,
          targetUri: record.targetUri,
          relationSlug: record.relationSlug,
        });
      }
    }
  } catch {
    recordLogger.warn('Failed to list edges for target', { targetUri });
  }

  return edges;
}
