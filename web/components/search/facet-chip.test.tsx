import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { FacetChip, FacetChipList } from './facet-chip';
import type { DynamicFacetFilters, FacetDefinition } from '@/lib/hooks/use-faceted-search';

describe('FacetChip', () => {
  it('renders facet label and value', () => {
    render(<FacetChip facetSlug="matter" facetLabel="Subject" value="physics" removable={false} />);
    expect(screen.getByText('Subject:')).toBeInTheDocument();
    expect(screen.getByText('physics')).toBeInTheDocument();
  });

  it('uses custom value label when provided', () => {
    render(
      <FacetChip
        facetSlug="matter"
        facetLabel="Subject"
        value="cs"
        valueLabel="Computer Science"
        removable={false}
      />
    );
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.queryByText('cs')).not.toBeInTheDocument();
  });

  it('shows remove button when removable', () => {
    render(
      <FacetChip
        facetSlug="matter"
        facetLabel="Subject"
        value="physics"
        removable
        onRemove={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('hides remove button when not removable', () => {
    render(<FacetChip facetSlug="matter" facetLabel="Subject" value="physics" removable={false} />);
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    render(
      <FacetChip facetSlug="matter" facetLabel="Subject" value="physics" onRemove={onRemove} />
    );

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('stops event propagation on remove', () => {
    const onRemove = vi.fn();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <FacetChip facetSlug="matter" facetLabel="Subject" value="physics" onRemove={onRemove} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('applies size variant', () => {
    render(
      <FacetChip
        facetSlug="matter"
        facetLabel="Subject"
        value="physics"
        size="sm"
        removable={false}
      />
    );
    const badge = screen.getByText('physics').closest('.gap-1');
    expect(badge).toHaveClass('text-xs');
  });

  it('applies custom className', () => {
    render(
      <FacetChip
        facetSlug="matter"
        facetLabel="Subject"
        value="physics"
        className="custom-chip"
        removable={false}
      />
    );
    const badge = screen.getByText('physics').closest('.gap-1');
    expect(badge).toHaveClass('custom-chip');
  });

  it('includes value label in remove button aria-label', () => {
    render(
      <FacetChip
        facetSlug="matter"
        facetLabel="Subject"
        value="physics"
        valueLabel="Physics"
        onRemove={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /remove physics filter/i })).toBeInTheDocument();
  });
});

describe('FacetChipList', () => {
  const mockFacets: FacetDefinition[] = [
    {
      slug: 'matter',
      label: 'Subject',
      values: [
        { value: 'physics', label: 'Physics', count: 10 },
        { value: 'chemistry', label: 'Chemistry', count: 5 },
      ],
    },
    {
      slug: 'person',
      label: 'Person',
      values: [{ value: 'einstein', label: 'Einstein', count: 3 }],
    },
  ];

  const filters: DynamicFacetFilters = {
    matter: ['physics', 'chemistry'],
    person: ['einstein'],
  };

  it('renders chips for all filter selections', () => {
    render(<FacetChipList facets={mockFacets} filters={filters} />);
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.getByText('Chemistry')).toBeInTheDocument();
    expect(screen.getByText('Einstein')).toBeInTheDocument();
  });

  it('returns null when no filters', () => {
    const { container } = render(<FacetChipList facets={mockFacets} filters={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when filters have empty arrays', () => {
    const { container } = render(<FacetChipList facets={mockFacets} filters={{ matter: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses labels from facet definitions', () => {
    render(<FacetChipList facets={mockFacets} filters={{ matter: ['physics'] }} />);
    expect(screen.getByText('Physics')).toBeInTheDocument();
  });

  it('falls back to value when no label in facet definition', () => {
    const facetsWithNoLabel: FacetDefinition[] = [
      {
        slug: 'matter',
        label: 'Subject',
        values: [{ value: 'unlabeled', count: 1 }],
      },
    ];
    render(<FacetChipList facets={facetsWithNoLabel} filters={{ matter: ['unlabeled'] }} />);
    expect(screen.getByText('unlabeled')).toBeInTheDocument();
  });

  it('calls onRemove with facet slug and value', () => {
    const onRemove = vi.fn();
    render(<FacetChipList facets={mockFacets} filters={filters} onRemove={onRemove} />);

    // Find and click the physics remove button
    const physicsChip = screen.getByText('Physics').closest('.gap-1');
    const removeButton = physicsChip?.querySelector('button');
    if (removeButton) {
      fireEvent.click(removeButton);
    }

    expect(onRemove).toHaveBeenCalledWith('matter', 'physics');
  });

  it('shows "Clear all" button when multiple chips and onClearAll provided', () => {
    render(<FacetChipList facets={mockFacets} filters={filters} onClearAll={() => {}} />);
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('hides "Clear all" button with single chip', () => {
    render(
      <FacetChipList facets={mockFacets} filters={{ matter: ['physics'] }} onClearAll={() => {}} />
    );
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('calls onClearAll when clicked', () => {
    const onClearAll = vi.fn();
    render(<FacetChipList facets={mockFacets} filters={filters} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('truncates chips beyond maxVisible', () => {
    const manyValuesFacet: FacetDefinition[] = [
      {
        slug: 'matter',
        label: 'Subject',
        values: [
          { value: 'a', label: 'A', count: 1 },
          { value: 'b', label: 'B', count: 1 },
          { value: 'c', label: 'C', count: 1 },
          { value: 'd', label: 'D', count: 1 },
          { value: 'e', label: 'E', count: 1 },
        ],
      },
    ];
    const manyFilters: DynamicFacetFilters = {
      matter: ['a', 'b', 'c', 'd', 'e'],
    };
    render(<FacetChipList facets={manyValuesFacet} filters={manyFilters} maxVisible={3} />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.queryByText('D')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <FacetChipList facets={mockFacets} filters={filters} className="custom-list-class" />
    );
    expect(container.firstChild).toHaveClass('custom-list-class');
  });

  it('handles filters for unknown facets gracefully', () => {
    render(<FacetChipList facets={mockFacets} filters={{ unknown: ['value'] }} />);
    // Should still render with the slug as the label
    expect(screen.getByText('unknown:')).toBeInTheDocument();
    expect(screen.getByText('value')).toBeInTheDocument();
  });
});
