import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { EprintCardSkeleton } from './eprint-card-skeleton';

describe('EprintCardSkeleton', () => {
  it('renders a card structure', () => {
    const { container } = render(<EprintCardSkeleton />);

    // Should have Card container
    const card = container.querySelector('.rounded-xl');
    expect(card).toBeInTheDocument();
  });

  it('renders title skeleton', () => {
    const { container } = render(<EprintCardSkeleton />);

    // Title area should have skeleton elements
    const titleSkeletons = container.querySelectorAll('.h-6');
    expect(titleSkeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders abstract skeleton lines', () => {
    const { container } = render(<EprintCardSkeleton />);

    // Abstract area should have h-4 skeleton lines
    const abstractSkeletons = container.querySelectorAll('.h-4');
    expect(abstractSkeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders field badge skeletons', () => {
    const { container } = render(<EprintCardSkeleton />);

    // Should have rounded-full badges
    const badgeSkeletons = container.querySelectorAll('.rounded-full');
    expect(badgeSkeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders author avatar skeleton', () => {
    const { container } = render(<EprintCardSkeleton />);

    // Should have circular avatar (h-8 w-8 rounded-full)
    const avatarSkeleton = container.querySelector('.h-8.w-8.rounded-full');
    expect(avatarSkeleton).toBeInTheDocument();
  });

  it('renders date skeleton', () => {
    const { container } = render(<EprintCardSkeleton />);

    // Should have date skeleton (w-24)
    const dateSkeleton = container.querySelector('.w-24');
    expect(dateSkeleton).toBeInTheDocument();
  });

  it('has animate-pulse class on skeleton elements', () => {
    const { container } = render(<EprintCardSkeleton />);

    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('uses bg-muted for skeleton background', () => {
    const { container } = render(<EprintCardSkeleton />);

    const mutedElements = container.querySelectorAll('.bg-muted');
    expect(mutedElements.length).toBeGreaterThan(0);
  });
});
