import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { FacetChip, FacetChipList } from './facet-chip';
import type { FacetDimension } from '@/lib/utils/facets';

describe('FacetChip', () => {
  it('renders dimension label and value', () => {
    render(<FacetChip dimension="matter" value="physics" />);
    expect(screen.getByText('Matter:')).toBeInTheDocument();
    expect(screen.getByText('physics')).toBeInTheDocument();
  });

  it('uses custom label when provided', () => {
    render(<FacetChip dimension="matter" value="cs" label="Computer Science" />);
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.queryByText('cs')).not.toBeInTheDocument();
  });

  it('shows remove button when removable', () => {
    render(<FacetChip dimension="matter" value="physics" removable onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('hides remove button when not removable', () => {
    render(<FacetChip dimension="matter" value="physics" removable={false} />);
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    render(<FacetChip dimension="matter" value="physics" onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('stops event propagation on remove', () => {
    const onRemove = vi.fn();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <FacetChip dimension="matter" value="physics" onRemove={onRemove} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('applies dimension-specific color', () => {
    const { rerender, container } = render(
      <FacetChip dimension="personality" value="research" removable={false} />
    );
    // Check that some color class is applied (text-* class)
    expect(container.querySelector('[class*="text-"]')).toBeInTheDocument();

    rerender(<FacetChip dimension="person" value="einstein" removable={false} />);
    expect(container.querySelector('[class*="text-"]')).toBeInTheDocument();
  });

  it('applies size variant', () => {
    render(<FacetChip dimension="matter" value="physics" size="sm" removable={false} />);
    const badge = screen.getByText('physics').closest('.gap-1');
    expect(badge).toHaveClass('text-xs');
  });

  it('applies custom className', () => {
    render(
      <FacetChip dimension="matter" value="physics" className="custom-chip" removable={false} />
    );
    const badge = screen.getByText('physics').closest('.gap-1');
    expect(badge).toHaveClass('custom-chip');
  });

  it('includes value in remove button aria-label', () => {
    render(<FacetChip dimension="matter" value="physics" label="Physics" onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: /remove physics filter/i })).toBeInTheDocument();
  });
});

describe('FacetChipList', () => {
  const selections: Partial<Record<FacetDimension, string[]>> = {
    matter: ['physics', 'chemistry'],
    person: ['einstein'],
  };

  it('renders chips for all selections', () => {
    render(<FacetChipList selections={selections} />);
    expect(screen.getByText('physics')).toBeInTheDocument();
    expect(screen.getByText('chemistry')).toBeInTheDocument();
    expect(screen.getByText('einstein')).toBeInTheDocument();
  });

  it('returns null when no selections', () => {
    const { container } = render(<FacetChipList selections={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when selections have empty arrays', () => {
    const { container } = render(<FacetChipList selections={{ matter: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses labels when provided', () => {
    render(<FacetChipList selections={{ matter: ['phys'] }} labels={{ phys: 'Physics' }} />);
    expect(screen.getByText('Physics')).toBeInTheDocument();
    expect(screen.queryByText('phys')).not.toBeInTheDocument();
  });

  it('calls onRemove with dimension and value', () => {
    const onRemove = vi.fn();
    render(<FacetChipList selections={selections} onRemove={onRemove} />);

    // Find and click the physics remove button
    const physicsChip = screen.getByText('physics').closest('.gap-1');
    const removeButton = physicsChip?.querySelector('button');
    if (removeButton) {
      fireEvent.click(removeButton);
    }

    expect(onRemove).toHaveBeenCalledWith('matter', 'physics');
  });

  it('shows "Clear all" button when multiple chips and onClearAll provided', () => {
    render(<FacetChipList selections={selections} onClearAll={() => {}} />);
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('hides "Clear all" button with single chip', () => {
    render(<FacetChipList selections={{ matter: ['physics'] }} onClearAll={() => {}} />);
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('calls onClearAll when clicked', () => {
    const onClearAll = vi.fn();
    render(<FacetChipList selections={selections} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('truncates chips beyond maxVisible', () => {
    const manySelections: Partial<Record<FacetDimension, string[]>> = {
      matter: ['a', 'b', 'c', 'd', 'e'],
    };
    render(<FacetChipList selections={manySelections} maxVisible={3} />);

    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.queryByText('d')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <FacetChipList selections={selections} className="custom-list-class" />
    );
    expect(container.firstChild).toHaveClass('custom-list-class');
  });
});
