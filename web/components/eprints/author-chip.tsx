'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ExternalLink } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { EprintAuthor } from '@/lib/api/schema';

export type { EprintAuthor };

/**
 * Props for AuthorChip.
 */
export interface AuthorChipProps {
  /** Author data */
  author: EprintAuthor;
  /** Whether to show the avatar */
  showAvatar?: boolean;
  /** Whether to show badges (corresponding, highlighted) */
  showBadges?: boolean;
  /** Size of the chip */
  size?: 'sm' | 'default';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays an author as a compact chip with optional avatar and badges.
 *
 * @remarks
 * Renders author name with optional avatar, corresponding author badge,
 * highlighted author badge, and ORCID link. Links to profile for ATProto users.
 *
 * @example
 * ```tsx
 * <AuthorChip
 *   author={{
 *     did: 'did:plc:abc',
 *     name: 'Jane Doe',
 *     isCorrespondingAuthor: true,
 *     isHighlighted: false,
 *   }}
 *   showBadges
 * />
 * ```
 */
export function AuthorChip({
  author,
  showAvatar = true,
  showBadges = false,
  size = 'default',
  className,
}: AuthorChipProps) {
  const displayName = author.name || author.handle || 'Unknown';
  const initials = getInitials(displayName);
  const avatarSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const hasProfile = !!author.did;

  // Handle ORCID click separately to avoid nested anchor issues
  const handleOrcidClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`https://orcid.org/${author.orcid}`, '_blank', 'noopener,noreferrer');
  };

  const chipContent = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full transition-colors',
        hasProfile && 'hover:text-primary',
        author.isHighlighted && 'font-semibold',
        textSize,
        className
      )}
    >
      {showAvatar && (
        <Avatar className={avatarSize}>
          {author.avatar && <AvatarImage src={author.avatar} alt={displayName} />}
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
      )}
      <span className={cn('font-medium', author.isHighlighted && 'text-primary')}>
        {displayName}
      </span>

      {/* Badges */}
      {showBadges && (
        <>
          {author.isHighlighted && (
            <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
              †
            </span>
          )}
          {author.isCorrespondingAuthor && (
            <Mail className="h-3 w-3 text-amber-600" aria-label="Corresponding author" />
          )}
        </>
      )}

      {/* ORCID button (not anchor to avoid nested <a> tags) */}
      {author.orcid && (
        <button
          type="button"
          onClick={handleOrcidClick}
          className="text-muted-foreground hover:text-primary"
          aria-label={`View ORCID profile for ${displayName}`}
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
    </span>
  );

  // Wrap with tooltip if author has contributions or affiliations
  const hasTooltipContent =
    (author.contributions && author.contributions.length > 0) ||
    (author.affiliations && author.affiliations.length > 0);

  const wrappedChip = hasTooltipContent ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chipContent}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 text-xs">
            {author.affiliations && author.affiliations.length > 0 && (
              <div>
                {author.affiliations.map((aff, i) => (
                  <div key={i}>
                    {aff.name}
                    {aff.department && `, ${aff.department}`}
                  </div>
                ))}
              </div>
            )}
            {author.contributions && author.contributions.length > 0 && (
              <div className="text-muted-foreground">
                {author.contributions
                  .map((c) => c.typeSlug ?? c.typeUri.split('/').pop() ?? 'Contribution')
                  .join(', ')}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    chipContent
  );

  // Link to profile if ATProto user
  if (hasProfile) {
    return <Link href={`/authors/${encodeURIComponent(author.did!)}`}>{wrappedChip}</Link>;
  }

  return wrappedChip;
}

/**
 * Gets initials from a name.
 */
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Props for AuthorChipList.
 */
export interface AuthorChipListProps {
  /** List of authors */
  authors: EprintAuthor[];
  /** Maximum number of authors to display before truncating */
  max?: number;
  /** Whether to show avatars */
  showAvatars?: boolean;
  /** Whether to show badges */
  showBadges?: boolean;
  /** Size of the chips */
  size?: 'sm' | 'default';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a list of author chips with optional truncation.
 *
 * @remarks
 * Renders multiple AuthorChip components with proper separators.
 * Shows "+N more" when there are more authors than the max limit.
 * Highlighted authors are visually distinguished with dagger symbol.
 *
 * @example
 * ```tsx
 * <AuthorChipList
 *   authors={eprint.authors}
 *   max={3}
 *   showBadges
 * />
 * ```
 */
export function AuthorChipList({
  authors,
  max = 5,
  showAvatars = true,
  showBadges = true,
  size = 'default',
  className,
}: AuthorChipListProps) {
  const [expanded, setExpanded] = useState(false);
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  // Contribution-aware display: always show all highlighted (equal contribution)
  // authors, then fill remaining slots from the rest
  const highlighted = authors.filter((a) => a.isHighlighted);
  const rest = authors.filter((a) => !a.isHighlighted);

  let displayedAuthors: EprintAuthor[];
  let remainingCount: number;

  if (expanded || max <= 0) {
    displayedAuthors = [...highlighted, ...rest];
    remainingCount = 0;
  } else {
    const restToShow = Math.max(0, max - highlighted.length);
    displayedAuthors = [...highlighted, ...rest.slice(0, restToShow)];
    remainingCount = authors.length - displayedAuthors.length;
  }

  // Count highlighted authors - only show legend if multiple authors have equal contribution
  const highlightedCount = displayedAuthors.filter((a) => a.isHighlighted).length;
  const showEqualContributionLegend = highlightedCount >= 2;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {displayedAuthors.map((author, index) => (
          <AuthorChip
            key={author.did ?? `author-${index}`}
            author={author}
            showAvatar={showAvatars}
            showBadges={showBadges}
            size={size}
          />
        ))}
        {remainingCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={cn('text-muted-foreground hover:text-foreground', textSize)}
          >
            +{remainingCount} more
          </button>
        )}
      </div>

      {/* Legend for highlighted authors - only show when multiple authors share equal contribution */}
      {showBadges && showEqualContributionLegend && (
        <div className={cn('text-muted-foreground', textSize)}>
          <span className="text-primary">†</span> Equal contribution
        </div>
      )}
    </div>
  );
}
