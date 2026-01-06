import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { AuthorChip } from './author-chip';
import { createMockAuthor } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('AuthorChip', () => {
  it('renders author display name', () => {
    const author = createMockAuthor({ displayName: 'Dr. Jane Smith' });
    render(<AuthorChip author={author} />);
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
  });

  it('falls back to handle when no display name', () => {
    const author = createMockAuthor({ displayName: undefined, handle: 'janesmith.bsky.social' });
    render(<AuthorChip author={author} />);
    expect(screen.getByText('janesmith.bsky.social')).toBeInTheDocument();
  });

  it('falls back to shortened DID when no display name or handle', () => {
    const author = createMockAuthor({
      displayName: undefined,
      handle: undefined,
      did: 'did:plc:abcdefghijklmnopqrstuvwxyz',
    });
    render(<AuthorChip author={author} />);
    // Should show shortened DID format
    expect(screen.getByText(/did:plc:abcd/)).toBeInTheDocument();
  });

  it('links to author profile page', () => {
    const author = createMockAuthor({ did: 'did:plc:test123' });
    render(<AuthorChip author={author} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/authors/did%3Aplc%3Atest123');
  });

  it('shows avatar by default', () => {
    const author = createMockAuthor({ avatar: 'https://example.com/avatar.jpg' });
    const { container } = render(<AuthorChip author={author} />);
    // Avatar component uses Radix UI which renders a span container for the avatar
    // The AvatarImage is conditionally rendered based on image loading state
    const avatarContainer = container.querySelector('[class*="rounded-full"]');
    expect(avatarContainer).toBeInTheDocument();
  });

  it('hides avatar when showAvatar is false', () => {
    const author = createMockAuthor({ avatar: 'https://example.com/avatar.jpg' });
    render(<AuthorChip author={author} showAvatar={false} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows initials when no avatar', () => {
    const author = createMockAuthor({ avatar: undefined, displayName: 'Jane Smith' });
    render(<AuthorChip author={author} />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('shows single initial for single name', () => {
    const author = createMockAuthor({ avatar: undefined, displayName: 'Jane' });
    render(<AuthorChip author={author} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('applies sm size variant', () => {
    const author = createMockAuthor();
    render(<AuthorChip author={author} size="sm" />);
    const link = screen.getByRole('link');
    expect(link).toHaveClass('text-xs');
  });

  it('applies custom className', () => {
    const author = createMockAuthor();
    render(<AuthorChip author={author} className="custom-chip-class" />);
    const link = screen.getByRole('link');
    expect(link).toHaveClass('custom-chip-class');
  });
});
