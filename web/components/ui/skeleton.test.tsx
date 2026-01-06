import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders with base classes', () => {
    render(<Skeleton data-testid="skeleton" />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveClass('rounded-md');
    expect(skeleton).toHaveClass('bg-muted');
  });

  it('applies custom className', () => {
    render(<Skeleton className="h-4 w-20" data-testid="skeleton" />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('h-4');
    expect(skeleton).toHaveClass('w-20');
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('passes through additional props', () => {
    render(<Skeleton data-testid="skeleton" aria-label="Loading" />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading');
  });

  it('can be used with different sizes', () => {
    const { rerender } = render(<Skeleton className="h-4 w-[250px]" data-testid="skeleton" />);

    let skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('h-4');
    expect(skeleton).toHaveClass('w-[250px]');

    rerender(<Skeleton className="h-8 w-[100px]" data-testid="skeleton" />);

    skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('h-8');
    expect(skeleton).toHaveClass('w-[100px]');
  });

  it('can be styled as a circle for avatars', () => {
    render(<Skeleton className="h-12 w-12 rounded-full" data-testid="skeleton" />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('h-12');
    expect(skeleton).toHaveClass('w-12');
    expect(skeleton).toHaveClass('rounded-full');
  });
});
