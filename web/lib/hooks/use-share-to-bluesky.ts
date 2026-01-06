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
export function useShareToBluesky(options?: UseShareToBlueskyOptions): UseShareToBlueskyResult {
  const agent = useAgent();
  const { isAuthenticated } = useAuth();

  const mutation = useMutation<CreateBlueskyPostResult, Error, CreateBlueskyPostInput>({
    mutationFn: async (input) => {
      if (!agent) {
        throw new Error('Not authenticated');
      }
      return createBlueskyPost(agent, input);
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
