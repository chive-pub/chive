'use client';

/**
 * Hook for posting content to Bluesky.
 *
 * @remarks
 * Uses the authenticated ATProto agent to create posts with external embeds.
 */

import { useCallback } from 'react';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useAgent, useAuth } from '@/lib/auth';
import { attachBlueskyPostToDocument } from '@/lib/atproto';
import { createLogger } from '@/lib/observability/logger';
import {
  createBlueskyPost,
  type CreateBlueskyPostInput,
  type CreateBlueskyPostResult,
  type ShareContent,
} from '@/lib/bluesky';

/**
 * Options for the useShareToBluesky hook.
 */
interface UseShareToBlueskyOptions {
  /** Called on successful post */
  onSuccess?: (result: CreateBlueskyPostResult) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Result of the useShareToBluesky hook.
 */
interface UseShareToBlueskyResult {
  /** Post to Bluesky */
  postToBluesky: (
    text: string,
    content: ShareContent,
    thumbBlob?: Uint8Array
  ) => Promise<CreateBlueskyPostResult>;
  /** Mutation state */
  mutation: UseMutationResult<CreateBlueskyPostResult, Error, CreateBlueskyPostInput>;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether posting is in progress */
  isPosting: boolean;
  /** Last error */
  error: Error | null;
}

/**
 * Hook for posting content to Bluesky.
 *
 * @param options - Hook options
 * @returns Hook result with post function and state
 *
 * @example
 * ```tsx
 * function ShareButton({ content }: { content: ShareContent }) {
 *   const { postToBluesky, isPosting, isAuthenticated } = useShareToBluesky({
 *     onSuccess: (result) => toast.success('Posted!'),
 *     onError: (error) => toast.error(error.message),
 *   });
 *
 *   if (!isAuthenticated) {
 *     return <LoginPrompt />;
 *   }
 *
 *   return (
 *     <Button
 *       onClick={() => postToBluesky('Check this out!', content)}
 *       disabled={isPosting}
 *     >
 *       Share
 *     </Button>
 *   );
 * }
 * ```
 */
const shareLogger = createLogger({ context: { component: 'use-share-to-bluesky' } });

export function useShareToBluesky(options?: UseShareToBlueskyOptions): UseShareToBlueskyResult {
  const agent = useAgent();
  const { isAuthenticated } = useAuth();

  const mutation = useMutation<CreateBlueskyPostResult, Error, CreateBlueskyPostInput>({
    mutationFn: async (input) => {
      if (!agent) {
        throw new Error('Not authenticated');
      }
      const result = await createBlueskyPost(agent, input);

      // Record the announcing post on the eprint's standard.site document, so
      // its reply thread is discoverable as the paper's off-platform
      // discussion. Deliberately after the post and deliberately swallowed: the
      // share has already succeeded, and an eprint whose submitter turned
      // cross-platform discovery off simply has no document to update.
      if (input.eprintUri) {
        try {
          await attachBlueskyPostToDocument(agent, input.eprintUri, {
            uri: result.uri,
            cid: result.cid,
          });
        } catch (error) {
          shareLogger.warn('Could not record the Bluesky post on the standard.site document', {
            eprintUri: input.eprintUri,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return result;
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });

  const postToBluesky = useCallback(
    async (
      text: string,
      content: ShareContent,
      thumbBlob?: Uint8Array
    ): Promise<CreateBlueskyPostResult> => {
      const input: CreateBlueskyPostInput = {
        text,
        ...(content.eprintUri ? { eprintUri: content.eprintUri } : {}),
        embed: {
          uri: content.url,
          title: content.title,
          description: content.description,
          thumbBlob,
        },
      };

      return mutation.mutateAsync(input);
    },
    [mutation]
  );

  return {
    postToBluesky,
    mutation,
    isAuthenticated,
    isPosting: mutation.isPending,
    error: mutation.error,
  };
}
