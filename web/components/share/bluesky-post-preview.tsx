'use client';

/**
 * Bluesky post preview component.
 *
 * @remarks
 * Renders a preview of how the post will appear on Bluesky,
 * matching Bluesky's visual design for high-fidelity WYSIWYG.
 */

import { useMemo } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Author info for the preview.
 */
interface PreviewAuthor {
  displayName: string;
  handle: string;
  avatar?: string;
}

/**
 * Link card info for the preview.
 */
interface PreviewLinkCard {
  url: string;
  title: string;
  description: string;
  thumbUrl?: string;
}

/**
 * Props for the BlueskyPostPreview component.
 */
interface BlueskyPostPreviewProps {
  /** Author of the post */
  author: PreviewAuthor;
  /** Post text content */
  text: string;
  /** Link card embed */
  linkCard: PreviewLinkCard;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Parse text to highlight mentions and hashtags.
 */
function parseTextWithHighlights(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  // Match @mentions and #hashtags
  const regex = /(@[\w.-]+|#\w+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      elements.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }

    // Add the highlighted match
    const matchText = match[0];
    const isMention = matchText.startsWith('@');

    elements.push(
      <span
        key={`match-${match.index}`}
        className={cn('font-medium', isMention ? 'text-blue-500' : 'text-blue-500')}
      >
        {matchText}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return elements;
}

/**
 * Extract domain from URL.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Bluesky post preview component.
 *
 * @remarks
 * Renders a high-fidelity preview matching Bluesky's visual design:
 * - Avatar: 42x42 rounded-full
 * - Display name: semibold, primary text
 * - Handle: @handle, muted text
 * - Post text: normal weight, mentions/hashtags highlighted in blue
 * - Link card: rounded border, thumbnail on left (80x80), title bold, description truncated
 *
 * @example
 * ```tsx
 * <BlueskyPostPreview
 *   author={{ displayName: 'Alice', handle: 'alice.bsky.social' }}
 *   text="Check out this amazing preprint! @bob #science"
 *   linkCard={{
 *     url: 'https://chive.pub/preprints/...',
 *     title: 'Novel Research',
 *     description: 'Abstract excerpt...',
 *     thumbUrl: '/api/og?type=preprint&...'
 *   }}
 * />
 * ```
 */
export function BlueskyPostPreview({ author, text, linkCard, className }: BlueskyPostPreviewProps) {
  const highlightedText = useMemo(() => parseTextWithHighlights(text), [text]);
  const domain = useMemo(() => extractDomain(linkCard.url), [linkCard.url]);

  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      {/* Author header */}
      <div className="flex items-start gap-3">
        <Avatar className="h-[42px] w-[42px]">
          {author.avatar ? <AvatarImage src={author.avatar} alt={author.displayName} /> : null}
          <AvatarFallback>
            <User className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Author info */}
          <div className="flex items-baseline gap-1">
            <span className="font-semibold text-sm truncate">{author.displayName}</span>
            <span className="text-sm text-muted-foreground truncate">@{author.handle}</span>
          </div>

          {/* Post text */}
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{highlightedText}</p>

          {/* Link card */}
          <div className="mt-3 rounded-lg border overflow-hidden">
            <div className="flex">
              {/* Thumbnail */}
              {linkCard.thumbUrl && (
                <div className="w-[100px] h-[100px] flex-shrink-0 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={linkCard.thumbUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide broken images
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Card content */}
              <div className="flex-1 p-3 min-w-0">
                <p className="font-medium text-sm line-clamp-2">{linkCard.title}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {linkCard.description}
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <span>{domain}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
