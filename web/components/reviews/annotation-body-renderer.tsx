'use client';

/**
 * AnnotationBodyRenderer component for displaying rich text annotation bodies.
 *
 * @remarks
 * Renders annotation body items (FOVEA GlossItem pattern) as a mix of
 * text and interactive reference chips. References link to their targets
 * (Wikidata, authorities, fields, eprints, etc.).
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
 * Renders an authority record reference as a chip.
 */
function AuthorityRefChip({ uri, label }: { uri: string; label: string }) {
  // Extract authority ID from AT-URI for routing
  const authorityId = uri.split('/').pop() || uri;

  return (
    <Link href={`/authorities/${encodeURIComponent(authorityId)}`}>
      <Badge
        variant="secondary"
        className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300"
      >
        {label}
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

  return (
    <Link href={`/fields/${encodeURIComponent(fieldId)}`}>
      <Badge
        variant="secondary"
        className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
      >
        {label}
      </Badge>
    </Link>
  );
}

/**
 * Renders a facet reference as a chip.
 */
function FacetRefChip({ dimension, value }: { dimension: string; value: string }) {
  return (
    <Link href={`/browse?${dimension}=${encodeURIComponent(value)}`}>
      <Badge
        variant="secondary"
        className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300"
      >
        {dimension}: {value}
      </Badge>
    </Link>
  );
}

/**
 * Renders a eprint reference as a chip.
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
  return (
    <Link href={`/authors/${encodeURIComponent(did)}`}>
      <Badge
        variant="secondary"
        className="bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-300"
      >
        @{displayName}
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
      return <WikidataRefChip qid={item.qid} label={item.label} url={item.url} />;

    case 'authorityRef':
      return <AuthorityRefChip uri={item.uri} label={item.label} />;

    case 'fieldRef':
      return <FieldRefChip uri={item.uri} label={item.label} />;

    case 'facetRef':
      return <FacetRefChip dimension={item.dimension} value={item.value} />;

    case 'eprintRef':
      return <EprintRefChip uri={item.uri} title={item.title} />;

    case 'annotationRef':
      return <AnnotationRefChip uri={item.uri} excerpt={item.excerpt} />;

    case 'authorRef':
      return <AuthorRefChip did={item.did} displayName={item.displayName} />;

    default:
      return null;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Renders an annotation body with rich text and reference chips.
 *
 * @param props - Component props
 * @returns Rendered annotation body
 */
export function AnnotationBodyRenderer({ body, className }: AnnotationBodyRendererProps) {
  if (!body || !body.items || body.items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'leading-relaxed [&>*]:inline [&_.badge]:mx-0.5 [&_.badge]:align-baseline',
        className
      )}
      data-testid="annotation-body"
    >
      {body.items.map((item, index) => (
        <BodyItemRenderer key={index} item={item} />
      ))}
    </div>
  );
}
