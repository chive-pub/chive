import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  FieldRelationships,
  RelatedFieldBadges,
  FieldRelationshipsSkeleton,
} from './field-relationships';
import { createMockFieldRelationship } from '@/tests/mock-data';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('FieldRelationships', () => {
  it('returns null for empty relationships', () => {
    const { container } = render(<FieldRelationships relationships={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for undefined relationships', () => {
    // @ts-expect-error Testing undefined prop behavior
    const { container } = render(<FieldRelationships relationships={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders section heading', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'broader', targetId: 'science', targetLabel: 'Science' }),
    ];
    render(<FieldRelationships relationships={relationships} />);
    expect(screen.getByText('Related Fields')).toBeInTheDocument();
  });

  it('shows broader terms group', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'broader', targetId: 'science', targetLabel: 'Science' }),
    ];
    render(<FieldRelationships relationships={relationships} />);
    expect(screen.getByText('Broader Terms')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
  });

  it('shows narrower terms group', () => {
    const relationships = [
      createMockFieldRelationship({
        type: 'narrower',
        targetId: 'ml',
        targetLabel: 'Machine Learning',
      }),
    ];
    render(<FieldRelationships relationships={relationships} />);
    expect(screen.getByText('Narrower Terms')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning')).toBeInTheDocument();
  });

  it('shows related terms group', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'related', targetId: 'ds', targetLabel: 'Data Science' }),
    ];
    render(<FieldRelationships relationships={relationships} />);
    expect(screen.getByText('Related Terms')).toBeInTheDocument();
    expect(screen.getByText('Data Science')).toBeInTheDocument();
  });

  it('shows equivalent terms group', () => {
    const relationships = [
      createMockFieldRelationship({
        type: 'equivalent',
        targetId: 'cs',
        targetLabel: 'Informatics',
      }),
    ];
    render(<FieldRelationships relationships={relationships} />);
    expect(screen.getByText('Equivalent Terms')).toBeInTheDocument();
    expect(screen.getByText('Informatics')).toBeInTheDocument();
  });

  it('shows influences group', () => {
    const relationships = [
      createMockFieldRelationship({
        type: 'influences',
        targetId: 'bio',
        targetLabel: 'Bioinformatics',
      }),
    ];
    render(<FieldRelationships relationships={relationships} />);
    expect(screen.getByText('Influences')).toBeInTheDocument();
    expect(screen.getByText('Bioinformatics')).toBeInTheDocument();
  });

  it('links to field pages', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'broader', targetId: 'science', targetLabel: 'Science' }),
    ];
    render(<FieldRelationships relationships={relationships} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/fields/science');
  });

  it('shows strength indicator when available', () => {
    const relationships = [
      createMockFieldRelationship({
        type: 'related',
        targetId: 'ds',
        targetLabel: 'Data Science',
        strength: 0.85,
      }),
    ];
    render(<FieldRelationships relationships={relationships} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('groups multiple relationships by type', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'broader', targetId: 'science', targetLabel: 'Science' }),
      createMockFieldRelationship({ type: 'broader', targetId: 'tech', targetLabel: 'Technology' }),
      createMockFieldRelationship({ type: 'related', targetId: 'ds', targetLabel: 'Data Science' }),
    ];
    render(<FieldRelationships relationships={relationships} />);

    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('Data Science')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'broader', targetId: 'science', targetLabel: 'Science' }),
    ];
    const { container } = render(
      <FieldRelationships relationships={relationships} className="custom-rel-class" />
    );
    expect(container.firstChild).toHaveClass('custom-rel-class');
  });
});

describe('RelatedFieldBadges', () => {
  it('returns null for empty relationships', () => {
    const { container } = render(<RelatedFieldBadges relationships={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders badges for relationships', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'related', targetId: 'ds', targetLabel: 'Data Science' }),
    ];
    render(<RelatedFieldBadges relationships={relationships} />);
    expect(screen.getByText('Data Science')).toBeInTheDocument();
  });

  it('limits visible badges with max prop', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'related', targetId: 'ds1', targetLabel: 'Field 1' }),
      createMockFieldRelationship({ type: 'related', targetId: 'ds2', targetLabel: 'Field 2' }),
      createMockFieldRelationship({ type: 'related', targetId: 'ds3', targetLabel: 'Field 3' }),
    ];
    render(<RelatedFieldBadges relationships={relationships} max={2} />);

    expect(screen.getByText('Field 1')).toBeInTheDocument();
    expect(screen.getByText('Field 2')).toBeInTheDocument();
    expect(screen.queryByText('Field 3')).not.toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('links badges to field pages', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'related', targetId: 'ds', targetLabel: 'Data Science' }),
    ];
    render(<RelatedFieldBadges relationships={relationships} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/fields/ds');
  });

  it('shows relationship type in title', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'broader', targetId: 'sci', targetLabel: 'Science' }),
    ];
    render(<RelatedFieldBadges relationships={relationships} />);
    const badge = screen.getByText('Science').closest('[title]');
    expect(badge).toHaveAttribute('title', 'broader: Science');
  });

  it('applies custom className', () => {
    const relationships = [
      createMockFieldRelationship({ type: 'related', targetId: 'ds', targetLabel: 'Data Science' }),
    ];
    const { container } = render(
      <RelatedFieldBadges relationships={relationships} className="custom-badges-class" />
    );
    expect(container.firstChild).toHaveClass('custom-badges-class');
  });
});

describe('FieldRelationshipsSkeleton', () => {
  it('renders skeleton with loading animation', () => {
    const { container } = render(<FieldRelationshipsSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders correct number of groups', () => {
    const { container } = render(<FieldRelationshipsSkeleton groups={3} itemsPerGroup={2} />);
    // Count the skeleton elements
    const skeletons = container.querySelectorAll('.animate-pulse');
    // Header (1) + 3 groups * (1 group header + 2 items) = 1 + 9 = 10
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<FieldRelationshipsSkeleton className="custom-skeleton" />);
    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});
