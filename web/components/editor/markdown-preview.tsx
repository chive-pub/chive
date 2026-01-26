'use client';

/**
 * Markdown preview component with LaTeX support.
 *
 * @remarks
 * Renders rich text content with facets as formatted HTML.
 * Supports Chive's custom facets (bold, italic, code, LaTeX, etc.)
 * as well as standard ATProto facets (mentions, links, tags).
 *
 * @example
 * ```tsx
 * <MarkdownPreview content={richTextContent} />
 * ```
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';
import Link from 'next/link';
import katex from 'katex';

import { cn } from '@/lib/utils';
import type { RichTextContent, RichTextFacet, RichTextFeature } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for MarkdownPreview component.
 */
export interface MarkdownPreviewProps {
  /** Rich text content to render */
  content: RichTextContent;
  /** Additional CSS classes */
  className?: string;
  /** Minimum height */
  minHeight?: string;
}

/**
 * Segment of text with optional formatting.
 */
interface TextSegment {
  text: string;
  features: RichTextFeature[];
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Convert byte index to string index.
 *
 * @remarks
 * ATProto facets use byte indices (UTF-8), but JavaScript strings use
 * UTF-16 code units. This function converts byte indices to string indices.
 */
function byteToStringIndex(text: string, byteIndex: number): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  if (byteIndex >= bytes.length) {
    return text.length;
  }

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
 * Parse text and facets into renderable segments.
 */
function parseTextWithFacets(text: string, facets?: RichTextFacet[]): TextSegment[] {
  if (!facets || facets.length === 0) {
    return [{ text, features: [] }];
  }

  // Sort facets by start position
  const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

  const segments: TextSegment[] = [];
  let currentByteIndex = 0;

  for (const facet of sortedFacets) {
    const startStringIndex = byteToStringIndex(text, currentByteIndex);
    const facetStartStringIndex = byteToStringIndex(text, facet.index.byteStart);
    const facetEndStringIndex = byteToStringIndex(text, facet.index.byteEnd);

    // Add plain text before this facet
    if (facetStartStringIndex > startStringIndex) {
      const plainText = text.slice(startStringIndex, facetStartStringIndex);
      if (plainText) {
        segments.push({ text: plainText, features: [] });
      }
    }

    // Add the faceted segment
    const facetText = text.slice(facetStartStringIndex, facetEndStringIndex);
    if (facetText) {
      segments.push({ text: facetText, features: facet.features });
    }

    currentByteIndex = facet.index.byteEnd;
  }

  // Add remaining text after last facet
  const finalStartIndex = byteToStringIndex(text, currentByteIndex);
  if (finalStartIndex < text.length) {
    segments.push({ text: text.slice(finalStartIndex), features: [] });
  }

  return segments;
}

/**
 * Render LaTeX to HTML.
 */
function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
    });
  } catch {
    return `<span class="text-destructive">[LaTeX error: ${latex}]</span>`;
  }
}

// =============================================================================
// SEGMENT RENDERER
// =============================================================================

/**
 * Render a single text segment with its features.
 */
function SegmentRenderer({ segment, index }: { segment: TextSegment; index: number }) {
  const { text, features } = segment;

  // No features - plain text
  if (features.length === 0) {
    return <span key={index}>{text}</span>;
  }

  // Process features
  let content: React.ReactNode = text;

  for (const feature of features) {
    switch (feature.$type) {
      case 'pub.chive.richtext.facets#bold':
        content = <strong key={`${index}-bold`}>{content}</strong>;
        break;

      case 'pub.chive.richtext.facets#italic':
        content = <em key={`${index}-italic`}>{content}</em>;
        break;

      case 'pub.chive.richtext.facets#strikethrough':
        content = <s key={`${index}-strike`}>{content}</s>;
        break;

      case 'pub.chive.richtext.facets#code':
        content = (
          <code key={`${index}-code`} className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
            {content}
          </code>
        );
        break;

      case 'pub.chive.richtext.facets#latex':
        content = (
          <span
            key={`${index}-latex`}
            className={feature.displayMode ? 'block my-2 text-center' : 'inline'}
            dangerouslySetInnerHTML={{
              __html: renderLatex(text, feature.displayMode),
            }}
          />
        );
        break;

      case 'pub.chive.richtext.facets#heading':
        // Render heading based on level
        switch (feature.level) {
          case 1:
            content = (
              <h1 key={`${index}-heading`} className="text-2xl font-bold">
                {content}
              </h1>
            );
            break;
          case 2:
            content = (
              <h2 key={`${index}-heading`} className="text-xl font-bold">
                {content}
              </h2>
            );
            break;
          case 3:
            content = (
              <h3 key={`${index}-heading`} className="text-lg font-bold">
                {content}
              </h3>
            );
            break;
          case 4:
            content = (
              <h4 key={`${index}-heading`} className="text-base font-bold">
                {content}
              </h4>
            );
            break;
          case 5:
            content = (
              <h5 key={`${index}-heading`} className="text-sm font-bold">
                {content}
              </h5>
            );
            break;
          case 6:
            content = (
              <h6 key={`${index}-heading`} className="text-xs font-bold">
                {content}
              </h6>
            );
            break;
          default:
            content = (
              <strong key={`${index}-heading`} className="font-bold">
                {content}
              </strong>
            );
        }
        break;

      case 'pub.chive.richtext.facets#blockquote':
        content = (
          <blockquote
            key={`${index}-quote`}
            className="border-l-4 border-muted-foreground/30 pl-4 italic"
          >
            {content}
          </blockquote>
        );
        break;

      case 'pub.chive.richtext.facets#codeBlock':
        content = (
          <pre key={`${index}-codeblock`} className="rounded bg-muted p-3 overflow-x-auto">
            <code className="font-mono text-sm">{content}</code>
          </pre>
        );
        break;

      case 'app.bsky.richtext.facet#link':
        const isExternal = feature.uri.startsWith('http');
        if (isExternal) {
          content = (
            <a
              key={`${index}-link`}
              href={feature.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              {content}
            </a>
          );
        } else {
          content = (
            <Link
              key={`${index}-link`}
              href={feature.uri}
              className="text-primary underline hover:text-primary/80"
            >
              {content}
            </Link>
          );
        }
        break;

      case 'app.bsky.richtext.facet#mention':
        content = (
          <Link
            key={`${index}-mention`}
            href={`/authors/${encodeURIComponent(feature.did)}`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            {content}
          </Link>
        );
        break;

      case 'app.bsky.richtext.facet#tag':
        content = (
          <Link
            key={`${index}-tag`}
            href={`/search?q=${encodeURIComponent(`#${feature.tag}`)}`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            {content}
          </Link>
        );
        break;
    }
  }

  return <span key={index}>{content}</span>;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Preview component for rich text content with facets.
 */
export function MarkdownPreview({ content, className, minHeight = '150px' }: MarkdownPreviewProps) {
  // If we have HTML, render it directly (faster path)
  const useHtml = content.html && (!content.facets || content.facets.length === 0);

  // Parse text with facets into segments
  const segments = useMemo(() => {
    if (useHtml) return [];
    return parseTextWithFacets(content.text, content.facets);
  }, [content.text, content.facets, useHtml]);

  if (!content.text) {
    return (
      <div className={cn('text-muted-foreground italic', className)} style={{ minHeight }}>
        No content to preview
      </div>
    );
  }

  // Use HTML if available and no facets
  if (useHtml) {
    return (
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2',
          'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
          'prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5',
          'prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded',
          className
        )}
        style={{ minHeight }}
        dangerouslySetInnerHTML={{ __html: content.html! }}
      />
    );
  }

  // Render with facets
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap', className)}
      style={{ minHeight }}
    >
      {segments.map((segment, index) => (
        <SegmentRenderer key={index} segment={segment} index={index} />
      ))}
    </div>
  );
}

export default MarkdownPreview;
