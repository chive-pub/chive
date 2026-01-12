import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { AuthorChip, AuthorChipList } from './author-chip';
import { createMockPreprintAuthor } from '@/tests/mock-data';

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
  it('renders author name', () => {
    const author = createMockPreprintAuthor({ name: 'Dr. Jane Smith' });
    render(<AuthorChip author={author} />);
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
  });

  it('falls back to handle when no name', () => {
    const author = createMockPreprintAuthor({ name: '', handle: 'janesmith.bsky.social' });
    render(<AuthorChip author={author} />);
    expect(screen.getByText('janesmith.bsky.social')).toBeInTheDocument();
  });

  it('links to author profile page for ATProto users', () => {
    const author = createMockPreprintAuthor({ did: 'did:plc:test123' });
    render(<AuthorChip author={author} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/authors/did%3Aplc%3Atest123');
  });

  it('does not link for external collaborators', () => {
    const author = createMockPreprintAuthor({ did: undefined, name: 'External Author' });
    render(<AuthorChip author={author} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('External Author')).toBeInTheDocument();
  });

  it('shows avatar by default', () => {
    const author = createMockPreprintAuthor({ avatarUrl: 'https://example.com/avatar.jpg' });
    const { container } = render(<AuthorChip author={author} />);
    const avatarContainer = container.querySelector('[class*="rounded-full"]');
    expect(avatarContainer).toBeInTheDocument();
  });

  it('hides avatar when showAvatar is false', () => {
    const author = createMockPreprintAuthor({ avatarUrl: 'https://example.com/avatar.jpg' });
    render(<AuthorChip author={author} showAvatar={false} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows initials when no avatar', () => {
    const author = createMockPreprintAuthor({ avatarUrl: undefined, name: 'Jane Smith' });
    render(<AuthorChip author={author} />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('shows single initial for single name', () => {
    const author = createMockPreprintAuthor({ avatarUrl: undefined, name: 'Jane' });
    render(<AuthorChip author={author} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('shows corresponding author badge when showBadges is true', () => {
    const author = createMockPreprintAuthor({ isCorrespondingAuthor: true });
    render(<AuthorChip author={author} showBadges />);
    expect(screen.getByLabelText('Corresponding author')).toBeInTheDocument();
  });

  it('shows highlighted author badge when showBadges is true', () => {
    const author = createMockPreprintAuthor({ isHighlighted: true });
    render(<AuthorChip author={author} showBadges />);
    expect(screen.getByText('†')).toBeInTheDocument();
  });

  it('applies sm size variant', () => {
    const author = createMockPreprintAuthor();
    render(<AuthorChip author={author} size="sm" />);
    const link = screen.getByRole('link');
    expect(link.querySelector('span')).toHaveClass('text-xs');
  });

  it('applies custom className', () => {
    const author = createMockPreprintAuthor();
    render(<AuthorChip author={author} className="custom-chip-class" />);
    const link = screen.getByRole('link');
    expect(link.querySelector('span')).toHaveClass('custom-chip-class');
  });
});

describe('AuthorChipList', () => {
  it('renders all authors when under max', () => {
    const authors = [
      createMockPreprintAuthor({ did: 'did:plc:1', name: 'Author One' }),
      createMockPreprintAuthor({ did: 'did:plc:2', name: 'Author Two' }),
    ];
    render(<AuthorChipList authors={authors} />);
    expect(screen.getByText('Author One')).toBeInTheDocument();
    expect(screen.getByText('Author Two')).toBeInTheDocument();
  });

  it('truncates authors when over max', () => {
    const authors = [
      createMockPreprintAuthor({ did: 'did:plc:1', name: 'Author One' }),
      createMockPreprintAuthor({ did: 'did:plc:2', name: 'Author Two' }),
      createMockPreprintAuthor({ did: 'did:plc:3', name: 'Author Three' }),
    ];
    render(<AuthorChipList authors={authors} max={2} />);
    expect(screen.getByText('Author One')).toBeInTheDocument();
    expect(screen.getByText('Author Two')).toBeInTheDocument();
    expect(screen.queryByText('Author Three')).not.toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('shows equal contribution legend when highlighted authors present', () => {
    const authors = [
      createMockPreprintAuthor({ did: 'did:plc:1', name: 'Author One', isHighlighted: true }),
      createMockPreprintAuthor({ did: 'did:plc:2', name: 'Author Two', isHighlighted: true }),
    ];
    render(<AuthorChipList authors={authors} showBadges />);
    expect(screen.getByText('Equal contribution')).toBeInTheDocument();
  });
});
