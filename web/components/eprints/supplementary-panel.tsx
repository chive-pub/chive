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

import type { SupplementaryCategory } from '@/lib/api/generated/types/pub/chive/defs';
export type { SupplementaryCategory };

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
 * A Layers dataset linked to this eprint.
 *
 * @remarks
 * These are not Chive records. `pub.layers.eprint.dataLink` lives in its
 * author's repository and the Layers AppView is authoritative for it; Chive
 * federates the read. They appear here rather than in a panel of their own
 * because a reader looking for the data behind a paper is looking in the same
 * place they look for its appendix.
 */
export interface DataLinkItem {
  /** AT-URI of the dataLink record */
  uri: string;
  /** Data kind slug, as Layers records it */
  dataKind: string;
  /** Free-text description, when the author gave one */
  description?: string;
  /** Which part of the paper the data belongs to, such as 'Table 3' */
  paperSection?: string;
}

/**
 * Props for SupplementaryPanel component.
 */
export interface SupplementaryPanelProps {
  /** List of supplementary materials */
  items: SupplementaryItem[];
  /** Layers datasets linked to this eprint */
  dataLinks?: DataLinkItem[];
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
 * A single linked dataset.
 *
 * @remarks
 * `paperSection` is given prominence because it is what makes a link useful:
 * "the corpus" is an offer, "the corpus behind Table 3" is an answer.
 *
 * The card does not link out. All we hold is the AT-URI of the dataLink record
 * in its author's repository, and Layers' web routing is not settled, so any
 * URL we built from that URI today would be a guess that may 404. Showing the
 * dataset and saying where it lives is worth more than a broken link.
 */
function DataLinkCard({ link }: { link: DataLinkItem }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="shrink-0 mt-0.5 text-violet-500">
        <Database className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{formatDataKind(link.dataKind)}</span>
          {link.paperSection && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {link.paperSection}
            </Badge>
          )}
        </div>
        {link.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{link.description}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Render a Layers data kind slug as a label.
 *
 * @param kind - Slug such as `annotation-layer`
 * @returns A human label, or the slug itself when it is not one we know
 *
 * @remarks
 * Layers' lexicon uses `knownValues`, not a closed enum, so a slug this build
 * has never heard of is expected rather than exceptional. Showing the raw slug
 * is better than showing nothing or guessing.
 */
function formatDataKind(kind: string): string {
  const known: Record<string, string> = {
    corpus: 'Corpus',
    'annotation-layer': 'Annotation layer',
    'model-output': 'Model output',
    'gold-standard': 'Gold standard',
    'evaluation-data': 'Evaluation data',
    supplementary: 'Supplementary data',
    replication: 'Replication data',
  };
  return known[kind] ?? kind;
}

/**
 * Supplementary materials panel component.
 *
 * @param props - Component props
 * @returns Supplementary panel element
 */
export function SupplementaryPanel({
  items,
  dataLinks = [],
  initialVisibleCount = 5,
  className,
}: SupplementaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Either kind of material is reason enough to show the panel. A paper with
  // linked datasets and no uploaded appendix still has auxiliary material.
  if (items.length === 0 && dataLinks.length === 0) {
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
        {dataLinks.length > 0 && (
          <div className="space-y-2 pb-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Linked datasets
              <span className="ml-2 font-normal">on Layers</span>
            </h3>
            {dataLinks.map((link) => (
              <DataLinkCard key={link.uri} link={link} />
            ))}
          </div>
        )}
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
