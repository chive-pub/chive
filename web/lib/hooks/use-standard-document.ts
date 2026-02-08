/**
 * React hooks for standard.site document management.
 *
 * @remarks
 * Provides hooks for creating and managing site.standard.document records,
 * enabling cross-platform discovery of eprints across the ATProto ecosystem.
 *
 * @packageDocumentation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAgent } from '@/lib/auth/auth-context';
import {
  createStandardDocument,
  updateStandardDocument,
  createEprintRecord,
  type CreateRecordResult,
  type CreateStandardDocumentInput,
  type UpdateStandardDocumentInput,
} from '@/lib/atproto';
import type { EprintFormData } from '@/lib/schemas/eprint';
import { logger } from '@/lib/observability';

const standardDocLogger = logger.child({ component: 'use-standard-document' });

/**
 * Query key factory for standard document queries.
 */
export const standardDocumentKeys = {
  /** Base key for all standard document queries */
  all: ['standardDocuments'] as const,
  /** Key for standard document list queries */
  lists: () => [...standardDocumentKeys.all, 'list'] as const,
  /** Key for specific standard document detail query */
  detail: (uri: string) => [...standardDocumentKeys.all, 'detail', uri] as const,
};

/**
 * Hook for creating a standard.site document.
 *
 * @remarks
 * Creates a site.standard.document record in the user's PDS that references
 * a platform-specific content record (e.g., an eprint). This enables
 * cross-platform discovery.
 *
 * @example
 * ```tsx
 * const { mutateAsync: createDoc, isPending } = useCreateStandardDocument();
 *
 * const handleCreate = async () => {
 *   const result = await createDoc({
 *     title: 'My Paper',
 *     description: 'Abstract...',
 *     eprintUri: 'at://did:plc:abc/pub.chive.eprint.submission/123',
 *     eprintCid: 'bafy...',
 *   });
 *   console.log('Created:', result.uri);
 * };
 * ```
 *
 * @returns Mutation object for creating standard documents
 */
export function useCreateStandardDocument() {
  const agent = useAgent();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateStandardDocumentInput): Promise<CreateRecordResult> => {
      if (!agent) {
        throw new Error('Agent is not authenticated');
      }

      standardDocLogger.info('Creating standard.site document', { title: input.title });
      const result = await createStandardDocument(agent, input);
      standardDocLogger.info('Standard.site document created', { uri: result.uri });

      return result;
    },
    onSuccess: () => {
      // Invalidate standard document queries to refresh any lists
      queryClient.invalidateQueries({ queryKey: standardDocumentKeys.all });
    },
  });
}

/**
 * Hook for updating a standard.site document.
 *
 * @remarks
 * Updates an existing site.standard.document record. Useful when the
 * underlying eprint changes (new version, updated metadata).
 *
 * @example
 * ```tsx
 * const { mutateAsync: updateDoc, isPending } = useUpdateStandardDocument();
 *
 * const handleUpdate = async () => {
 *   const result = await updateDoc({
 *     uri: existingDocUri,
 *     title: 'Updated Title',
 *   });
 *   console.log('Updated:', result.uri);
 * };
 * ```
 *
 * @returns Mutation object for updating standard documents
 */
export function useUpdateStandardDocument() {
  const agent = useAgent();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateStandardDocumentInput): Promise<CreateRecordResult> => {
      if (!agent) {
        throw new Error('Agent is not authenticated');
      }

      standardDocLogger.info('Updating standard.site document', { uri: input.uri });
      const result = await updateStandardDocument(agent, input);
      standardDocLogger.info('Standard.site document updated', { uri: result.uri });

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific document query
      queryClient.invalidateQueries({ queryKey: standardDocumentKeys.detail(variables.uri) });
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: standardDocumentKeys.lists() });
    },
  });
}

/**
 * Result from dual-write operation (eprint + standard document).
 */
export interface DualWriteResult {
  /** The created eprint record result */
  eprint: CreateRecordResult;
  /** The created standard document result (if enabled) */
  standardDocument?: CreateRecordResult;
}

/**
 * Options for the dual-write hook.
 */
export interface DualWriteOptions {
  /** Whether to create a standard.site document alongside the eprint */
  createStandardDocument?: boolean;
}

/**
 * Hook for creating both an eprint and a standard.site document together.
 *
 * @remarks
 * This hook provides a single mutation that creates both a Chive eprint
 * and an optional site.standard.document record. The standard document
 * references the eprint, enabling cross-platform discovery.
 *
 * The dual-write is atomic in the sense that if the standard document
 * creation fails, the eprint is still created (but an error is logged).
 * This is intentional: the eprint is the primary record, and the standard
 * document is a discovery enhancement.
 *
 * @example
 * ```tsx
 * const { mutateAsync: submit, isPending } = useDualWriteEprint();
 *
 * const handleSubmit = async (formData: EprintFormData) => {
 *   const result = await submit({
 *     data: formData,
 *     options: { createStandardDocument: true },
 *   });
 *
 *   console.log('Eprint:', result.eprint.uri);
 *   if (result.standardDocument) {
 *     console.log('Standard doc:', result.standardDocument.uri);
 *   }
 * };
 * ```
 *
 * @returns Mutation object for dual-write operations
 */
export function useDualWriteEprint() {
  const agent = useAgent();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      data,
      options = {},
    }: {
      data: EprintFormData;
      options?: DualWriteOptions;
    }): Promise<DualWriteResult> => {
      if (!agent) {
        throw new Error('Agent is not authenticated');
      }

      // 1. Create the eprint record
      standardDocLogger.info('Creating eprint record', { title: data.title });
      const eprintResult = await createEprintRecord(agent, data);
      standardDocLogger.info('Eprint record created', { uri: eprintResult.uri });

      const result: DualWriteResult = { eprint: eprintResult };

      // 2. Optionally create the standard.site document
      if (options.createStandardDocument) {
        try {
          standardDocLogger.info('Creating standard.site document', {
            eprintUri: eprintResult.uri,
          });

          // Extract plain text abstract for description
          // The abstract may be rich text (array of items), so extract text content
          let description: string | undefined;
          if (typeof data.abstract === 'string') {
            description = data.abstract;
          }

          const docResult = await createStandardDocument(agent, {
            title: data.title,
            description,
            eprintUri: eprintResult.uri,
            eprintCid: eprintResult.cid,
          });

          result.standardDocument = docResult;
          standardDocLogger.info('Standard.site document created', { uri: docResult.uri });
        } catch (error) {
          // Log but don't fail the overall operation
          // The eprint is the primary record; standard.site is a discovery enhancement
          standardDocLogger.error(
            'Failed to create standard.site document; eprint was created successfully',
            error instanceof Error ? error : new Error(String(error)),
            { errorMessage: error instanceof Error ? error.message : String(error) }
          );
        }
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate eprint queries
      queryClient.invalidateQueries({ queryKey: ['eprints'] });
      // Invalidate standard document queries
      queryClient.invalidateQueries({ queryKey: standardDocumentKeys.all });
    },
  });
}
