'use client';

/**
 * RichTextRenderer component for displaying ATProto rich text with facets.
 *
 * @remarks
 * Renders text with embedded facets (mentions, links, hashtags) as interactive elements.
 * Uses byte-based indexing consistent with ATProto's facet format.
 *
 * This is distinct from AnnotationBodyRenderer which handles FOVEA-style
 * frontend-only rich annotation items. RichTextRenderer handles the API's
 * standard ATProto `{ text, facets }` format.
 *
 * @example
 * ```tsx
 * <RichTextRenderer
 *   text="Check out @alice.bsky.social's paper!"
 *   facets={[
 *     {
 *       index: { byteStart: 10, byteEnd: 28 },
 *       features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:abc' }]
 *     }
 *   ]}
 * />
 * ```
 *
 * @packageDocumentation
 */

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Facet feature types from ATProto.
 */
export type FacetFeature =
  | { $type: 'app.bsky.richtext.facet#mention'; did: string }
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string };

/**
 * Facet structure from ATProto.
 */
export interface Facet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: FacetFeature[];
}

/**
 * Props for the RichTextRenderer component.
 */
export interface RichTextRendererProps {
  /** Plain text content */
  text: string;
  /** Rich text facets */
  facets?: Facet[];
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Convert a byte index to a string index.
 *
 * @remarks
 * ATProto facets use byte indices (UTF-8), but JavaScript strings use
 * UTF-16 code units. This function converts byte indices to string indices
 * by encoding the text and mapping byte positions to character positions.
 */
function byteToStringIndex(text: string, byteIndex: number): number {
  // For pure ASCII text, byte and string indices are the same
  // This handles the common case efficiently
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  // If byteIndex is beyond text, return text length
  if (byteIndex >= bytes.length) {
    return text.length;
  }

  // Count characters up to the byte index
  let currentBytePos = 0;
  let charIndex = 0;

  for (const char of text) {
    if (currentBytePos >= byteIndex) {
      return charIndex;
    }
    const charBytes = encoder.encode(char).length;
    currentBytePos += charBytes;
    charIndex++;
  }

  return charIndex;
}

/**
 * Extract the text segment for a facet.
 */
function extractFacetText(text: string, facet: Facet): string {
  const start = byteToStringIndex(text, facet.index.byteStart);
  const end = byteToStringIndex(text, facet.index.byteEnd);
  return text.slice(start, end);
}

/**
 * Segment representing a part of the text.
 */
interface TextSegment {
  type: 'text' | 'mention' | 'link' | 'tag';
  text: string;
  /** DID for mentions */
  did?: string;
  /** URI for links */
  uri?: string;
  /** Tag name for hashtags */
  tag?: string;
}

/**
 * Parse text and facets into renderable segments.
 */
function parseTextWithFacets(text: string, facets?: Facet[]): TextSegment[] {
  if (!facets || facets.length === 0) {
    return [{ type: 'text', text }];
  }

  // Sort facets by start position
  const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

  const segments: TextSegment[] = [];
  let currentByteIndex = 0;

  for (const facet of sortedFacets) {
    const startStringIndex = byteToStringIndex(text, currentByteIndex);
    const facetStartStringIndex = byteToStringIndex(text, facet.index.byteStart);

    // Add plain text before this facet
    if (facetStartStringIndex > startStringIndex) {
      const plainText = text.slice(startStringIndex, facetStartStringIndex);
      if (plainText) {
        segments.push({ type: 'text', text: plainText });
      }
    }

    // Add the facet segment
    const facetText = extractFacetText(text, facet);
    const feature = facet.features[0]; // Use first feature

    if (feature) {
      switch (feature.$type) {
        case 'app.bsky.richtext.facet#mention':
          segments.push({
            type: 'mention',
            text: facetText,
            did: feature.did,
          });
          break;
        case 'app.bsky.richtext.facet#link':
          segments.push({
            type: 'link',
            text: facetText,
            uri: feature.uri,
          });
          break;
        case 'app.bsky.richtext.facet#tag':
          segments.push({
            type: 'tag',
            text: facetText,
            tag: feature.tag,
          });
          break;
      }
    }

    currentByteIndex = facet.index.byteEnd;
  }

  // Add remaining text after last facet
  const finalStartIndex = byteToStringIndex(text, currentByteIndex);
  if (finalStartIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(finalStartIndex) });
  }

  return segments;
}

// =============================================================================
// SEGMENT RENDERERS
// =============================================================================

/**
 * Renders a mention segment as a link to the author's profile.
 */
function MentionSegment({ text, did }: { text: string; did: string }) {
  return (
    <Link
      href={`/authors/${encodeURIComponent(did)}`}
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {text}
    </Link>
  );
}

/**
 * Renders a link segment.
 *
 * @remarks
 * Detects Wikidata links and renders them as FOVEA-style reference chips.
 */
function LinkSegment({ text, uri }: { text: string; uri: string }) {
  // Check if this is a Wikidata link
  const wikidataMatch = uri.match(/wikidata\.org\/wiki\/(Q\d+)/);
  if (wikidataMatch) {
    const _qid = wikidataMatch[1];
    return (
      <a
        href={uri}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1"
      >
        <Badge
          variant="secondary"
          className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
        >
          <span className="font-medium">{text}</span>
          <ExternalLink className="h-3 w-3" />
        </Badge>
      </a>
    );
  }

  // Check if this is an internal Chive link
  if (uri.includes('chive.pub') || uri.startsWith('/')) {
    const internalPath = uri.replace(/^https?:\/\/[^/]+/, '');
    return (
      <Link href={internalPath} className="text-blue-600 hover:underline dark:text-blue-400">
        {text}
      </Link>
    );
  }

  // External link
  return (
    <a
      href={uri}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {text}
      <ExternalLink className="ml-0.5 inline h-3 w-3" />
    </a>
  );
}

/**
 * Renders a hashtag segment.
 */
function TagSegment({ text, tag }: { text: string; tag: string }) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(`#${tag}`)}`}
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {text}
    </Link>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Renders ATProto rich text with facets.
 *
 * @param props - Component props
 * @returns Rendered rich text
 */
export function RichTextRenderer({ text, facets, className }: RichTextRendererProps) {
  const segments = parseTextWithFacets(text, facets);

  return (
    <div className={cn('whitespace-pre-wrap', className)} data-testid="annotation-body">
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'mention':
            return <MentionSegment key={index} text={segment.text} did={segment.did!} />;
          case 'link':
            return <LinkSegment key={index} text={segment.text} uri={segment.uri!} />;
          case 'tag':
            return <TagSegment key={index} text={segment.text} tag={segment.tag!} />;
          default:
            return <span key={index}>{segment.text}</span>;
        }
      })}
    </div>
  );
}
