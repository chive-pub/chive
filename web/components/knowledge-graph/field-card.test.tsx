import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { FieldCard, FieldCardSkeleton } from './field-card';
import { createMockFieldSummary, createMockFieldDetail } from '@/tests/mock-data';

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

describe('FieldCard', () => {
  it('renders field name', () => {
    const field = createMockFieldSummary({ name: 'Computer Science' });
    render(<FieldCard field={field} />);
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
  });

  it('links to field detail page', () => {
    const field = createMockFieldSummary({ id: 'cs-field' });
    render(<FieldCard field={field} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/fields/cs-field');
  });

  it('shows field description', () => {
    const field = createMockFieldDetail({
      description: 'The study of computation and information processing.',
    });
    render(<FieldCard field={field} />);
    expect(screen.getByText(/The study of computation/)).toBeInTheDocument();
  });

  it('shows preprint count', () => {
    const field = createMockFieldSummary({ preprintCount: 250 });
    render(<FieldCard field={field} />);
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  it('shows subfield count when available', () => {
    const field = createMockFieldSummary({ childCount: 12 });
    render(<FieldCard field={field} />);
    expect(screen.getByText('12 subfields')).toBeInTheDocument();
  });

  it('hides subfield count when zero', () => {
    const field = createMockFieldSummary({ childCount: 0 });
    render(<FieldCard field={field} />);
    expect(screen.queryByText(/subfields/)).not.toBeInTheDocument();
  });

  it('shows status badge', () => {
    const field = createMockFieldSummary({ status: 'approved' });
    render(<FieldCard field={field} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('shows proposed status', () => {
    const field = createMockFieldSummary({ status: 'proposed' });
    render(<FieldCard field={field} />);
    expect(screen.getByText('Proposed')).toBeInTheDocument();
  });

  it('shows deprecated status', () => {
    const field = createMockFieldSummary({ status: 'deprecated' });
    render(<FieldCard field={field} />);
    expect(screen.getByText('Deprecated')).toBeInTheDocument();
  });

  it('encodes special characters in URL', () => {
    const field = createMockFieldSummary({ id: 'field/with/slashes' });
    render(<FieldCard field={field} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/fields/field%2Fwith%2Fslashes');
  });

  it('applies custom className', () => {
    const field = createMockFieldSummary();
    const { container } = render(<FieldCard field={field} className="custom-field-class" />);
    expect(container.firstChild).toHaveClass('custom-field-class');
  });

  describe('compact variant', () => {
    it('renders compact layout', () => {
      const field = createMockFieldSummary();
      render(<FieldCard field={field} variant="compact" />);
      expect(screen.getByText('Computer Science')).toBeInTheDocument();
      // Compact shows preprints in different format
      expect(screen.getByText(/preprints/)).toBeInTheDocument();
    });
  });

  describe('featured variant', () => {
    it('renders featured layout with larger text', () => {
      const field = createMockFieldSummary();
      render(<FieldCard field={field} variant="featured" />);
      const link = screen.getByRole('link');
      expect(link).toHaveClass('text-xl');
    });

    it('shows separate preprint and subfield counts', () => {
      const field = createMockFieldSummary({ preprintCount: 100, childCount: 5 });
      render(<FieldCard field={field} variant="featured" />);
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Preprints')).toBeInTheDocument();
      expect(screen.getByText('Subfields')).toBeInTheDocument();
    });
  });
});

describe('FieldCardSkeleton', () => {
  it('renders default skeleton with loading animation', () => {
    const { container } = render(<FieldCardSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders compact skeleton', () => {
    const { container } = render(<FieldCardSkeleton variant="compact" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<FieldCardSkeleton className="custom-skeleton" />);
    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});
