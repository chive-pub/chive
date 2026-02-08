'use client';

/**
 * Format-aware component for displaying annotation location context.
 *
 * @remarks
 * Displays the location and quoted text from an annotation target with
 * format-appropriate icons and labels. Supports PDF pages, Jupyter cells,
 * sections, and line numbers.
 *
 * Visual structure:
 * - Header with location badge and optional "Go to" button
 * - Quote section with prefix, exact text (highlighted), and suffix
 *
 * @example
 * ```tsx
 * <DocumentLocationCard
 *   target={review.target}
 *   documentFormat="pdf"
 *   onGoToLocation={() => scrollToPage(5)}
 * />
 * ```
 *
 * @packageDocumentation
 */

import { FileText, Hash, Code, AlignLeft, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  extractLocationInfo,
  formatLocationLabel,
  getGoToButtonLabel,
  type LocationInfo,
} from '@/lib/utils/document-location';
import type { Review } from '@/lib/api/schema';
import type { DocumentFormat } from '@/lib/api/generated/types/pub/chive/defs';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the DocumentLocationCard component.
 */
export interface DocumentLocationCardProps {
  /** The annotation target containing selector and location data */
  target: Review['target'];
  /** Document format for format-specific icons and labels */
  documentFormat?: DocumentFormat;
  /** Callback when "Go to" button is clicked */
  onGoToLocation?: () => void;
  /** Whether to show a thumbnail preview (PDF only, for future use) */
  showThumbnail?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Gets the appropriate icon for a document format.
 *
 * @param format - the document format
 * @returns React element for the icon
 */
function getFormatIcon(format?: DocumentFormat) {
  switch (format) {
    case 'pdf':
    case 'latex':
      return <FileText className="h-3 w-3" />;
    case 'jupyter':
      return <Code className="h-3 w-3" />;
    case 'html':
    case 'markdown':
      return <Hash className="h-3 w-3" />;
    case 'txt':
    default:
      return <AlignLeft className="h-3 w-3" />;
  }
}

/**
 * Gets the icon for a specific location type.
 *
 * @param location - the location info
 * @param format - the document format
 * @returns React element for the icon
 */
function getLocationIcon(location: LocationInfo | null, format?: DocumentFormat) {
  if (!location) {
    return getFormatIcon(format);
  }

  switch (location.type) {
    case 'page':
      return <FileText className="h-3 w-3" />;
    case 'cell':
      return <Code className="h-3 w-3" />;
    case 'section':
      return <Hash className="h-3 w-3" />;
    case 'line':
    case 'position':
      return <AlignLeft className="h-3 w-3" />;
    default:
      return getFormatIcon(format);
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Displays annotation location context with format-aware styling.
 *
 * @remarks
 * Returns null if the target has no selector (no quote to display).
 * The component gracefully handles missing prefix/suffix by only
 * displaying the exact text.
 *
 * @param props - component props
 * @returns document location card element, or null if no selector
 */
export function DocumentLocationCard({
  target,
  documentFormat,
  onGoToLocation,
  showThumbnail: _showThumbnail = false,
  className,
}: DocumentLocationCardProps) {
  // Early return if no target or selector
  if (!target?.selector) {
    return null;
  }

  const { exact, prefix, suffix } = target.selector;

  // Extract location information
  const location = extractLocationInfo(target, documentFormat);
  const locationLabel = location ? formatLocationLabel(location) : null;
  const goToLabel = getGoToButtonLabel(documentFormat);
  const icon = getLocationIcon(location, documentFormat);

  return (
    <div
      className={cn('rounded-md border border-l-2 border-l-primary/50 bg-muted/30', className)}
      data-testid="document-location-card"
    >
      {/* Header with location badge and Go to button */}
      {(locationLabel || onGoToLocation) && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50">
          {locationLabel && (
            <Badge variant="secondary" className="flex items-center gap-1.5 text-xs font-normal">
              {icon}
              <span>{locationLabel}</span>
            </Badge>
          )}
          {onGoToLocation && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onGoToLocation}
            >
              <ExternalLink className="h-3 w-3" />
              {goToLabel}
            </Button>
          )}
        </div>
      )}

      {/* Quote section */}
      <div className="px-3 py-2 text-sm">
        <blockquote className="space-x-1">
          {/* Prefix with ellipsis */}
          {prefix && (
            <span className="text-muted-foreground">
              <span aria-hidden="true">&hellip;</span>
              {prefix}
            </span>
          )}

          {/* Exact text (highlighted) */}
          <span className="bg-primary/10 px-0.5 rounded-sm font-medium">{exact}</span>

          {/* Suffix with ellipsis */}
          {suffix && (
            <span className="text-muted-foreground">
              {suffix}
              <span aria-hidden="true">&hellip;</span>
            </span>
          )}
        </blockquote>
      </div>
    </div>
  );
}
