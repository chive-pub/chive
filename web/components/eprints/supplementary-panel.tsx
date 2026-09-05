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
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ResourceCard,
  type ResourceAction,
  type ResourceStat,
} from '@/components/links/resource-card';
import { describeAtUri } from '@/lib/atproto/at-uri-links';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

import type { SupplementaryCategory } from '@/lib/api/generated/types/pub/chive/defs';
import { DatasetSnippet } from '@/components/eprints/dataset-snippet';
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
  /**
   * AT-URI of the Layers corpus the link points at.
   *
   * @remarks
   * Optional in the lexicon: a link can record that data exists without
   * naming the record that holds it. Only a link that names one can be
   * turned into code that loads it.
   */
  /** The dataset as a whole (`pub.layers.catalog.collection`) */
  catalogRef?: string;
  corpusRef?: string;
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

  const stats: ResourceStat[] = [];
  if (item.format) stats.push({ label: item.format.toUpperCase() });
  if (item.size) stats.push({ label: formatFileSize(item.size) });

  const actions: ResourceAction[] = [];
  if (item.viewUrl) actions.push({ label: 'View', href: item.viewUrl });
  if (item.downloadUrl) {
    actions.push({ label: 'Download', href: item.downloadUrl, download: true, icon: Download });
  }

  return (
    <ResourceCard
      icon={config.icon}
      iconColor={config.color}
      title={item.label}
      badge={config.label}
      description={item.description}
      stats={stats}
      actions={actions}
    />
  );
}

/**
 * A single linked dataset.
 *
 * @remarks
 * `paperSection` is given prominence because it is what makes a link useful:
 * "the corpus" is an offer, "the corpus behind Table 3" is an answer.
 *
 * Layers' web routing is still unsettled, so the card offers no address on
 * layers.pub -- a URL built from the AT-URI today would be a guess. It does
 * offer the record itself through a public record browser, which resolves any
 * AT-URI by reading it from the repository that holds it, so the dataset is
 * reachable rather than merely named.
 */
function DataLinkCard({ link }: { link: DataLinkItem }) {
  const reference = link.catalogRef ?? link.corpusRef;
  const record = reference ? describeAtUri(reference) : null;

  const stats: ResourceStat[] = [];
  if (link.paperSection) stats.push({ label: link.paperSection });

  const actions: ResourceAction[] = record
    ? [{ label: 'View record', href: record.recordUrl }]
    : [];

  return (
    <ResourceCard
      icon={Database}
      iconColor="text-violet-600"
      iconBg="bg-violet-50 dark:bg-violet-950"
      title={formatDataKind(link.dataKind)}
      badge="Layers"
      subtitle={reference}
      subtitleMono
      description={link.description}
      stats={stats}
      actions={actions}
    >
      <DatasetSnippet catalogRef={link.catalogRef} corpusRef={link.corpusRef} />
    </ResourceCard>
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
    experiment: 'Experiment',
    judgments: 'Judgments',
    dataset: 'Dataset',
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
            {/* The panel holds uploaded files and datasets linked on Layers,
                and it renders both. Counting only the first showed "0" above a
                card. */}
            <Badge variant="secondary" className="ml-1">
              {items.length + dataLinks.length}
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
