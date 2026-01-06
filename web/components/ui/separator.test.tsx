import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Separator } from './separator';

describe('Separator', () => {
  it('renders with default horizontal orientation', () => {
    render(<Separator data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveClass('h-[1px]');
    expect(separator).toHaveClass('w-full');
    expect(separator).toHaveClass('bg-border');
  });

  it('renders with vertical orientation', () => {
    render(<Separator orientation="vertical" data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toHaveClass('h-full');
    expect(separator).toHaveClass('w-[1px]');
  });

  it('has decorative attribute by default', () => {
    render(<Separator data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('applies custom className', () => {
    render(<Separator className="my-4" data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toHaveClass('my-4');
    expect(separator).toHaveClass('bg-border');
  });

  it('passes through additional props', () => {
    render(<Separator data-testid="separator" aria-label="divider" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toHaveAttribute('aria-label', 'divider');
  });

  it('has shrink-0 class to prevent flex shrinking', () => {
    render(<Separator data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toHaveClass('shrink-0');
  });
});
