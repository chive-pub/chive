'use client';

/**
 * Standard markdown renderer using react-markdown.
 *
 * @remarks
 * Renders markdown to React elements with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Syntax-highlighted code blocks via highlight.js/lowlight
 * - LaTeX math expressions via remark-math + rehype-katex
 * - Chive-specific mention/tag chip rendering for encoded links
 *
 * This is the single standard markdown rendering path. All custom
 * rendering for Chive references (mentions, tags, knowledge graph nodes)
 * is handled via custom component overrides, not by replacing the parser.
 *
 * @packageDocumentation
 */

import { useMemo, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import type { Root, Element, Text, ElementContent, RootContent } from 'hast';

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface MarkdownRendererProps {
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
// URI SCHEME PARSERS
// =============================================================================

/** Parse a `user:did` URI */
function parseUserUri(href: string): { did: string } | null {
  if (!href.startsWith('user:')) return null;
  return { did: href.slice(5) };
}

/** Parse a `node:id#subkind` URI */
function parseNodeUri(href: string): { id: string; subkind: string } | null {
  if (!href.startsWith('node:')) return null;
  const rest = href.slice(5);
  const hashIdx = rest.indexOf('#');
  if (hashIdx === -1) return { id: rest, subkind: 'default' };
  return { id: rest.slice(0, hashIdx), subkind: rest.slice(hashIdx + 1) };
}

/** Parse a `type:id#subkind` URI */
function parseTypeUri(href: string): { id: string; subkind: string } | null {
  if (!href.startsWith('type:')) return null;
  const rest = href.slice(5);
  const hashIdx = rest.indexOf('#');
  if (hashIdx === -1) return { id: rest, subkind: 'default' };
  return { id: rest.slice(0, hashIdx), subkind: rest.slice(hashIdx + 1) };
}

// =============================================================================
// CUSTOM COMPONENTS
// =============================================================================

/**
 * Custom link component that renders Chive-specific URI schemes as chips.
 */
function CustomLink({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
  if (!href) {
    return <a {...props}>{children}</a>;
  }

  // User mention: [@label](user:did)
  const userParsed = parseUserUri(href);
  if (userParsed) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-sm font-medium">
        {children}
      </span>
    );
  }

  // Node mention: [@label](node:id#subkind)
  const nodeParsed = parseNodeUri(href);
  if (nodeParsed) {
    const colors = getSubkindChipColors(nodeParsed.subkind);
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded ${colors} text-sm font-medium`}
      >
        {children}
      </span>
    );
  }

  // Type tag: [#label](type:id#subkind)
  const typeParsed = parseTypeUri(href);
  if (typeParsed) {
    const colors = getSubkindChipColors(typeParsed.subkind);
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded ${colors} text-sm font-medium`}
      >
        {children}
      </span>
    );
  }

  // Standard link
  return (
    <a
      href={href}
      className="text-primary underline hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
}

// =============================================================================
// REHYPE PLUGINS
// =============================================================================

/** Environments that require display mode in KaTeX. */
const DISPLAY_ENV_REGEX = /\\begin\{(align|equation|gather|alignat|multline|CD|flalign|eqnarray)/;

/**
 * Rehype plugin: promote inline math to display math when content requires it.
 *
 * remark-math tags $...$ as math-inline. But KaTeX requires displayMode:true
 * for environments like align*, equation, gather, etc. This plugin detects
 * those environments and changes the class to math-display before rehype-katex
 * processes them.
 */
function rehypeDisplayMathFix() {
  return (tree: Root) => {
    fixDisplayMath(tree);
  };
}

function fixDisplayMath(node: Root | RootContent): void {
  if (node.type === 'element') {
    const classes = Array.isArray(node.properties?.className) ? node.properties.className : [];
    if (classes.includes('math-inline')) {
      const text = hastTextContent(node);
      if (DISPLAY_ENV_REGEX.test(text)) {
        node.properties.className = (classes as string[]).map((c) =>
          c === 'math-inline' ? 'math-display' : c
        );
      }
    }
  }
  if ('children' in node && node.children) {
    for (const child of node.children) {
      fixDisplayMath(child);
    }
  }
}

function hastTextContent(node: Element | ElementContent): string {
  if (node.type === 'text') return (node as Text).value || '';
  if ('children' in node) return (node.children as ElementContent[]).map(hastTextContent).join('');
  return '';
}

// =============================================================================
// PLUGIN CONFIGURATION
// =============================================================================

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeDisplayMathFix, rehypeKatex, rehypeHighlight];

const components = {
  a: CustomLink,
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Standard markdown renderer with syntax highlighting, LaTeX, and Chive chips.
 */
export function MarkdownRenderer({
  content,
  className,
  minHeight = '150px',
}: MarkdownRendererProps) {
  // Memoize for performance -- react-markdown re-parses on every render
  const memoizedContent = useMemo(() => content, [content]);

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
        className
      )}
      style={{ minHeight }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {memoizedContent}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
