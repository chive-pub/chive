'use client';

/**
 * Markdown preview pane for the MarkdownEditor.
 *
 * @remarks
 * Renders markdown text as formatted HTML with LaTeX support.
 * Uses the marked library for markdown parsing and KaTeX for math.
 *
 * @packageDocumentation
 */

import { useMemo } from 'react';
import katex from 'katex';

import { cn } from '@/lib/utils';
import { escapeHTML } from '@/lib/utils/annotation-serializer';

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
// CHIP COLORS
// =============================================================================

/**
 * Gets chip colors for a subkind.
 */
function getSubkindChipColors(subkind: string): string {
  const colorMap: Record<string, string> = {
    field: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    institution: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    person: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    facet: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    journal: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    conference: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    funder: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    license: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    methodology: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    'paper-type': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  return colorMap[subkind] ?? colorMap.default;
}

// =============================================================================
// LATEX PROCESSING
// =============================================================================

/**
 * Render LaTeX expression to HTML.
 */
function renderLatexToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
    });
  } catch {
    return `<span class="text-destructive">[LaTeX error: ${escapeHTML(latex)}]</span>`;
  }
}

/**
 * Process LaTeX expressions in markdown text.
 *
 * @remarks
 * Replaces $...$ and $$...$$ with rendered KaTeX HTML.
 */
function processLatex(text: string): string {
  // Process display math first ($$...$$)
  let result = text.replace(/\$\$([^$]+)\$\$/g, (_match, latex: string) => {
    return `<div class="my-2 text-center">${renderLatexToHtml(latex.trim(), true)}</div>`;
  });

  // Process inline math ($...$)
  result = result.replace(/\$([^$\n]+)\$/g, (_match, latex: string) => {
    return renderLatexToHtml(latex.trim(), false);
  });

  return result;
}

// =============================================================================
// MARKDOWN PARSING
// =============================================================================

/**
 * Parse markdown to HTML.
 *
 * @remarks
 * A simple markdown parser that handles common formatting.
 * For production use, consider using a full markdown library.
 */
function parseMarkdown(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Process LaTeX before other markdown (to avoid interference)
  html = processLatex(html);

  // Headers (must be at start of line)
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');

  // Bold and italic (order matters: process bold first)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-muted px-1 py-0.5 font-mono text-sm">$1</code>'
  );

  // Parse user mentions: [@label](user:id)
  html = html.replace(
    /\[@([^\]]+)\]\(user:[^)]+\)/g,
    '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-sm font-medium">@$1</span>'
  );

  // Parse node mentions: [@label](node:id#subkind)
  html = html.replace(
    /\[@([^\]]+)\]\(node:[^#)]+#([^)]+)\)/g,
    (_match, label: string, subkind: string) => {
      const colors = getSubkindChipColors(subkind);
      return `<span class="inline-flex items-center px-1.5 py-0.5 rounded ${colors} text-sm font-medium">@${label}</span>`;
    }
  );

  // Parse type node tags: [#label](type:id#subkind)
  html = html.replace(
    /\[#([^\]]+)\]\(type:[^#)]+#([^)]+)\)/g,
    (_match, label: string, subkind: string) => {
      const colors = getSubkindChipColors(subkind);
      return `<span class="inline-flex items-center px-1.5 py-0.5 rounded ${colors} text-sm font-medium">#${label}</span>`;
    }
  );

  // Links (that are not mentions/tags)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Parse plain tags: #word (only if not already in a chip)
  html = html.replace(
    /(?<!font-medium">)#(\w+)(?![^<]*<\/span>)/g,
    '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-sm">#$1</span>'
  );

  // Blockquotes
  html = html.replace(
    /^&gt; (.+)$/gm,
    '<blockquote class="border-l-4 border-muted-foreground/30 pl-4 italic my-2">$1</blockquote>'
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc my-2">$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p class="my-2">');

  // Single newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph
  html = `<p class="my-2">${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p class="my-2"><\/p>/g, '');

  return html;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Preview pane that renders markdown as formatted HTML.
 */
export function MarkdownPreviewPane({
  content,
  className,
  minHeight = '150px',
}: MarkdownPreviewPaneProps) {
  const html = useMemo(() => {
    if (!content) return '';
    return parseMarkdown(content);
  }, [content]);

  if (!content) {
    return (
      <div className={cn('text-muted-foreground italic', className)} style={{ minHeight }}>
        No content to preview
      </div>
    );
  }

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2',
        'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
        'prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5',
        className
      )}
      style={{ minHeight }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default MarkdownPreviewPane;
