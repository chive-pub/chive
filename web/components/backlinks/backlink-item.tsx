'use client';

import {
  BookMarked,
  MessageCircle,
  FileText,
  CalendarDays,
  Highlighter,
  Users,
  Link2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import type { Backlink, BacklinkSourceType } from '@/lib/hooks/use-backlinks';

/**
 * Gets the appropriate icon for a backlink source type.
 */
function getSourceIcon(sourceType: BacklinkSourceType) {
  switch (sourceType) {
    case 'cosmik.collection':
      return BookMarked;
    case 'cosmik.connection':
    case 'cosmik.follow':
      return Users;
    case 'leaflet.document':
    case 'standard.document':
      return FileText;
    case 'leaflet.comment':
      return MessageCircle;
    case 'calendar.event':
      return CalendarDays;
    case 'margin.annotation':
    case 'margin.highlight':
    case 'margin.bookmark':
      return Highlighter;
    case 'bluesky.post':
    case 'bluesky.embed':
      return MessageCircle;
    case 'other':
    default:
      return Link2;
  }
}

/**
 * Builds a URL for viewing the source of a backlink.
 */
function buildSourceUrl(backlink: Backlink): string | null {
  const { sourceUri, sourceType } = backlink;

  // Parse the AT URI: at://did:plc:xyz/collection/rkey
  const match = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(sourceUri);
  if (!match) return null;

  const [, did, , rkey] = match;

  switch (sourceType) {
    case 'cosmik.collection':
      // Cosmik collections at cosmik.network/collection/{did}/{rkey}
      return `https://cosmik.network/collection/${did}/${rkey}`;
    case 'leaflet.document':
    case 'leaflet.comment':
      // Leaflet documents at leaflet.pub/{did}/{rkey}
      return `https://leaflet.pub/${did}/${rkey}`;
    case 'bluesky.post':
    case 'bluesky.embed':
      // Bluesky posts at bsky.app/profile/{did}/post/{rkey}
      return `https://bsky.app/profile/${did}/post/${rkey}`;
    default:
      // A standard.site document, a calendar event or a Margin annotation has
      // no single web host: the record is the artefact and each publisher
      // renders it at its own address. The AT-URI is shown instead of guessing
      // a link that may not resolve.
      return null;
  }
}

/**
 * Gets a short label for the source type.
 */
function getSourceLabel(sourceType: BacklinkSourceType): string {
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
 * Displays a single backlink with source icon, context, and timestamp.
 */
export function BacklinkItem({ backlink, className }: BacklinkItemProps) {
  const Icon = getSourceIcon(backlink.sourceType);
  const url = buildSourceUrl(backlink);
  const label = getSourceLabel(backlink.sourceType);
  const timeAgo = formatDistanceToNow(new Date(backlink.indexedAt), { addSuffix: true });

  const content = (
    <div className={`flex items-start gap-3 py-2 ${className ?? ''}`} data-testid="backlink-item">
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-xs text-muted-foreground" data-testid="backlink-timestamp">
            {timeAgo}
          </span>
        </div>
        {backlink.context && (
          <p className="text-sm text-foreground line-clamp-2 mt-0.5">{backlink.context}</p>
        )}
      </div>
    </div>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-muted/50 rounded-md -mx-2 px-2 transition-colors"
      >
        {content}
      </a>
    );
  }

  return content;
}
