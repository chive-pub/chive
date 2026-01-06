/**
 * Bluesky posting service for sharing Chive content.
 *
 * @remarks
 * Creates posts in the user's PDS with external embed link cards.
 * Uses the official @atproto/api RichText class for facet detection.
 *
 * @see https://docs.bsky.app/docs/tutorials/creating-a-post
 * @see https://docs.bsky.app/docs/advanced-guides/posts
 * @packageDocumentation
 */

import { RichText, AppBskyFeedPost } from '@atproto/api';
import type { Agent } from '@atproto/api';
import type { BlobRef } from '@atproto/lexicon';
import { countGraphemes as countGraphemesImpl } from 'unicode-segmenter/grapheme';
import type { CreateBlueskyPostInput, CreateBlueskyPostResult } from './types';

/** Maximum thumbnail size in bytes (1MB) */
const MAX_THUMBNAIL_SIZE = 1_000_000;

/** Bluesky post collection NSID */
const POST_COLLECTION = 'app.bsky.feed.post';

/**
 * Get the authenticated DID from an agent.
 *
 * @param agent - ATProto Agent
 * @returns User's DID or undefined if not authenticated
 */
function getAgentDid(agent: Agent): string | undefined {
  return (agent as unknown as { did?: string }).did;
}

/**
 * Upload a thumbnail blob to the user's PDS.
 *
 * @param agent - Authenticated ATProto Agent
 * @param imageBytes - Image data as Uint8Array (must be under 1MB)
 * @returns BlobRef for use in post embed
 *
 * @throws Error if image exceeds 1MB limit
 */
async function uploadThumbnail(agent: Agent, imageBytes: Uint8Array): Promise<BlobRef> {
  if (imageBytes.length > MAX_THUMBNAIL_SIZE) {
    throw new Error(`Thumbnail exceeds 1MB limit (${imageBytes.length} bytes)`);
  }

  const response = await agent.uploadBlob(imageBytes, {
    encoding: 'image/png',
  });

  return response.data.blob;
}

/**
 * Create a Bluesky post with an external embed (link card).
 *
 * @remarks
 * This function:
 * 1. Creates RichText and detects facets (mentions, links, hashtags)
 * 2. Uploads thumbnail blob if provided (max 1MB)
 * 3. Creates the post record with external embed
 * 4. Returns the URI, CID, and rkey for linking to the post
 *
 * The post is created in the user's PDS via ATProto.
 * RichText.detectFacets() handles UTF-16 to UTF-8 byte conversion automatically.
 *
 * @param agent - Authenticated ATProto Agent
 * @param input - Post content with text and embed details
 * @returns Created post result with URI, CID, and rkey
 *
 * @throws Error if agent is not authenticated
 * @throws Error if thumbnail upload fails
 * @throws Error if post creation fails
 * @throws Error with retryAfter for rate limiting (429)
 *
 * @example
 * ```typescript
 * const agent = useAgent();
 * if (!agent) throw new Error('Not authenticated');
 *
 * const result = await createBlueskyPost(agent, {
 *   text: 'Check out this preprint!',
 *   embed: {
 *     uri: 'https://chive.pub/preprints/at://did:plc:abc/...',
 *     title: 'Novel Approach to Quantum Computing',
 *     description: 'We present a new method...',
 *     thumbBlob: ogImageBytes,
 *   },
 * });
 *
 * // Open post on Bluesky
 * window.open(`https://bsky.app/profile/${agent.session.did}/post/${result.rkey}`);
 * ```
 */
export async function createBlueskyPost(
  agent: Agent,
  input: CreateBlueskyPostInput
): Promise<CreateBlueskyPostResult> {
  const did = getAgentDid(agent);
  if (!did) {
    throw new Error('Agent is not authenticated');
  }

  // 1. Create RichText and detect facets
  // This resolves @mentions to DIDs and detects #hashtags and URLs
  const rt = new RichText({ text: input.text });
  await rt.detectFacets(agent);

  // 2. Upload thumbnail blob if provided
  let thumbRef: BlobRef | undefined;
  if (input.embed.thumbBlob) {
    thumbRef = await uploadThumbnail(agent, input.embed.thumbBlob);
  }

  // 3. Build the post record
  const record: AppBskyFeedPost.Record = {
    $type: 'app.bsky.feed.post',
    text: rt.text,
    facets: rt.facets,
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: input.embed.uri,
        title: input.embed.title,
        description: input.embed.description,
        ...(thumbRef ? { thumb: thumbRef } : {}),
      },
    },
    createdAt: new Date().toISOString(),
  };

  // 4. Create the record in user's PDS
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo: did,
      collection: POST_COLLECTION,
      record,
    });

    // Extract rkey from URI for constructing bsky.app URL
    const rkey = response.data.uri.split('/').pop()!;

    return {
      uri: response.data.uri,
      cid: response.data.cid,
      rkey,
    };
  } catch (error: unknown) {
    // Handle rate limiting
    if (isRateLimitError(error)) {
      const retryAfter = extractRetryAfter(error);
      const rateLimitError = new Error(`Rate limited. Try again in ${retryAfter} seconds.`);
      (rateLimitError as Error & { retryAfter: number }).retryAfter = retryAfter;
      throw rateLimitError;
    }
    throw error;
  }
}

/**
 * Check if an error is a rate limit (429) error.
 */
function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as { status?: number; statusCode?: number };
    return err.status === 429 || err.statusCode === 429;
  }
  return false;
}

/**
 * Extract retry-after seconds from a rate limit error.
 */
function extractRetryAfter(error: unknown): number {
  if (error && typeof error === 'object') {
    const err = error as { headers?: { 'retry-after'?: string } };
    const retryAfter = err.headers?.['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds;
      }
    }
  }
  // Default to 60 seconds if not specified
  return 60;
}

/**
 * Fetch an OG image and convert to Uint8Array for embedding.
 *
 * @remarks
 * Fetches the image from the given URL and returns the bytes.
 * If the image is larger than 1MB, it will throw an error.
 *
 * @param ogImageUrl - URL to the OG image
 * @returns Image bytes as Uint8Array
 *
 * @throws Error if fetch fails
 * @throws Error if image exceeds 1MB
 */
export async function fetchOgImageBlob(ogImageUrl: string): Promise<Uint8Array> {
  const response = await fetch(ogImageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch OG image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length > MAX_THUMBNAIL_SIZE) {
    throw new Error(`OG image exceeds 1MB limit (${bytes.length} bytes)`);
  }

  return bytes;
}

/**
 * Count graphemes in a string (for Bluesky's 300 character limit).
 *
 * @remarks
 * Bluesky uses grapheme clusters per UAX #29, not code points or bytes.
 * This uses the same `unicode-segmenter` library that Bluesky uses internally
 * via `@atproto/lex-data`, ensuring exact compatibility with Bluesky's counting.
 *
 * @param text - Text to count
 * @returns Number of grapheme clusters
 *
 * @example
 * ```typescript
 * countGraphemes('Hello'); // 5
 * countGraphemes('👨‍👩‍👧‍👧'); // 1 (family emoji is one grapheme)
 * countGraphemes('café'); // 4 (e with accent is one grapheme)
 * ```
 *
 * @see https://github.com/cometkim/unicode-segmenter
 * @see https://unicode.org/reports/tr29/ - UAX #29 Unicode Text Segmentation
 */
export function countGraphemes(text: string): number {
  return countGraphemesImpl(text);
}

/**
 * Validate that text is within Bluesky's character limit.
 *
 * @param text - Text to validate
 * @returns Object with isValid flag and grapheme count
 */
export function validatePostLength(text: string): { isValid: boolean; count: number } {
  const count = countGraphemes(text);
  return {
    isValid: count <= 300,
    count,
  };
}

/**
 * Build the Bluesky web URL for a post.
 *
 * @param did - User's DID
 * @param rkey - Post record key
 * @returns URL to view the post on bsky.app
 */
export function buildBlueskyPostUrl(did: string, rkey: string): string {
  return `https://bsky.app/profile/${did}/post/${rkey}`;
}
