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
  ArrowRight,
  FolderOpen,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import {
  ChiveMark,
  LeafletMark,
  MarginMark,
  SembleMark,
  StandardSiteMark,
} from '@/components/integrations/brand-marks';
import {
  ResourceCard,
  type ResourceAction,
  type ResourceStat,
} from '@/components/links/resource-card';
import { describeAtUri, summarizeUrl } from '@/lib/atproto/at-uri-links';
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
  // Semble is the application's name; `network.cosmik` is only its namespace.
  Semble: {
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

/**
 * The services that publish a usable vector mark.
 *
 * @remarks
 * A card carrying the service's own mark does not also need to be labelled with
 * its name -- the mark says it faster than the word does. Where a service
 * publishes no vector, the card keeps a generic glyph *and* the name, because a
 * generic glyph on its own identifies nothing.
 *
 * Smoke Signal publishes no vector anywhere and so is absent here on purpose.
 */
const BRAND_MARKS: Record<string, React.ComponentType<{ className?: string }>> = {
  Leaflet: LeafletMark,
  Semble: SembleMark,
  Margin: MarginMark,
  'standard.site': StandardSiteMark,
  Chive: ChiveMark,
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
    cosmik: APP_STYLES.Semble,
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
      return 'Semble';
    case 'cosmik.connection':
      return 'Semble connection';
    case 'cosmik.follow':
      return 'Semble follow';
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

/**
 * Renders a machine value as something a reader can read.
 *
 * @param label - The value as the source record wrote it
 * @returns The same value in prose casing
 *
 * @remarks
 * Foreign lexicons disagree about how to spell an enum: Margin writes
 * `commenting`, Cosmik writes `RELATED`, and a Chive relation slug is
 * `builds-on`. Rendered as written, the chips in one list are in three
 * different cases. Lowercasing an all-capitals token and unhyphenating the
 * rest leaves the CSS to capitalize the first letter, so all three arrive as
 * "Commenting", "Related", "Builds on".
 *
 * Only a token with no lowercase at all is folded, so a value that is
 * deliberately capitalised part-way -- an initialism inside a phrase -- keeps
 * its shape.
 */
export function humanizeLabel(label: string): string {
  const cased = /[a-z]/.test(label) ? label : label.toLowerCase();
  return cased.replace(/[-_]+/g, ' ').trim();
}

/**
 * The stat naming what a record joined this paper to.
 *
 * @param relatedUri - The other end, as an AT-URI or a URL
 * @param relatedTitle - Its title, where Chive holds the record
 * @returns A stat pointing at the other end, or undefined when there is none
 *
 * @remarks
 * Three cases, and only the first can be named: an eprint Chive has indexed
 * links to its page by title; any other record goes to the record browser,
 * since no title is available for something Chive does not hold; and anything
 * else on the web is shown by its address.
 */
function relatedEnd(relatedUri?: string, relatedTitle?: string): ResourceStat | undefined {
  const uri = relatedUri?.trim();
  if (!uri) return undefined;

  if (uri.startsWith('at://')) {
    const record = describeAtUri(uri);
    const isEprint = uri.includes('pub.chive.eprint.submission');
    return {
      icon: ArrowRight,
      label: relatedTitle ?? (isEprint ? 'a paper on Chive' : (record?.kind ?? 'a record')),
      title: uri,
      // A paper Chive holds is a page on this site, so it opens in place; a
      // record it does not hold can only be shown by a record browser.
      ...(isEprint
        ? { href: `/eprints/${encodeURIComponent(uri)}` }
        : record
          ? { href: record.recordUrl, external: true }
          : {}),
    };
  }

  return { icon: ArrowRight, label: summarizeUrl(uri), title: uri, href: uri, external: true };
}

/**
 * The stat naming the collection a record is drawn inside.
 *
 * @param containerUri - AT-URI of the containing record
 * @param containerName - Its name, where Chive has indexed it
 * @returns A stat pointing at the container, or undefined when there is none
 *
 * @remarks
 * Semble renders a card within a collection, which is where a reader actually
 * sees it. A card whose collection Chive has not indexed still gets the link,
 * unnamed, because the address is derivable from the URI alone.
 */
function containerEnd(containerUri?: string, containerName?: string): ResourceStat | undefined {
  const uri = containerUri?.trim();
  if (!uri) return undefined;
  const record = describeAtUri(uri);
  if (!record?.webUrl) return undefined;
  return {
    icon: FolderOpen,
    label: containerName ?? `a ${record.appName} ${record.kind.toLowerCase()}`,
    title: uri,
    href: record.webUrl,
    external: true,
  };
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
  // The handle is passed because Margin addresses a note by its author's
  // handle and answers "Not found" to the DID the AT-URI carries.
  const record = describeAtUri(backlink.sourceUri, backlink.sourceHandle);
  const style = styleFor(record?.appName, backlink.sourceType);

  const appName = record?.appName ?? getSourceLabel(backlink.sourceType);
  const kind = record?.kind ?? 'Record';

  // The context is whatever the source record called itself -- an essay's
  // title, an event's name, the text of an annotation. Where there is one it
  // is the most informative thing on the card, so it leads.
  const title = backlink.context?.trim() || `${appName} ${kind.toLowerCase()}`;

  // A typed field the source record carries -- a Margin motivation, a Cosmik
  // relation. Drawn as a chip rather than joined onto the front of the title,
  // which is where it used to appear: a card read "commenting: The gradable
  // adjective case is…", presenting a machine value as the first words of a
  // sentence.
  const label = backlink.contextLabel?.trim();

  // The record's own description, set beneath the title rather than joined onto
  // it with a colon. A Leaflet document has both, and run together they read as
  // one sentence with no visible seam.
  const detail = backlink.contextDetail?.trim();

  const indexed = new Date(backlink.indexedAt);
  const stats: ResourceStat[] = [{ label: kind }];
  if (!Number.isNaN(indexed.getTime())) {
    stats.push({
      icon: Clock,
      label: formatDistanceToNow(indexed, { addSuffix: true }),
      title: indexed.toLocaleString(),
    });
  }

  // The other end of a record that joins this paper to something. A Semble
  // connection is an edge, and a card carrying only the note said what its
  // author thought about a relationship without ever naming the other half of
  // it.
  const related = relatedEnd(backlink.relatedUri, backlink.relatedTitle);
  if (related) stats.push(related);

  // Where the record is drawn. A Semble card's own page is still a placeholder,
  // so the collection holding it is where a reader sees the card today.
  const container = containerEnd(backlink.containerUri, backlink.containerName);
  if (container) stats.push(container);

  // The mark identifies the service, so the name is not repeated beside it.
  const brand = BRAND_MARKS[appName];

  // Who wrote it. These records live in their authors' own repositories, and a
  // card that never says whose reads as though Chive had written it. The DID
  // is not shown: it identifies the account without naming it.
  const handle = backlink.sourceHandle;
  const byline = handle ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- an avatar served
          by someone else's profile service, not an asset this app ships. */}
      {backlink.sourceAvatar && (
        <img
          src={backlink.sourceAvatar}
          alt=""
          className="h-4 w-4 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      )}
      {backlink.sourceDisplayName && (
        <span className="font-medium text-foreground">{backlink.sourceDisplayName}</span>
      )}
      <span className="text-muted-foreground">@{handle}</span>
    </>
  ) : undefined;

  const actions: ResourceAction[] = [];
  if (record?.webUrl) actions.push({ label: `Open in ${record.appName}`, href: record.webUrl });
  if (record) actions.push({ label: 'View record', href: record.recordUrl });

  return (
    <div data-testid="backlink-item" className={className}>
      <ResourceCard
        icon={brand ?? style.icon}
        iconColor={brand ? undefined : style.color}
        // A brand mark carries its own colour, so it sits on a neutral tile
        // rather than one tinted to a hue the service does not use.
        iconBg={brand ? 'bg-muted' : style.bgColor}
        title={title}
        {...(brand ? {} : { badge: appName })}
        description={detail}
        byline={byline}
        stats={stats}
        actions={actions}
        {...(label ? { labelBadge: humanizeLabel(label) } : {})}
      />
    </div>
  );
}
