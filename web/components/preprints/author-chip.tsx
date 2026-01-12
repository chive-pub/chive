import Link from 'next/link';
import { Mail, ExternalLink } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PreprintAuthor } from '@/lib/api/schema';

export type { PreprintAuthor };

/**
 * Props for AuthorChip.
 */
export interface AuthorChipProps {
  /** Author data */
  author: PreprintAuthor;
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
          {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt={displayName} />}
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

      {/* ORCID link */}
      {author.orcid && (
        <a
          href={`https://orcid.org/${author.orcid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
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
                  .map((c) => c.typeLabel ?? c.typeId ?? 'Contribution')
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
  authors: PreprintAuthor[];
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
 *   authors={preprint.authors}
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
  const displayedAuthors = max > 0 ? authors.slice(0, max) : authors;
  const remainingCount = authors.length - displayedAuthors.length;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  // Check if any displayed authors are highlighted (for legend)
  const hasHighlighted = displayedAuthors.some((a) => a.isHighlighted);

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {displayedAuthors.map((author, index) => (
          <span key={author.did ?? `author-${index}`} className="inline-flex items-center">
            <AuthorChip
              author={author}
              showAvatar={showAvatars}
              showBadges={showBadges}
              size={size}
            />
            {index < displayedAuthors.length - 1 && (
              <span className="ml-2 text-muted-foreground">,</span>
            )}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className={cn('text-muted-foreground', textSize)}>+{remainingCount} more</span>
        )}
      </div>

      {/* Legend for highlighted authors */}
      {showBadges && hasHighlighted && (
        <div className={cn('text-muted-foreground', textSize)}>
          <span className="text-primary">†</span> Equal contribution
        </div>
      )}
    </div>
  );
}
