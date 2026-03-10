'use client';

/**
 * Rich text renderer for Chive.
 *
 * @remarks
 * Renders rich text content with support for:
 * - FOVEA-style entity references (nodeRef, wikidataRef, fieldRef, etc.)
 * - ATProto-style facets (mentions, links, hashtags)
 * - Markdown formatting (bold, italic, strikethrough, code)
 * - LaTeX math expressions (inline and display)
 * - Block content (headings, list items, blockquotes, code blocks)
 *
 * This component provides consistent rendering for titles, abstracts,
 * and reviews.
 *
 * @example
 * ```tsx
 * <RichTextRenderer
 *   items={content.items}
 *   mode="inline"
 * />
 * ```
 *
 * @packageDocumentation
 */

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import katex from 'katex';
import { toHtml } from 'hast-util-to-html';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { escapeHTML } from '@/lib/utils/annotation-serializer';
import { lowlight } from '@/lib/utils/syntax-highlight';
import { getSubkindColorClasses, getSubkindIcon } from '@/lib/constants/subkind-colors';
import type {
  RichTextItem,
  TextItem,
  MentionItem,
  LinkItem,
  TagItem,
  NodeRefItem,
  WikidataRefItem,
  FieldRefItem,
  FacetRefItem,
  EprintRefItem,
  AnnotationRefItem,
  AuthorRefItem,
  LatexItem,
  CodeBlockItem,
  HeadingItem,
  ListItem,
  BlockquoteItem,
  RichTextFacet,
} from '@/lib/types/rich-text';
import { fromAtprotoRichText } from '@/lib/types/rich-text';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the RichTextRenderer component.
 *
 * @remarks
 * Supports two input formats:
 * 1. Item-based: Pass `items` array of rich text items
 * 2. ATProto facets: Pass `text` and optional `facets`
 */
export interface RichTextRendererProps {
  /** Rich text items to render (item-based format) */
  items?: RichTextItem[];

  /** Plain text content (ATProto text+facets format) */
  text?: string;

  /** ATProto facets (used with text prop) */
  facets?: RichTextFacet[] | null;

  /** Render mode */
  mode?: 'inline' | 'block';

  /** Disable link rendering (use when inside another link to avoid nested anchors) */
  disableLinks?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for the container */
  testId?: string;
}

// =============================================================================
// LATEX RENDERING
// =============================================================================

/**
 * Renders LaTeX to HTML using KaTeX.
 *
 * @param latex - LaTeX source
 * @param displayMode - True for display mode (centered block)
 * @returns Rendered HTML string
 */
function renderLatex(latex: string, displayMode: boolean): string {
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

// =============================================================================
// REFERENCE CHIP COMPONENTS
// =============================================================================

/**
 * Renders a Wikidata entity reference as a chip.
 */
function WikidataRefChip({
  item,
  disableLinks = false,
}: {
  item: WikidataRefItem;
  disableLinks?: boolean;
}) {
  const href = `https://www.wikidata.org/wiki/${item.qid}`;

  const badge = (
    <Badge
      variant="secondary"
      className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
    >
      <span className="font-medium">{item.label}</span>
      {!disableLinks && <ExternalLink className="h-3 w-3" />}
    </Badge>
  );

  if (disableLinks) {
    return badge;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1"
    >
      {badge}
    </a>
  );
}

/**
 * Renders a knowledge graph node reference as a chip with subkind-specific colors.
 */
function NodeRefChip({
  item,
  disableLinks = false,
}: {
  item: NodeRefItem;
  disableLinks?: boolean;
}) {
  const nodeId = item.uri.split('/').pop() ?? item.uri;
  const colorClasses = getSubkindColorClasses(item.subkind ?? 'default');
  const Icon = getSubkindIcon(item.subkind ?? 'default');

  const badge = (
    <Badge variant="secondary" className={cn('gap-1', colorClasses)} title={item.subkind}>
      <Icon className="h-3 w-3" />
      <span>{item.label ?? item.uri}</span>
    </Badge>
  );

  if (disableLinks) {
    return badge;
  }

  return <Link href={`/graph/${encodeURIComponent(nodeId)}`}>{badge}</Link>;
}

/**
 * Renders a field reference as a chip.
 */
function FieldRefChip({
  item,
  disableLinks = false,
}: {
  item: FieldRefItem;
  disableLinks?: boolean;
}) {
  const fieldId = item.uri.split('/').pop() ?? item.uri;
  const colorClasses = getSubkindColorClasses('field');
  const Icon = getSubkindIcon('field');

  const badge = (
    <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
      <Icon className="h-3 w-3" />
      <span>{item.label ?? item.uri}</span>
    </Badge>
  );

  if (disableLinks) {
    return badge;
  }

  return <Link href={`/fields/${encodeURIComponent(fieldId)}`}>{badge}</Link>;
}

/**
 * Renders a facet reference as a chip.
 */
function FacetRefChip({
  item,
  disableLinks = false,
}: {
  item: FacetRefItem;
  disableLinks?: boolean;
}) {
  const colorClasses = getSubkindColorClasses('facet');
  const Icon = getSubkindIcon('facet');

  const badge = (
    <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
      <Icon className="h-3 w-3" />
      <span>{item.label ?? item.uri}</span>
    </Badge>
  );

  if (disableLinks) {
    return badge;
  }

  const encodedUri = encodeURIComponent(item.uri);
  return <Link href={`/browse?facet=${encodedUri}`}>{badge}</Link>;
}

/**
 * Renders an eprint reference as a chip.
 */
function EprintRefChip({
  item,
  disableLinks = false,
}: {
  item: EprintRefItem;
  disableLinks?: boolean;
}) {
  const encodedUri = encodeURIComponent(item.uri.replace('at://', ''));
  const displayLabel = item.label ?? item.uri;

  const badge = (
    <Badge
      variant="secondary"
      className="max-w-[200px] truncate bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
      title={displayLabel}
    >
      {displayLabel}
    </Badge>
  );

  if (disableLinks) {
    return badge;
  }

  return <Link href={`/eprints/${encodedUri}`}>{badge}</Link>;
}

/**
 * Renders an annotation reference as a chip.
 */
function AnnotationRefChip({
  item,
  disableLinks: _disableLinks = false,
}: {
  item: AnnotationRefItem;
  disableLinks?: boolean;
}) {
  const displayLabel = item.label ?? '...';
  // AnnotationRefChip doesn't currently render as a link, but accept the prop for consistency
  return (
    <Badge variant="outline" className="max-w-[150px] cursor-pointer truncate" title={displayLabel}>
      ^ {displayLabel}
    </Badge>
  );
}

/**
 * Renders an author reference as a chip.
 */
function AuthorRefChip({
  item,
  disableLinks = false,
}: {
  item: AuthorRefItem;
  disableLinks?: boolean;
}) {
  const colorClasses = getSubkindColorClasses('person');
  const Icon = getSubkindIcon('person');

  const badge = (
    <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
      <Icon className="h-3 w-3" />
      <span>@{item.label ?? item.did.slice(0, 12)}</span>
    </Badge>
  );

  if (disableLinks) {
    return badge;
  }

  return <Link href={`/authors/${encodeURIComponent(item.did)}`}>{badge}</Link>;
}

/**
 * Renders a mention as a link.
 */
function MentionRenderer({
  item,
  disableLinks = false,
}: {
  item: MentionItem;
  disableLinks?: boolean;
}) {
  const content = <>@{item.handle ?? item.did.slice(0, 12)}</>;

  if (disableLinks) {
    return <span className="text-blue-600 dark:text-blue-400">{content}</span>;
  }

  return (
    <Link
      href={`/authors/${encodeURIComponent(item.did)}`}
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {content}
    </Link>
  );
}

/**
 * Normalizes a URL to ensure it has a protocol.
 * Handles protocol-relative URLs (//www...) and URLs without any protocol.
 */
function normalizeUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  // URL without protocol (e.g., "www.wikidata.org/...")
  if (url.includes('.') && !url.startsWith('/')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Renders a link.
 */
function LinkRenderer({ item, disableLinks = false }: { item: LinkItem; disableLinks?: boolean }) {
  // When links are disabled, render as plain text
  if (disableLinks) {
    return <span className="text-blue-600 dark:text-blue-400">{item.label ?? item.url}</span>;
  }

  // Normalize URL to ensure it has https:// protocol for external links
  const normalizedUrl = normalizeUrl(item.url);

  // Check if this is a Wikidata link
  const wikidataMatch = normalizedUrl.match(/wikidata\.org\/wiki\/(Q\d+)/);
  if (wikidataMatch) {
    return (
      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1"
      >
        <Badge
          variant="secondary"
          className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
        >
          <span className="font-medium">{item.label ?? item.url}</span>
          <ExternalLink className="h-3 w-3" />
        </Badge>
      </a>
    );
  }

  // Check if this is an internal link
  if (normalizedUrl.includes('chive.pub') || normalizedUrl.startsWith('/')) {
    const internalPath = normalizedUrl.replace(/^https?:\/\/[^/]+/, '');
    return (
      <Link href={internalPath} className="text-blue-600 hover:underline dark:text-blue-400">
        {item.label ?? item.url}
      </Link>
    );
  }

  // External link
  return (
    <a
      href={normalizedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {item.label ?? item.url}
      <ExternalLink className="ml-0.5 inline h-3 w-3" />
    </a>
  );
}

/**
 * Renders a hashtag.
 */
function TagRenderer({ item, disableLinks = false }: { item: TagItem; disableLinks?: boolean }) {
  if (disableLinks) {
    return <span className="text-blue-600 dark:text-blue-400">#{item.tag}</span>;
  }

  return (
    <Link
      href={`/search?q=${encodeURIComponent(`#${item.tag}`)}`}
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      #{item.tag}
    </Link>
  );
}

/**
 * Renders a text item with optional formatting.
 */
function TextRenderer({ item }: { item: TextItem }) {
  return <span>{item.content}</span>;
}

/**
 * Renders a LaTeX item.
 */
function LatexRenderer({ item }: { item: LatexItem }) {
  const displayMode = item.displayMode ?? false;
  return (
    <span
      className={displayMode ? 'block my-2 text-center' : 'inline'}
      dangerouslySetInnerHTML={{
        __html: renderLatex(item.content, displayMode),
      }}
    />
  );
}

/**
 * Renders a code block item with optional syntax highlighting.
 */
function CodeBlockRenderer({ item }: { item: CodeBlockItem }) {
  const tree = item.language
    ? lowlight.highlight(item.language, item.content)
    : lowlight.highlightAuto(item.content);
  const html = toHtml(tree);
  return (
    <pre className="hljs rounded p-3 overflow-x-auto my-2">
      <code className="font-mono text-sm" dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}

/**
 * Renders a heading item.
 */
function HeadingRenderer({ item }: { item: HeadingItem }) {
  const level = Math.min(Math.max(item.level, 1), 6);
  switch (level) {
    case 1:
      return <h1 className="font-bold my-2">{item.content}</h1>;
    case 2:
      return <h2 className="font-bold my-2">{item.content}</h2>;
    case 3:
      return <h3 className="font-bold my-2">{item.content}</h3>;
    case 4:
      return <h4 className="font-bold my-2">{item.content}</h4>;
    case 5:
      return <h5 className="font-bold my-2">{item.content}</h5>;
    case 6:
      return <h6 className="font-bold my-2">{item.content}</h6>;
    default:
      return <h3 className="font-bold my-2">{item.content}</h3>;
  }
}

/**
 * Renders a list item.
 */
function ListItemRenderer({ item }: { item: ListItem }) {
  const prefix =
    item.listType === 'ordered' ? `${item.ordinal ?? 1}. ` : '\u2022 '; /* bullet char */
  return (
    <div className="my-0.5" style={{ paddingLeft: `${(item.depth ?? 0) * 1.5}rem` }}>
      <span>
        {prefix}
        {item.content}
      </span>
    </div>
  );
}

/**
 * Renders a blockquote item.
 */
function BlockquoteRenderer({ item }: { item: BlockquoteItem }) {
  return (
    <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-2">
      {item.content}
    </blockquote>
  );
}

// =============================================================================
// ITEM RENDERER
// =============================================================================

/**
 * Renders a single rich text item.
 */
function ItemRenderer({
  item,
  index,
  disableLinks = false,
}: {
  item: RichTextItem;
  index: number;
  disableLinks?: boolean;
}) {
  switch (item.type) {
    case 'text':
      return <TextRenderer key={index} item={item} />;
    case 'mention':
      return <MentionRenderer key={index} item={item} disableLinks={disableLinks} />;
    case 'link':
      return <LinkRenderer key={index} item={item} disableLinks={disableLinks} />;
    case 'tag':
      return <TagRenderer key={index} item={item} disableLinks={disableLinks} />;
    case 'nodeRef':
      return <NodeRefChip key={index} item={item} disableLinks={disableLinks} />;
    case 'wikidataRef':
      return <WikidataRefChip key={index} item={item} disableLinks={disableLinks} />;
    case 'fieldRef':
      return <FieldRefChip key={index} item={item} disableLinks={disableLinks} />;
    case 'facetRef':
      return <FacetRefChip key={index} item={item} disableLinks={disableLinks} />;
    case 'eprintRef':
      return <EprintRefChip key={index} item={item} disableLinks={disableLinks} />;
    case 'annotationRef':
      return <AnnotationRefChip key={index} item={item} disableLinks={disableLinks} />;
    case 'authorRef':
      return <AuthorRefChip key={index} item={item} disableLinks={disableLinks} />;
    case 'latex':
      return <LatexRenderer key={index} item={item} />;
    case 'codeBlock':
      return <CodeBlockRenderer key={index} item={item} />;
    case 'heading':
      return <HeadingRenderer key={index} item={item} />;
    case 'listItem':
      return <ListItemRenderer key={index} item={item} />;
    case 'blockquote':
      return <BlockquoteRenderer key={index} item={item} />;
    default:
      return null;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Renders rich text content.
 *
 * @param props - Component props
 * @returns Rendered rich text
 */
export function RichTextRenderer({
  items,
  text,
  facets,
  mode = 'inline',
  disableLinks = false,
  className,
  testId = 'rich-text',
}: RichTextRendererProps) {
  // Determine which input format to use
  let richTextItems: RichTextItem[];

  if (items && items.length > 0) {
    richTextItems = items;
  } else if (text !== undefined) {
    // Convert ATProto text+facets to rich text items
    richTextItems = fromAtprotoRichText(text, facets);
  } else {
    return null;
  }

  if (richTextItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'leading-relaxed [&>*]:inline [&_.badge]:mx-0.5 [&_.badge]:align-baseline',
        mode === 'block' && 'whitespace-pre-wrap',
        className
      )}
      data-testid={testId}
    >
      {richTextItems.map((item, index) => (
        <ItemRenderer key={index} item={item} index={index} disableLinks={disableLinks} />
      ))}
    </div>
  );
}

export default RichTextRenderer;
