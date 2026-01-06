'use client';

import { BookMarked, MessageCircle, List, PenLine, Link2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import type { Backlink, BacklinkSourceType } from '@/lib/hooks/use-backlinks';

/**
 * Gets the appropriate icon for a backlink source type.
 */
function getSourceIcon(sourceType: BacklinkSourceType) {
  switch (sourceType) {
    case 'semble.collection':
      return BookMarked;
    case 'leaflet.list':
      return List;
    case 'whitewind.blog':
      return PenLine;
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
    case 'semble.collection':
      // Semble collections at semble.app/collection/{did}/{rkey}
      return `https://semble.app/collection/${did}/${rkey}`;
    case 'leaflet.list':
      // Leaflet lists at leaflet.pub/list/{did}/{rkey}
      return `https://leaflet.pub/list/${did}/${rkey}`;
    case 'whitewind.blog':
      // WhiteWind blogs at whitewind.blog/{handle}/{slug}
      return `https://whitewind.blog/profile/${did}/entry/${rkey}`;
    case 'bluesky.post':
    case 'bluesky.embed':
      // Bluesky posts at bsky.app/profile/{did}/post/{rkey}
      return `https://bsky.app/profile/${did}/post/${rkey}`;
    default:
      return null;
  }
}

/**
 * Gets a short label for the source type.
 */
function getSourceLabel(sourceType: BacklinkSourceType): string {
  switch (sourceType) {
    case 'semble.collection':
      return 'Semble';
    case 'leaflet.list':
      return 'Leaflet';
    case 'whitewind.blog':
      return 'WhiteWind';
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
