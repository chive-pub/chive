/**
 * ATProto utilities for Chive.
 *
 * @remarks
 * Provides functions for creating and managing ATProto records.
 * All user data is stored in user PDSes, not in Chive infrastructure.
 *
 * @packageDocumentation
 */

export {
  // Types
  type CreateRecordResult,
  type UploadBlobResult,
  type EprintRecord,
  type FieldProposalRecord,
  type VoteRecord,
  // Blob upload
  uploadBlob,
  uploadDocument,
  // Eprint records
  createEprintRecord,
  // Governance records
  createFieldProposalRecord,
  createVoteRecord,
  // Record management
  deleteRecord,
  // Utilities
  isAgentAuthenticated,
  getAuthenticatedDid,
  buildAtUri,
  parseAtUri,
} from './record-creator';
