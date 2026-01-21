'use client';

/**
 * AnnotationBodyRenderer component for displaying rich text annotation bodies.
 *
 * @remarks
 * Renders annotation body items (FOVEA GlossItem pattern) as a mix of
 * text and interactive reference chips. References link to their targets
 * (Wikidata, nodes, fields, eprints, etc.) with subkind-specific colors.
 *
 * @example
 * ```tsx
 * <AnnotationBodyRenderer body={annotation.body} />
 * ```
 *
 * @packageDocumentation
 */

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getSubkindColorClasses, getSubkindIcon } from '@/lib/constants/subkind-colors';
import type { RichAnnotationBody, RichAnnotationItem } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the AnnotationBodyRenderer component.
 */
export interface AnnotationBodyRendererProps {
  /** The annotation body to render */
  body: RichAnnotationBody;

  /** Additional CSS classes */
  className?: string;

  /** Render mode - inline for within text, block for standalone */
  mode?: 'inline' | 'block';
}

// =============================================================================
// REFERENCE CHIP COMPONENTS
// =============================================================================

/**
 * Renders a Wikidata entity reference as a chip.
 */
function WikidataRefChip({ qid, label, url }: { qid: string; label: string; url?: string }) {
  const href = url || `https://www.wikidata.org/wiki/${qid}`;

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
        <span className="font-medium">{label}</span>
        <ExternalLink className="h-3 w-3" />
      </Badge>
    </a>
  );
}

/**
 * Renders a knowledge graph node reference as a chip with subkind-specific colors.
 */
function NodeRefChip({ uri, label, subkind }: { uri: string; label: string; subkind?: string }) {
  // Extract node ID from AT-URI for routing
  const nodeId = uri.split('/').pop() || uri;
  const colorClasses = getSubkindColorClasses(subkind ?? 'default');
  const Icon = getSubkindIcon(subkind ?? 'default');

  return (
    <Link href={`/graph/${encodeURIComponent(nodeId)}`}>
      <Badge variant="secondary" className={cn('gap-1', colorClasses)} title={subkind}>
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </Badge>
    </Link>
  );
}

/**
 * Renders a field reference as a chip.
 */
function FieldRefChip({ uri, label }: { uri: string; label: string }) {
  // Extract field ID from AT-URI
  const fieldId = uri.split('/').pop() || uri;
  const colorClasses = getSubkindColorClasses('field');
  const Icon = getSubkindIcon('field');

  return (
    <Link href={`/fields/${encodeURIComponent(fieldId)}`}>
      <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </Badge>
    </Link>
  );
}

/**
 * Renders a facet reference as a chip.
 */
function FacetRefChip({ dimension, value }: { dimension: string; value: string }) {
  const colorClasses = getSubkindColorClasses('facet');
  const Icon = getSubkindIcon('facet');

  return (
    <Link href={`/browse?${dimension}=${encodeURIComponent(value)}`}>
      <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
        <Icon className="h-3 w-3" />
        <span>
          {dimension}: {value}
        </span>
      </Badge>
    </Link>
  );
}

/**
 * Renders an eprint reference as a chip.
 */
function EprintRefChip({ uri, title }: { uri: string; title: string }) {
  // Encode the AT-URI for use in the URL
  const encodedUri = encodeURIComponent(uri.replace('at://', ''));

  return (
    <Link href={`/eprints/${encodedUri}`}>
      <Badge
        variant="secondary"
        className="max-w-[200px] truncate bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
        title={title}
      >
        {title}
      </Badge>
    </Link>
  );
}

/**
 * Renders an annotation reference as a chip.
 */
function AnnotationRefChip({ uri: _uri, excerpt }: { uri: string; excerpt: string }) {
  return (
    <Badge variant="outline" className="max-w-[150px] cursor-pointer truncate" title={excerpt}>
      ^ {excerpt}
    </Badge>
  );
}

/**
 * Renders an author reference as a chip.
 */
function AuthorRefChip({ did, displayName }: { did: string; displayName: string }) {
  const colorClasses = getSubkindColorClasses('person');
  const Icon = getSubkindIcon('person');

  return (
    <Link href={`/authors/${encodeURIComponent(did)}`}>
      <Badge variant="secondary" className={cn('gap-1', colorClasses)}>
        <Icon className="h-3 w-3" />
        <span>@{displayName}</span>
      </Badge>
    </Link>
  );
}

// =============================================================================
// BODY ITEM RENDERER
// =============================================================================

/**
 * Renders a single annotation body item.
 */
function BodyItemRenderer({ item }: { item: RichAnnotationItem }) {
  switch (item.type) {
    case 'text':
      return <span>{item.content}</span>;

    case 'wikidataRef':
      return (
        <WikidataRefChip qid={item.qid ?? ''} label={item.label ?? 'Unknown'} url={item.url} />
      );

    case 'nodeRef':
      return (
        <NodeRefChip uri={item.uri ?? ''} label={item.label ?? 'Unknown'} subkind={item.subkind} />
      );

    case 'fieldRef':
      return <FieldRefChip uri={item.uri ?? ''} label={item.label ?? 'Unknown'} />;

    case 'facetRef':
      return <FacetRefChip dimension={item.dimension ?? 'unknown'} value={item.value ?? ''} />;

    case 'eprintRef':
      return <EprintRefChip uri={item.uri ?? ''} title={item.title ?? 'Untitled'} />;

    case 'annotationRef':
      return <AnnotationRefChip uri={item.uri ?? ''} excerpt={item.excerpt ?? '...'} />;

    case 'authorRef':
      return <AuthorRefChip did={item.did ?? ''} displayName={item.displayName ?? 'Unknown'} />;

    default:
      return null;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Extracts items from RichAnnotationBody, handling both array and object forms.
 */
function getBodyItems(body: RichAnnotationBody | null): RichAnnotationItem[] {
  if (!body) return [];
  // Handle array form
  if (Array.isArray(body)) return body;
  // Handle object form with items property
  if ('items' in body && Array.isArray(body.items)) return body.items;
  return [];
}

/**
 * Renders an annotation body with rich text and reference chips.
 *
 * @param props - Component props
 * @returns Rendered annotation body
 */
export function AnnotationBodyRenderer({
  body,
  className,
  mode = 'inline',
}: AnnotationBodyRendererProps) {
  const items = getBodyItems(body);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'leading-relaxed [&>*]:inline [&_.badge]:mx-0.5 [&_.badge]:align-baseline',
        mode === 'block' && 'whitespace-pre-wrap',
        className
      )}
      data-testid="annotation-body"
    >
      {items.map((item: RichAnnotationItem, index: number) => (
        <BodyItemRenderer key={index} item={item} />
      ))}
    </div>
  );
}
