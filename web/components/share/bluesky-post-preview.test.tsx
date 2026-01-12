import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlueskyPostPreview } from './bluesky-post-preview';

interface PostAuthor {
  displayName: string;
  handle: string;
  avatar?: string;
}

interface LinkCard {
  url: string;
  title: string;
  description: string;
  thumbUrl?: string;
}

const mockAuthor: PostAuthor = {
  displayName: 'Alice Smith',
  handle: 'alice.bsky.social',
  avatar: 'https://example.com/alice.jpg',
};

const mockLinkCard: LinkCard = {
  url: 'https://chive.pub/eprints/test',
  title: 'Test Eprint Title',
  description: 'This is a test description for the eprint.',
  thumbUrl: '/api/og?type=eprint',
};

describe('BlueskyPostPreview', () => {
  it('renders author information', () => {
    render(<BlueskyPostPreview author={mockAuthor} text="Hello world!" linkCard={mockLinkCard} />);

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('@alice.bsky.social')).toBeInTheDocument();
  });

  it('renders author avatar container', () => {
    const { container } = render(
      <BlueskyPostPreview author={mockAuthor} text="Hello world!" linkCard={mockLinkCard} />
    );

    // Avatar component renders with the avatar image as AvatarImage
    // In jsdom, images don't load so we see the fallback, but we can verify the img is present
    const avatarContainer = container.querySelector('[class*="rounded-full"]');
    expect(avatarContainer).toBeInTheDocument();
  });

  it('falls back to fallback avatar when no avatar provided', () => {
    const authorWithoutAvatar = { ...mockAuthor, avatar: undefined };
    render(
      <BlueskyPostPreview
        author={authorWithoutAvatar}
        text="Hello world!"
        linkCard={mockLinkCard}
      />
    );

    // Should show fallback (User icon), not the avatar image
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders post text', () => {
    render(<BlueskyPostPreview author={mockAuthor} text="Hello world!" linkCard={mockLinkCard} />);

    expect(screen.getByText('Hello world!')).toBeInTheDocument();
  });

  it('renders link card title and description', () => {
    render(
      <BlueskyPostPreview author={mockAuthor} text="Check this out!" linkCard={mockLinkCard} />
    );

    expect(screen.getByText('Test Eprint Title')).toBeInTheDocument();
    expect(screen.getByText('This is a test description for the eprint.')).toBeInTheDocument();
  });

  it('renders link card domain', () => {
    render(
      <BlueskyPostPreview author={mockAuthor} text="Check this out!" linkCard={mockLinkCard} />
    );

    expect(screen.getByText('chive.pub')).toBeInTheDocument();
  });

  it('renders link card thumbnail when provided', () => {
    const { container } = render(
      <BlueskyPostPreview author={mockAuthor} text="Check this out!" linkCard={mockLinkCard} />
    );

    // Decorative images with alt="" have role="presentation" and can't be found by getByRole('img')
    // Use querySelector for images with empty alt (standard approach per Testing Library docs)
    const thumbnail = container.querySelector('img[src="/api/og?type=eprint"]');
    expect(thumbnail).toBeInTheDocument();
  });

  it('does not render thumbnail when not provided', () => {
    const cardWithoutThumb = { ...mockLinkCard, thumbUrl: undefined };
    const { container } = render(
      <BlueskyPostPreview author={mockAuthor} text="Check this out!" linkCard={cardWithoutThumb} />
    );

    // Thumbnail should not be present
    const thumbnail = container.querySelector('img[src*="/api/og"]');
    expect(thumbnail).not.toBeInTheDocument();
  });

  it('highlights @mentions in text', () => {
    render(
      <BlueskyPostPreview
        author={mockAuthor}
        text="Hello @bob.bsky.social, how are you?"
        linkCard={mockLinkCard}
      />
    );

    // Use a different handle than the author to avoid duplicate matches
    const mention = screen.getByText('@bob.bsky.social');
    expect(mention).toHaveClass('text-blue-500');
  });

  it('highlights #hashtags in text', () => {
    render(
      <BlueskyPostPreview
        author={mockAuthor}
        text="Check out #science and #research"
        linkCard={mockLinkCard}
      />
    );

    expect(screen.getByText('#science')).toHaveClass('text-blue-500');
    expect(screen.getByText('#research')).toHaveClass('text-blue-500');
  });

  it('preserves whitespace in text', () => {
    render(<BlueskyPostPreview author={mockAuthor} text="Line 1" linkCard={mockLinkCard} />);

    // The container should preserve whitespace
    const textElement = screen.getByText('Line 1');
    expect(textElement.parentElement).toHaveClass('whitespace-pre-wrap');
  });

  it('extracts domain from URL for link card', () => {
    const cardWithLongUrl = {
      ...mockLinkCard,
      url: 'https://chive.pub/eprints/at://did:plc:xyz/pub.chive.eprint.submission/abc123',
    };
    render(
      <BlueskyPostPreview author={mockAuthor} text="Check this out!" linkCard={cardWithLongUrl} />
    );

    expect(screen.getByText('chive.pub')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <BlueskyPostPreview
        author={mockAuthor}
        text="Hello"
        linkCard={mockLinkCard}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles long text gracefully', () => {
    const longText = 'A'.repeat(400);
    render(<BlueskyPostPreview author={mockAuthor} text={longText} linkCard={mockLinkCard} />);

    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  it('handles special characters in text', () => {
    render(
      <BlueskyPostPreview
        author={mockAuthor}
        text="Test <script>alert('xss')</script>"
        linkCard={mockLinkCard}
      />
    );

    // Text should be escaped/safe
    expect(screen.getByText(/Test.*script/)).toBeInTheDocument();
  });
});
