import Link from 'next/link';
import { Scale, ExternalLink, Tag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { FieldBadgeList } from './field-badge';
import { cn } from '@/lib/utils';
import type { FieldRef } from '@/lib/api/schema';

/**
 * Props for the PreprintMetadata component.
 */
export interface PreprintMetadataProps {
  /** Field references */
  fields?: FieldRef[];
  /** Keywords */
  keywords?: string[];
  /** License identifier */
  license: string;
  /** DOI (if assigned) */
  doi?: string;
  /** Display layout */
  layout?: 'inline' | 'stacked';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays preprint metadata including fields, keywords, license, and DOI.
 *
 * @remarks
 * Server component that renders structured metadata for a preprint.
 *
 * @example
 * ```tsx
 * <PreprintMetadata
 *   fields={preprint.fields}
 *   keywords={preprint.keywords}
 *   license="CC-BY-4.0"
 *   doi="10.1234/example"
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the metadata
 */
export function PreprintMetadata({
  fields,
  keywords,
  license,
  doi,
  layout = 'stacked',
  className,
}: PreprintMetadataProps) {
  if (layout === 'inline') {
    return (
      <div className={cn('flex flex-wrap items-center gap-4 text-sm', className)}>
        {fields && fields.length > 0 && <FieldBadgeList fields={fields} max={3} />}
        <LicenseBadge license={license} />
        {doi && <DoiLink doi={doi} />}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {fields && fields.length > 0 && (
        <MetadataSection label="Fields">
          <FieldBadgeList fields={fields} max={10} />
        </MetadataSection>
      )}

      {keywords && keywords.length > 0 && (
        <MetadataSection label="Keywords">
          <KeywordList keywords={keywords} />
        </MetadataSection>
      )}

      <MetadataSection label="License">
        <LicenseBadge license={license} showName />
      </MetadataSection>

      {doi && (
        <MetadataSection label="DOI">
          <DoiLink doi={doi} showFull />
        </MetadataSection>
      )}
    </div>
  );
}

interface MetadataSectionProps {
  label: string;
  children: React.ReactNode;
}

function MetadataSection({ label, children }: MetadataSectionProps) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      {children}
    </div>
  );
}

/**
 * Props for the KeywordList component.
 */
export interface KeywordListProps {
  /** Keywords */
  keywords: string[];
  /** Maximum keywords to show */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a list of keywords as clickable badges.
 */
export function KeywordList({ keywords, max = 10, className }: KeywordListProps) {
  const visibleKeywords = keywords.slice(0, max);
  const hiddenCount = keywords.length - max;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visibleKeywords.map((keyword) => (
        <Link
          key={keyword}
          href={`/search?q=${encodeURIComponent(keyword)}`}
          className="inline-block"
        >
          <Badge variant="outline" className="cursor-pointer hover:bg-accent">
            <Tag className="mr-1 h-3 w-3" />
            {keyword}
          </Badge>
        </Link>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
}

/**
 * Props for the LicenseBadge component.
 */
export interface LicenseBadgeProps {
  /** License identifier (e.g., "CC-BY-4.0") */
  license: string;
  /** Whether to show the full license name */
  showName?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a license badge with optional link to license details.
 */
export function LicenseBadge({ license, showName = false, className }: LicenseBadgeProps) {
  const licenseInfo = getLicenseInfo(license);

  return (
    <a
      href={licenseInfo.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 text-sm hover:text-primary', className)}
    >
      <Scale className="h-4 w-4" />
      <span>{showName ? licenseInfo.name : license}</span>
    </a>
  );
}

/**
 * Props for the DoiLink component.
 */
export interface DoiLinkProps {
  /** DOI (with or without prefix) */
  doi: string;
  /** Whether to show the full DOI URL */
  showFull?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a DOI as a clickable link.
 */
export function DoiLink({ doi, showFull = false, className }: DoiLinkProps) {
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '');
  const doiUrl = `https://doi.org/${cleanDoi}`;

  return (
    <a
      href={doiUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 font-mono text-sm hover:text-primary hover:underline',
        className
      )}
    >
      {showFull ? doiUrl : cleanDoi}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * License information lookup.
 */
function getLicenseInfo(license: string): { name: string; url: string } {
  const licenses: Record<string, { name: string; url: string }> = {
    'CC-BY-4.0': {
      name: 'Creative Commons Attribution 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    'CC-BY-SA-4.0': {
      name: 'Creative Commons Attribution-ShareAlike 4.0',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    'CC-BY-NC-4.0': {
      name: 'Creative Commons Attribution-NonCommercial 4.0',
      url: 'https://creativecommons.org/licenses/by-nc/4.0/',
    },
    'CC-BY-NC-SA-4.0': {
      name: 'Creative Commons Attribution-NonCommercial-ShareAlike 4.0',
      url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    },
    'CC0-1.0': {
      name: 'CC0 1.0 Universal (Public Domain)',
      url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  };

  return (
    licenses[license] ?? {
      name: license,
      url: `https://spdx.org/licenses/${license}.html`,
    }
  );
}
