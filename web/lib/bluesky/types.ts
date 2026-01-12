/**
 * Bluesky posting service types.
 *
 * @remarks
 * Types for creating posts with external embeds (link cards)
 * following the official ATProto/Bluesky specifications.
 *
 * @see https://docs.bsky.app/docs/tutorials/creating-a-post
 * @packageDocumentation
 */

import type { BlobRef } from '@atproto/lexicon';

/**
 * External embed content for link preview cards.
 */
export interface ExternalEmbed {
  /** The URL to embed */
  uri: string;
  /** Title for the link card */
  title: string;
  /** Description for the link card */
  description: string;
  /** Pre-fetched OG image as bytes (optional, max 1MB) */
  thumbBlob?: Uint8Array;
}

/**
 * Input for creating a Bluesky post.
 */
export interface CreateBlueskyPostInput {
  /** Post text content (max 300 graphemes) */
  text: string;
  /** External embed for link preview card */
  embed: ExternalEmbed;
}

/**
 * Result of creating a Bluesky post.
 */
export interface CreateBlueskyPostResult {
  /** AT-URI of the created post */
  uri: string;
  /** CID of the created post */
  cid: string;
  /** Record key (for constructing bsky.app URL) */
  rkey: string;
}

/**
 * Bluesky post record structure.
 *
 * @see https://docs.bsky.app/docs/advanced-guides/posts
 */
export interface BlueskyPostRecord {
  $type: 'app.bsky.feed.post';
  text: string;
  facets?: BlueskyFacet[];
  embed?: {
    $type: 'app.bsky.embed.external';
    external: {
      uri: string;
      title: string;
      description: string;
      thumb?: BlobRef;
    };
  };
  createdAt: string;
}

/**
 * Rich text facet for mentions, links, and hashtags.
 *
 * @see https://docs.bsky.app/docs/advanced-guides/post-richtext
 */
export interface BlueskyFacet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: BlueskyFacetFeature[];
}

/**
 * Facet feature types.
 */
export type BlueskyFacetFeature =
  | { $type: 'app.bsky.richtext.facet#mention'; did: string }
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string };

/**
 * Content types supported for sharing.
 */
export type ShareableContentType = 'eprint' | 'author' | 'review' | 'endorsement';

/**
 * Share content metadata.
 */
export interface ShareContent {
  /** Type of content being shared */
  type: ShareableContentType;
  /** Full URL to the content */
  url: string;
  /** Title for the link card */
  title: string;
  /** Description for the link card */
  description: string;
  /** URL to the OG image */
  ogImageUrl: string;
}

/**
 * Bluesky rate limit error details.
 *
 * @remarks
 * Named differently from lib/errors.ts RateLimitError class to avoid export conflict.
 */
export interface BlueskyRateLimitInfo {
  retryAfter: number;
  message: string;
}
