import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Author } from '@/lib/api/schema';

/**
 * Props for the AuthorChip component.
 */
export interface AuthorChipProps {
  /** Author data */
  author: Author;
  /** Whether to show the avatar */
  showAvatar?: boolean;
  /** Size of the chip */
  size?: 'sm' | 'default';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays an author as a compact chip with optional avatar.
 *
 * @remarks
 * Server component that renders an author name with optional avatar.
 * Links to the author's profile page.
 *
 * @example
 * ```tsx
 * <AuthorChip
 *   author={{ did: 'did:plc:abc', displayName: 'Jane Doe' }}
 *   showAvatar
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the author chip
 */
export function AuthorChip({
  author,
  showAvatar = true,
  size = 'default',
  className,
}: AuthorChipProps) {
  const displayName = author.displayName || author.handle || shortenDid(author.did);
  const initials = getInitials(displayName);
  const avatarSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <Link
      href={`/authors/${encodeURIComponent(author.did)}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full transition-colors hover:text-primary',
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
      <span className="font-medium">{displayName}</span>
    </Link>
  );
}

/**
 * Gets initials from a display name.
 */
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Shortens a DID for display.
 */
function shortenDid(did: string): string {
  if (did.length <= 20) return did;
  return `${did.slice(0, 12)}...${did.slice(-6)}`;
}

/**
 * Props for the AuthorChipList component.
 */
export interface AuthorChipListProps {
  /** List of authors */
  authors: Author[];
  /** Maximum number of authors to display before truncating */
  max?: number;
  /** Whether to show avatars */
  showAvatars?: boolean;
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
 *
 * @example
 * ```tsx
 * <AuthorChipList
 *   authors={preprint.authors}
 *   max={3}
 *   showAvatars
 * />
 * ```
 */
export function AuthorChipList({
  authors,
  max = 5,
  showAvatars = true,
  size = 'default',
  className,
}: AuthorChipListProps) {
  const displayedAuthors = max > 0 ? authors.slice(0, max) : authors;
  const remainingCount = authors.length - displayedAuthors.length;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {displayedAuthors.map((author, index) => (
        <span key={author.did} className="inline-flex items-center">
          <AuthorChip author={author} showAvatar={showAvatars} size={size} />
          {index < displayedAuthors.length - 1 && (
            <span className="ml-2 text-muted-foreground">,</span>
          )}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className={cn('text-muted-foreground', textSize)}>+{remainingCount} more</span>
      )}
    </div>
  );
}
