import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { EprintCard, EprintCardSkeleton } from './eprint-card';
import { createMockEprintSummary } from '@/tests/mock-data';
import { TEST_GRAPH_PDS_DID } from '@/tests/test-constants';

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

describe('EprintCard', () => {
  it('renders eprint title', () => {
    const eprint = createMockEprintSummary({ title: 'Machine Learning Advances' });
    render(<EprintCard eprint={eprint} />);
    expect(screen.getByText('Machine Learning Advances')).toBeInTheDocument();
  });

  it('links to eprint detail page', () => {
    const eprint = createMockEprintSummary({
      uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
    });
    render(<EprintCard eprint={eprint} />);
    const link = screen.getByRole('link', { name: /Machine Learning/ });
    expect(link).toHaveAttribute(
      'href',
      '/eprints/at%3A%2F%2Fdid%3Aplc%3Atest%2Fpub.chive.eprint.submission%2F123'
    );
  });

  it('shows author name', () => {
    const eprint = createMockEprintSummary();
    render(<EprintCard eprint={eprint} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows truncated abstract', () => {
    const eprint = createMockEprintSummary({
      abstract: 'This is a short abstract.',
    });
    render(<EprintCard eprint={eprint} />);
    expect(screen.getByText('This is a short abstract.')).toBeInTheDocument();
  });

  it('shows fields when available', () => {
    // EprintSummary has fields as FieldRef[] with uri and label
    const eprint = createMockEprintSummary({
      fields: [
        {
          uri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/8e31479f-01c0-5c1e-aae4-bd28b7cb0a7b`,
          label: 'Physics',
        },
        {
          uri: `at://${TEST_GRAPH_PDS_DID}/pub.chive.graph.node/3dfb025e-7733-5cb6-bc1b-9acd4ebc5e26`,
          label: 'Chemistry',
        },
      ],
    });
    render(<EprintCard eprint={eprint} />);
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByText('Chemistry')).toBeInTheDocument();
  });

  it('hides fields section when no fields', () => {
    const eprint = createMockEprintSummary({ fields: undefined });
    render(<EprintCard eprint={eprint} />);
    expect(screen.queryByText('Physics')).not.toBeInTheDocument();
  });

  it('does not show source information for EprintSummary (only TrendingEntry has source)', () => {
    // EprintSummary is a lean type without source info
    // Source is only shown for TrendingEntry type data
    const eprint = createMockEprintSummary();
    render(<EprintCard eprint={eprint} />);
    expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
  });

  it('calls onPrefetch on mouse enter', () => {
    const onPrefetch = vi.fn();
    const eprint = createMockEprintSummary({
      uri: 'at://did:plc:test/pub.chive.eprint.submission/123',
    });
    render(<EprintCard eprint={eprint} onPrefetch={onPrefetch} />);

    const card = screen.getByText(/Novel Approach to Machine Learning/).closest('.rounded-xl');
    fireEvent.mouseEnter(card!);

    expect(onPrefetch).toHaveBeenCalledWith('at://did:plc:test/pub.chive.eprint.submission/123');
  });

  it('applies custom className', () => {
    const eprint = createMockEprintSummary();
    const { container } = render(<EprintCard eprint={eprint} className="custom-card-class" />);
    expect(container.firstChild).toHaveClass('custom-card-class');
  });

  describe('compact variant', () => {
    it('renders compact layout', () => {
      const eprint = createMockEprintSummary();
      const { container } = render(<EprintCard eprint={eprint} variant="compact" />);
      // Compact variant uses div instead of Card
      expect(container.querySelector('.rounded-xl')).not.toBeInTheDocument();
    });

    it('shows title with single line truncation', () => {
      const eprint = createMockEprintSummary({ title: 'A Very Long Title' });
      render(<EprintCard eprint={eprint} variant="compact" />);
      // The text is rendered via RichTextRenderer inside an h4 with line-clamp-1
      const titleText = screen.getByText('A Very Long Title');
      const h4Element = titleText.closest('h4');
      expect(h4Element).toHaveClass('line-clamp-1');
    });
  });

  describe('featured variant', () => {
    it('renders featured layout', () => {
      const eprint = createMockEprintSummary();
      render(<EprintCard eprint={eprint} variant="featured" />);
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });

    it('shows larger title', () => {
      const eprint = createMockEprintSummary();
      render(<EprintCard eprint={eprint} variant="featured" />);
      const title = screen.getByText(/Novel Approach to Machine Learning/);
      const link = title.closest('a');
      expect(link).toHaveClass('text-xl');
    });

    it('calls onPrefetch on hover', () => {
      const onPrefetch = vi.fn();
      const eprint = createMockEprintSummary();
      render(<EprintCard eprint={eprint} variant="featured" onPrefetch={onPrefetch} />);

      const card = screen.getByText('Featured').closest('.rounded-xl');
      fireEvent.mouseEnter(card!);

      expect(onPrefetch).toHaveBeenCalled();
    });
  });
});

describe('EprintCardSkeleton', () => {
  it('renders default skeleton', () => {
    const { container } = render(<EprintCardSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders compact skeleton', () => {
    const { container } = render(<EprintCardSkeleton variant="compact" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<EprintCardSkeleton className="custom-skeleton" />);
    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});
