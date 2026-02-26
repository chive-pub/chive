'use client';

/**
 * Related works panel for eprint pages.
 *
 * @remarks
 * Displays related works with DataCite-compatible relation types,
 * linked by various identifier types (DOI, arXiv, PMID, etc.).
 *
 * @packageDocumentation
 */

import Link from 'next/link';
import { ExternalLink, Link2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RelatedWork } from '@/lib/api/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface RelatedWorksPanelProps {
  /** List of related works */
  relatedWorks?: RelatedWork[];
  /** Additional class names */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Converts a camelCase relation type to human-readable form.
 *
 * @example
 * camelCaseToHuman('isPreprintOf') => 'Is Preprint Of'
 * camelCaseToHuman('isReferencedBy') => 'Is Referenced By'
 */
function camelCaseToHuman(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Resolves an identifier to a URL based on its type.
 *
 * @returns An object with `href` and `isExternal` indicating link type,
 *          or null if no link can be generated.
 */
function resolveIdentifierUrl(
  identifier: string,
  identifierType: string
): { href: string; isExternal: boolean } | null {
  switch (identifierType) {
    case 'doi':
      return { href: `https://doi.org/${identifier}`, isExternal: true };
    case 'arxiv':
      return { href: `https://arxiv.org/abs/${identifier}`, isExternal: true };
    case 'pmid':
      return { href: `https://pubmed.ncbi.nlm.nih.gov/${identifier}`, isExternal: true };
    case 'pmcid':
      return { href: `https://www.ncbi.nlm.nih.gov/pmc/articles/${identifier}`, isExternal: true };
    case 'url':
      return { href: identifier, isExternal: true };
    case 'at-uri':
      return { href: `/eprints/${encodeURIComponent(identifier)}`, isExternal: false };
    case 'isbn':
      return { href: `https://www.worldcat.org/isbn/${identifier}`, isExternal: true };
    default:
      return null;
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single related work row.
 */
function RelatedWorkRow({ work }: { work: RelatedWork }) {
  const resolved = resolveIdentifierUrl(work.identifier, work.identifierType);
  const humanRelation = camelCaseToHuman(work.relationType);

  return (
    <div className="p-3 rounded-lg border bg-card space-y-1.5">
      <div className="flex items-start gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
          {humanRelation}
        </Badge>
      </div>

      {work.title && <p className="text-sm font-medium leading-snug">{work.title}</p>}

      <div className="min-w-0">
        {resolved ? (
          resolved.isExternal ? (
            <a
              href={resolved.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1 min-h-[44px] sm:min-h-0"
            >
              <span className="font-mono truncate">{work.identifier}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <Link
              href={resolved.href}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1 min-h-[44px] sm:min-h-0"
            >
              <span className="font-mono truncate">{work.identifier}</span>
            </Link>
          )
        ) : (
          <span className="text-xs text-muted-foreground font-mono truncate block">
            {work.identifier}
          </span>
        )}
      </div>

      {work.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{work.description}</p>
      )}
    </div>
  );
}

/**
 * Related works panel component.
 *
 * Displays a card listing related works with their relation types,
 * identifiers, and optional descriptions.
 *
 * @param props - Component props
 * @returns Related works panel element, or null when empty
 */
export function RelatedWorksPanel({ relatedWorks, className }: RelatedWorksPanelProps) {
  if (!relatedWorks || relatedWorks.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Related Works
          <Badge variant="secondary" className="ml-1">
            {relatedWorks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {relatedWorks.map((work, index) => (
          <RelatedWorkRow key={`${work.identifier}-${index}`} work={work} />
        ))}
      </CardContent>
    </Card>
  );
}
