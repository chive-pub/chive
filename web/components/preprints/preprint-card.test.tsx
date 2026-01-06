import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { PreprintCard, PreprintCardSkeleton } from './preprint-card';
import { createMockPreprintSummary } from '@/tests/mock-data';

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

describe('PreprintCard', () => {
  it('renders preprint title', () => {
    const preprint = createMockPreprintSummary({ title: 'Machine Learning Advances' });
    render(<PreprintCard preprint={preprint} />);
    expect(screen.getByText('Machine Learning Advances')).toBeInTheDocument();
  });

  it('links to preprint detail page', () => {
    const preprint = createMockPreprintSummary({
      uri: 'at://did:plc:test/pub.chive.preprint.submission/123',
    });
    render(<PreprintCard preprint={preprint} />);
    const link = screen.getByRole('link', { name: /Machine Learning/ });
    expect(link).toHaveAttribute(
      'href',
      '/preprints/at%3A%2F%2Fdid%3Aplc%3Atest%2Fpub.chive.preprint.submission%2F123'
    );
  });

  it('shows author name', () => {
    const preprint = createMockPreprintSummary();
    render(<PreprintCard preprint={preprint} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows truncated abstract', () => {
    const preprint = createMockPreprintSummary({
      abstract: 'This is a short abstract.',
    });
    render(<PreprintCard preprint={preprint} />);
    expect(screen.getByText('This is a short abstract.')).toBeInTheDocument();
  });

  it('shows fields when available', () => {
    const preprint = createMockPreprintSummary({
      fields: [
        { uri: 'physics', name: 'Physics' },
        { uri: 'chemistry', name: 'Chemistry' },
      ],
    });
    render(<PreprintCard preprint={preprint} />);
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByText('Chemistry')).toBeInTheDocument();
  });

  it('hides fields section when no fields', () => {
    const preprint = createMockPreprintSummary({ fields: undefined });
    render(<PreprintCard preprint={preprint} />);
    expect(screen.queryByText('Physics')).not.toBeInTheDocument();
  });

  it('shows source information', () => {
    const preprint = createMockPreprintSummary();
    render(<PreprintCard preprint={preprint} />);
    expect(screen.getByText(/Source:/)).toBeInTheDocument();
  });

  it('calls onPrefetch on mouse enter', () => {
    const onPrefetch = vi.fn();
    const preprint = createMockPreprintSummary({
      uri: 'at://did:plc:test/pub.chive.preprint.submission/123',
    });
    render(<PreprintCard preprint={preprint} onPrefetch={onPrefetch} />);

    const card = screen.getByText(/Novel Approach to Machine Learning/).closest('.rounded-xl');
    fireEvent.mouseEnter(card!);

    expect(onPrefetch).toHaveBeenCalledWith('at://did:plc:test/pub.chive.preprint.submission/123');
  });

  it('applies custom className', () => {
    const preprint = createMockPreprintSummary();
    const { container } = render(
      <PreprintCard preprint={preprint} className="custom-card-class" />
    );
    expect(container.firstChild).toHaveClass('custom-card-class');
  });

  describe('compact variant', () => {
    it('renders compact layout', () => {
      const preprint = createMockPreprintSummary();
      const { container } = render(<PreprintCard preprint={preprint} variant="compact" />);
      // Compact variant uses div instead of Card
      expect(container.querySelector('.rounded-xl')).not.toBeInTheDocument();
    });

    it('shows title with single line truncation', () => {
      const preprint = createMockPreprintSummary({ title: 'A Very Long Title' });
      render(<PreprintCard preprint={preprint} variant="compact" />);
      expect(screen.getByText('A Very Long Title')).toHaveClass('line-clamp-1');
    });
  });

  describe('featured variant', () => {
    it('renders featured layout', () => {
      const preprint = createMockPreprintSummary();
      render(<PreprintCard preprint={preprint} variant="featured" />);
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });

    it('shows larger title', () => {
      const preprint = createMockPreprintSummary();
      render(<PreprintCard preprint={preprint} variant="featured" />);
      const title = screen.getByText(/Novel Approach to Machine Learning/);
      const link = title.closest('a');
      expect(link).toHaveClass('text-xl');
    });

    it('calls onPrefetch on hover', () => {
      const onPrefetch = vi.fn();
      const preprint = createMockPreprintSummary();
      render(<PreprintCard preprint={preprint} variant="featured" onPrefetch={onPrefetch} />);

      const card = screen.getByText('Featured').closest('.rounded-xl');
      fireEvent.mouseEnter(card!);

      expect(onPrefetch).toHaveBeenCalled();
    });
  });
});

describe('PreprintCardSkeleton', () => {
  it('renders default skeleton', () => {
    const { container } = render(<PreprintCardSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders compact skeleton', () => {
    const { container } = render(<PreprintCardSkeleton variant="compact" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<PreprintCardSkeleton className="custom-skeleton" />);
    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});
