import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { EprintListSkeleton } from './eprint-list-skeleton';

describe('EprintListSkeleton', () => {
  it('renders default count of 6 skeleton cards', () => {
    const { container } = render(<EprintListSkeleton />);

    // Count the number of Card components (rounded-xl border)
    const cards = container.querySelectorAll('.rounded-xl.border');
    expect(cards.length).toBe(6);
  });

  it('renders custom count of skeleton cards', () => {
    const { container } = render(<EprintListSkeleton count={3} />);

    const cards = container.querySelectorAll('.rounded-xl.border');
    expect(cards.length).toBe(3);
  });

  it('renders 10 skeleton cards when count is 10', () => {
    const { container } = render(<EprintListSkeleton count={10} />);

    const cards = container.querySelectorAll('.rounded-xl.border');
    expect(cards.length).toBe(10);
  });

  it('renders 1 skeleton card when count is 1', () => {
    const { container } = render(<EprintListSkeleton count={1} />);

    const cards = container.querySelectorAll('.rounded-xl.border');
    expect(cards.length).toBe(1);
  });

  it('renders 0 skeleton cards when count is 0', () => {
    const { container } = render(<EprintListSkeleton count={0} />);

    const cards = container.querySelectorAll('.rounded-xl.border');
    expect(cards.length).toBe(0);
  });

  it('has responsive grid layout', () => {
    const { container } = render(<EprintListSkeleton />);

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('lg:grid-cols-3');
  });

  it('has gap between cards', () => {
    const { container } = render(<EprintListSkeleton />);

    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('gap-6');
  });

  it('each card has unique key', () => {
    // This test ensures no React key warnings
    const { container } = render(<EprintListSkeleton count={5} />);

    const cards = container.querySelectorAll('.rounded-xl.border');
    expect(cards.length).toBe(5);
  });
});
