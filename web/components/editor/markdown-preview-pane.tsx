'use client';

/**
 * Markdown preview pane for the MarkdownEditor.
 *
 * @remarks
 * Renders markdown text as formatted React elements using react-markdown
 * with GitHub Flavored Markdown, syntax highlighting, and LaTeX support.
 * Chive-specific mention/tag chip rendering is handled via custom link
 * components in the shared MarkdownRenderer.
 *
 * @packageDocumentation
 */

import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for MarkdownPreviewPane component.
 */
export interface MarkdownPreviewPaneProps {
  /** Markdown content to render */
  content: string;
  /** Additional CSS classes */
  className?: string;
  /** Minimum height */
  minHeight?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Preview pane that renders markdown as formatted elements.
 */
export function MarkdownPreviewPane({
  content,
  className,
  minHeight = '150px',
}: MarkdownPreviewPaneProps) {
  if (!content) {
    return (
      <div className={cn('text-muted-foreground italic', className)} style={{ minHeight }}>
        No content to preview
      </div>
    );
  }

  return <MarkdownRenderer content={content} className={className} minHeight={minHeight} />;
}

export default MarkdownPreviewPane;
