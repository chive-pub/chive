'use client';

/**
 * One reference to a paper from elsewhere in the atmosphere.
 *
 * @remarks
 * These used to render as a grey icon, a two-word label and a line of context,
 * which said almost nothing and, for most source types, offered no way through
 * to the thing being described. Two of the links that were offered were wrong:
 * a `network.cosmik.card` was linked as though it were a Cosmik collection, and
 * every Leaflet reference was linked as a document, including the comments.
 *
 * The card now says which application published the record, what kind of record
 * it is, when it appeared, and what it said, and it offers the record itself
 * through a public record browser -- which works for every source type,
 * including the ones no application renders on the web yet.
 *
 * @packageDocumentation
 */

import {
  BookMarked,
  MessageCircle,
  FileText,
  CalendarDays,
  Highlighter,
  Link2,
  Clock,
  Layers as LayersIcon,
  GitBranch,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import {
  ResourceCard,
  type ResourceAction,
  type ResourceStat,
} from '@/components/links/resource-card';
import { describeAtUri } from '@/lib/atproto/at-uri-links';
import type { Backlink, BacklinkSourceType } from '@/lib/hooks/use-backlinks';

/** How a publishing application is drawn. */
interface AppStyle {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

/**
 * Icon and colour per application.
 *
 * @remarks
 * Keyed on the application name that {@link describeAtUri} derives from the
 * record's own collection NSID, so a Leaflet comment and a Leaflet document
 * agree, and an application Chive has not heard of falls through to the
 * generic link mark rather than borrowing another service's colour.
 */
const APP_STYLES: Record<string, AppStyle> = {
  Leaflet: { icon: FileText, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950' },
  Cosmik: {
    icon: BookMarked,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 dark:bg-violet-950',
  },
  Margin: {
    icon: Highlighter,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
  },
  'Smoke Signal': {
    icon: CalendarDays,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-950',
  },
  'standard.site': {
    icon: FileText,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950',
  },
  Bluesky: { icon: MessageCircle, color: 'text-sky-600', bgColor: 'bg-sky-50 dark:bg-sky-950' },
  Layers: {
    icon: LayersIcon,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950',
  },
  Tangled: {
    icon: GitBranch,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
  },
};

const FALLBACK_STYLE: AppStyle = {
  icon: Link2,
  color: 'text-muted-foreground',
  bgColor: 'bg-muted',
};

/**
 * Icon and colour for a reference.
 *
 * @param appName - Application name from the record's collection
 * @param sourceType - Chive's own classification, used when the collection is unknown
 * @returns How to draw it
 */
function styleFor(appName: string | undefined, sourceType: BacklinkSourceType): AppStyle {
  if (appName && APP_STYLES[appName]) return APP_STYLES[appName];
  // A record whose collection Chive does not recognize can still be placed by
  // the source type the indexing plugin assigned it.
  const prefix = String(sourceType).split('.')[0];
  const byPrefix: Record<string, AppStyle> = {
    cosmik: APP_STYLES.Cosmik,
    leaflet: APP_STYLES.Leaflet,
    margin: APP_STYLES.Margin,
    standard: APP_STYLES['standard.site'],
    calendar: APP_STYLES['Smoke Signal'],
    bluesky: APP_STYLES.Bluesky,
  };
  return byPrefix[prefix] ?? FALLBACK_STYLE;
}

/**
 * Gets a human-readable label for a backlink source type.
 *
 * @param sourceType - Chive's classification of the source record
 * @returns A short label
 *
 * @remarks
 * Used only where the record's own collection could not be read from the URI.
 * The collection is the better answer wherever it is available, because it
 * distinguishes records the source type conflates.
 */
export function getSourceLabel(sourceType: BacklinkSourceType): string {
  switch (sourceType) {
    case 'cosmik.collection':
      return 'Cosmik';
    case 'cosmik.connection':
      return 'Cosmik connection';
    case 'cosmik.follow':
      return 'Cosmik follow';
    case 'leaflet.document':
      return 'Leaflet';
    case 'leaflet.comment':
      return 'Leaflet comment';
    case 'standard.document':
      return 'Document';
    case 'calendar.event':
      return 'Talk';
    case 'margin.annotation':
      return 'Margin annotation';
    case 'margin.highlight':
      return 'Margin highlight';
    case 'margin.bookmark':
      return 'Margin bookmark';
    case 'bluesky.post':
      return 'Bluesky';
    case 'bluesky.embed':
      return 'Bluesky Embed';
    case 'other':
    default:
      return 'Link';
  }
}

export interface BacklinkItemProps {
  backlink: Backlink;
  className?: string;
}

/**
 * Displays a single reference to this paper from another application.
 *
 * @param props - Component props
 * @returns The card
 *
 * @public
 */
export function BacklinkItem({ backlink, className }: BacklinkItemProps) {
  const record = describeAtUri(backlink.sourceUri);
  const style = styleFor(record?.appName, backlink.sourceType);

  const appName = record?.appName ?? getSourceLabel(backlink.sourceType);
  const kind = record?.kind ?? 'Record';

  // The context is whatever the source record called itself -- an essay's
  // title, an event's name, the text of an annotation. Where there is one it
  // is the most informative thing on the card, so it leads.
  const title = backlink.context?.trim() || `${appName} ${kind.toLowerCase()}`;

  const indexed = new Date(backlink.indexedAt);
  const stats: ResourceStat[] = [{ label: kind }];
  if (!Number.isNaN(indexed.getTime())) {
    stats.push({
      icon: Clock,
      label: formatDistanceToNow(indexed, { addSuffix: true }),
      title: indexed.toLocaleString(),
    });
  }

  const actions: ResourceAction[] = [];
  if (record?.webUrl) actions.push({ label: `Open in ${record.appName}`, href: record.webUrl });
  if (record) actions.push({ label: 'View record', href: record.recordUrl });

  return (
    <div data-testid="backlink-item" className={className}>
      <ResourceCard
        icon={style.icon}
        iconColor={style.color}
        iconBg={style.bgColor}
        title={title}
        badge={appName}
        subtitle={backlink.sourceUri}
        subtitleMono
        stats={stats}
        actions={actions}
      />
    </div>
  );
}
