import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PreprintCardSkeleton } from './preprint-card-skeleton';

describe('PreprintCardSkeleton', () => {
  it('renders a card structure', () => {
    const { container } = render(<PreprintCardSkeleton />);

    // Should have Card container
    const card = container.querySelector('.rounded-xl');
    expect(card).toBeInTheDocument();
  });

  it('renders title skeleton', () => {
    const { container } = render(<PreprintCardSkeleton />);

    // Title area should have skeleton elements
    const titleSkeletons = container.querySelectorAll('.h-6');
    expect(titleSkeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders abstract skeleton lines', () => {
    const { container } = render(<PreprintCardSkeleton />);

    // Abstract area should have h-4 skeleton lines
    const abstractSkeletons = container.querySelectorAll('.h-4');
    expect(abstractSkeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders field badge skeletons', () => {
    const { container } = render(<PreprintCardSkeleton />);

    // Should have rounded-full badges
    const badgeSkeletons = container.querySelectorAll('.rounded-full');
    expect(badgeSkeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders author avatar skeleton', () => {
    const { container } = render(<PreprintCardSkeleton />);

    // Should have circular avatar (h-8 w-8 rounded-full)
    const avatarSkeleton = container.querySelector('.h-8.w-8.rounded-full');
    expect(avatarSkeleton).toBeInTheDocument();
  });

  it('renders date skeleton', () => {
    const { container } = render(<PreprintCardSkeleton />);

    // Should have date skeleton (w-24)
    const dateSkeleton = container.querySelector('.w-24');
    expect(dateSkeleton).toBeInTheDocument();
  });

  it('has animate-pulse class on skeleton elements', () => {
    const { container } = render(<PreprintCardSkeleton />);

    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('uses bg-muted for skeleton background', () => {
    const { container } = render(<PreprintCardSkeleton />);

    const mutedElements = container.querySelectorAll('.bg-muted');
    expect(mutedElements.length).toBeGreaterThan(0);
  });
});
