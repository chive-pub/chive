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

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
  CodeItem,
  LegacyAnnotationItem,
  AtprotoFacet,
} from '@/lib/types/rich-text';
import { fromLegacyAnnotationItems, fromAtprotoRichText } from '@/lib/types/rich-text';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the RichTextRenderer component.
 *
 * @remarks
 * Supports three input formats:
 * 1. Item-based: Pass `items` array of rich text or legacy items
 * 2. ATProto facets: Pass `text` and optional `facets`
 * 3. Both: Items take precedence if provided
 */
export interface RichTextRendererProps {
  /** Rich text items to render (item-based format) */
  items?: RichTextItem[] | LegacyAnnotationItem[];

  /** Plain text content (ATProto text+facets format) */
  text?: string;

  /** ATProto facets (used with text prop) */
  facets?: AtprotoFacet[] | null;

  /** Render mode */
  mode?: 'inline' | 'block';

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
    return `<span class="text-destructive">[LaTeX error: ${latex}]</span>`;
  }
}

// =============================================================================
// REFERENCE CHIP COMPONENTS
// =============================================================================

/**
 * Renders a Wikidata entity reference as a chip.
 */
function WikidataRefChip({ item }: { item: WikidataRefItem }) {
  const href = item.url ?? `https://www.wikidata.org/wiki/${item.qid}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1"
    >
      <Badge
        variant="secondary"
        className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
      >
        <span className="font-medium">{item.label}</span>
        <ExternalLink className="h-3 w-3" />
      </Badge>
    </a>
  );
}

/**
 * Renders a knowledge graph node reference as a chip with subkind-specific colors.
 */
function NodeRefChip({ item }: { item: NodeRefItem }) {
  const nodeId = item.uri.split('/').pop() ?? item.uri;
  const colorClasses = getSubkindColorClasses(item.subkind ?? 'default');
  const Icon = getSubkindIcon(item.subkind ?? 'default');

  return (
    <Link href={`/graph/${encodeURIComponent(nodeId)}`}>
      <Badge variant="secondary" className={cn('gap-1', colorClasses)} title={item.subkind}>
        <Icon className="h-3 w-3" />
        <span>{item.label}</span>
      </Badge>
    </Link>
  );
}

/**
 * Renders a field reference as a chip.
 */
function FieldRefChip({ item }: { item: FieldRefItem }) {
  const fieldId = item.uri.split('/').pop() ?? item.uri;
  const colorClasses = getSubkindColorClasses('field');
  const Icon = getSubkindIcon('field');

  return (
    <Link href={`/fields/${encodeURIComponent(fieldId)}`}>
      <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
        <Icon className="h-3 w-3" />
        <span>{item.label}</span>
      </Badge>
    </Link>
  );
}

/**
 * Renders a facet reference as a chip.
 */
function FacetRefChip({ item }: { item: FacetRefItem }) {
  const colorClasses = getSubkindColorClasses('facet');
  const Icon = getSubkindIcon('facet');

  return (
    <Link href={`/browse?${item.dimension}=${encodeURIComponent(item.value)}`}>
      <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
        <Icon className="h-3 w-3" />
        <span>
          {item.dimension}: {item.value}
        </span>
      </Badge>
    </Link>
  );
}

/**
 * Renders an eprint reference as a chip.
 */
function EprintRefChip({ item }: { item: EprintRefItem }) {
  const encodedUri = encodeURIComponent(item.uri.replace('at://', ''));

  return (
    <Link href={`/eprints/${encodedUri}`}>
      <Badge
        variant="secondary"
        className="max-w-[200px] truncate bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
        title={item.title}
      >
        {item.title}
      </Badge>
    </Link>
  );
}

/**
 * Renders an annotation reference as a chip.
 */
function AnnotationRefChip({ item }: { item: AnnotationRefItem }) {
  return (
    <Badge variant="outline" className="max-w-[150px] cursor-pointer truncate" title={item.excerpt}>
      ^ {item.excerpt}
    </Badge>
  );
}

/**
 * Renders an author reference as a chip.
 */
function AuthorRefChip({ item }: { item: AuthorRefItem }) {
  const colorClasses = getSubkindColorClasses('person');
  const Icon = getSubkindIcon('person');

  return (
    <Link href={`/authors/${encodeURIComponent(item.did)}`}>
      <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
        <Icon className="h-3 w-3" />
        <span>@{item.displayName ?? item.handle ?? item.did.slice(0, 12)}</span>
      </Badge>
    </Link>
  );
}

/**
 * Renders a mention as a link.
 */
function MentionRenderer({ item }: { item: MentionItem }) {
  return (
    <Link
      href={`/authors/${encodeURIComponent(item.did)}`}
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      @{item.handle ?? item.displayName ?? item.did.slice(0, 12)}
    </Link>
  );
}

/**
 * Renders a link.
 */
function LinkRenderer({ item }: { item: LinkItem }) {
  // Check if this is a Wikidata link
  const wikidataMatch = item.url.match(/wikidata\.org\/wiki\/(Q\d+)/);
  if (wikidataMatch) {
    return (
      <a
        href={item.url}
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
  if (item.url.includes('chive.pub') || item.url.startsWith('/')) {
    const internalPath = item.url.replace(/^https?:\/\/[^/]+/, '');
    return (
      <Link href={internalPath} className="text-blue-600 hover:underline dark:text-blue-400">
        {item.label ?? item.url}
      </Link>
    );
  }

  // External link
  return (
    <a
      href={item.url}
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
function TagRenderer({ item }: { item: TagItem }) {
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
  let content: React.ReactNode = item.content;

  if (item.format) {
    if (item.format.bold) {
      content = <strong>{content}</strong>;
    }
    if (item.format.italic) {
      content = <em>{content}</em>;
    }
    if (item.format.strikethrough) {
      content = <s>{content}</s>;
    }
    if (item.format.code) {
      content = <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">{content}</code>;
    }
  }

  return <span>{content}</span>;
}

/**
 * Renders a LaTeX item.
 */
function LatexRenderer({ item }: { item: LatexItem }) {
  return (
    <span
      className={item.displayMode ? 'block my-2 text-center' : 'inline'}
      dangerouslySetInnerHTML={{
        __html: renderLatex(item.content, item.displayMode),
      }}
    />
  );
}

/**
 * Renders a code item.
 */
function CodeRenderer({ item }: { item: CodeItem }) {
  if (item.block) {
    return (
      <pre className="rounded bg-muted p-3 overflow-x-auto my-2">
        <code className="font-mono text-sm">{item.content}</code>
      </pre>
    );
  }

  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">{item.content}</code>;
}

// =============================================================================
// ITEM RENDERER
// =============================================================================

/**
 * Renders a single rich text item.
 */
function ItemRenderer({ item, index }: { item: RichTextItem; index: number }) {
  switch (item.type) {
    case 'text':
      return <TextRenderer key={index} item={item} />;
    case 'mention':
      return <MentionRenderer key={index} item={item} />;
    case 'link':
      return <LinkRenderer key={index} item={item} />;
    case 'tag':
      return <TagRenderer key={index} item={item} />;
    case 'nodeRef':
      return <NodeRefChip key={index} item={item} />;
    case 'wikidataRef':
      return <WikidataRefChip key={index} item={item} />;
    case 'fieldRef':
      return <FieldRefChip key={index} item={item} />;
    case 'facetRef':
      return <FacetRefChip key={index} item={item} />;
    case 'eprintRef':
      return <EprintRefChip key={index} item={item} />;
    case 'annotationRef':
      return <AnnotationRefChip key={index} item={item} />;
    case 'authorRef':
      return <AuthorRefChip key={index} item={item} />;
    case 'latex':
      return <LatexRenderer key={index} item={item} />;
    case 'code':
      return <CodeRenderer key={index} item={item} />;
    default:
      return null;
  }
}

// =============================================================================
// TYPE DETECTION
// =============================================================================

/**
 * Checks if an item is in legacy annotation format.
 */
function isLegacyItem(item: RichTextItem | LegacyAnnotationItem): item is LegacyAnnotationItem {
  // Legacy items may have undefined type or use optional typing
  if (!item.type) return true;
  // Check for legacy-specific properties
  if ('content' in item && item.type === 'text') {
    // Could be either, but RichTextItem TextItem always has content as required
    return false;
  }
  // Legacy items have optional properties that RichTextItem types have as required
  if (item.type === 'nodeRef' && (!('uri' in item) || !('label' in item))) {
    return true;
  }
  return false;
}

/**
 * Checks if the items array contains legacy items.
 */
function containsLegacyItems(items: (RichTextItem | LegacyAnnotationItem)[]): boolean {
  if (items.length === 0) return false;
  // Check the first few items for legacy format
  return items.slice(0, 3).some(isLegacyItem);
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
  className,
  testId = 'rich-text',
}: RichTextRendererProps) {
  // Determine which input format to use
  let richTextItems: RichTextItem[];

  if (items && items.length > 0) {
    // Use items if provided
    richTextItems = containsLegacyItems(items)
      ? fromLegacyAnnotationItems(items as LegacyAnnotationItem[])
      : (items as RichTextItem[]);
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
        <ItemRenderer key={index} item={item} index={index} />
      ))}
    </div>
  );
}

export default RichTextRenderer;
