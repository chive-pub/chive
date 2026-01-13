'use client';

/**
 * Supplementary materials panel for eprint pages.
 *
 * @remarks
 * Displays supplementary files with icons, labels, and download links.
 * Supports expandable view for many items.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react';
import {
  FileText,
  Image,
  Table2,
  Database,
  Code,
  Notebook,
  Video,
  Music,
  Presentation,
  ClipboardList,
  HelpCircle,
  Paperclip,
  Download,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supplementary material category.
 */
export type SupplementaryCategory =
  | 'appendix'
  | 'figure'
  | 'table'
  | 'dataset'
  | 'code'
  | 'notebook'
  | 'video'
  | 'audio'
  | 'presentation'
  | 'protocol'
  | 'questionnaire'
  | 'other';

/**
 * Supplementary material item.
 */
export interface SupplementaryItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Material category */
  category: SupplementaryCategory;
  /** Detected file format */
  format?: string;
  /** File size in bytes */
  size?: number;
  /** Download URL */
  downloadUrl?: string;
  /** Direct view URL (for images, PDFs) */
  viewUrl?: string;
}

/**
 * Props for SupplementaryPanel component.
 */
export interface SupplementaryPanelProps {
  /** List of supplementary materials */
  items: SupplementaryItem[];
  /** Initial number of items to show before collapse */
  initialVisibleCount?: number;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Category configuration mapping.
 */
const CATEGORY_CONFIG: Record<
  SupplementaryCategory,
  { icon: typeof FileText; label: string; color: string }
> = {
  appendix: { icon: FileText, label: 'Appendix', color: 'text-blue-500' },
  figure: { icon: Image, label: 'Figure', color: 'text-green-500' },
  table: { icon: Table2, label: 'Table', color: 'text-purple-500' },
  dataset: { icon: Database, label: 'Dataset', color: 'text-orange-500' },
  code: { icon: Code, label: 'Code', color: 'text-cyan-500' },
  notebook: { icon: Notebook, label: 'Notebook', color: 'text-yellow-500' },
  video: { icon: Video, label: 'Video', color: 'text-red-500' },
  audio: { icon: Music, label: 'Audio', color: 'text-pink-500' },
  presentation: { icon: Presentation, label: 'Presentation', color: 'text-indigo-500' },
  protocol: { icon: ClipboardList, label: 'Protocol', color: 'text-teal-500' },
  questionnaire: { icon: HelpCircle, label: 'Questionnaire', color: 'text-amber-500' },
  other: { icon: Paperclip, label: 'Other', color: 'text-gray-500' },
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single supplementary material item.
 */
function SupplementaryItemCard({ item }: { item: SupplementaryItem }) {
  const config = CATEGORY_CONFIG[item.category];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className={cn('shrink-0 mt-0.5', config.color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.label}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {config.label}
          </Badge>
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {item.format && <span className="uppercase">{item.format}</span>}
          {item.size && <span>{formatFileSize(item.size)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {item.viewUrl && (
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <a href={item.viewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">View</span>
            </a>
          </Button>
        )}
        {item.downloadUrl && (
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <a href={item.downloadUrl} download>
              <Download className="h-4 w-4" />
              <span className="sr-only">Download</span>
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Supplementary materials panel component.
 *
 * @param props - Component props
 * @returns Supplementary panel element
 */
export function SupplementaryPanel({
  items,
  initialVisibleCount = 5,
  className,
}: SupplementaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  if (items.length === 0) {
    return null;
  }

  const showToggle = items.length > initialVisibleCount;
  const visibleItems = isExpanded ? items : items.slice(0, initialVisibleCount);
  const hiddenCount = items.length - initialVisibleCount;

  // Group items by category for summary
  const categoryCounts = items.reduce(
    (acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    },
    {} as Record<SupplementaryCategory, number>
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Supplementary Materials
            <Badge variant="secondary" className="ml-1">
              {items.length}
            </Badge>
          </CardTitle>
        </div>
        {/* Category summary badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(categoryCounts).map(([category, count]) => {
            const config = CATEGORY_CONFIG[category as SupplementaryCategory];
            const Icon = config.icon;
            return (
              <Badge key={category} variant="outline" className="gap-1 text-xs">
                <Icon className={cn('h-3 w-3', config.color)} />
                {count} {config.label}
                {count > 1 && 's'}
              </Badge>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="space-y-2">
            {visibleItems.map((item) => (
              <SupplementaryItemCard key={item.id} item={item} />
            ))}
          </div>

          {showToggle && (
            <>
              <CollapsibleContent className="space-y-2">
                {items.slice(initialVisibleCount).map((item) => (
                  <SupplementaryItemCard key={item.id} item={item} />
                ))}
              </CollapsibleContent>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full mt-2" onClick={toggleExpanded}>
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show {hiddenCount} more
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}
