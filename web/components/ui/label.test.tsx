import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Label } from './label';
import { Input } from './input';

describe('Label', () => {
  it('renders label text', () => {
    render(<Label>Username</Label>);

    const label = screen.getByText('Username');
    expect(label).toBeInTheDocument();
  });

  it('has correct base styling', () => {
    render(<Label>Styled Label</Label>);

    const label = screen.getByText('Styled Label');
    expect(label).toHaveClass('text-sm');
    expect(label).toHaveClass('font-medium');
    expect(label).toHaveClass('leading-none');
  });

  it('applies custom className', () => {
    render(<Label className="custom-label">Custom</Label>);

    const label = screen.getByText('Custom');
    expect(label).toHaveClass('custom-label');
  });

  it('associates with input via htmlFor', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" />
      </>
    );

    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('for', 'email');
  });

  it('forwards ref', () => {
    const ref = { current: null };
    render(<Label ref={ref}>With ref</Label>);

    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });

  it('passes through additional props', () => {
    render(<Label data-testid="test-label">Props Test</Label>);

    const label = screen.getByTestId('test-label');
    expect(label).toBeInTheDocument();
  });

  it('has peer-disabled styling for disabled peer inputs', () => {
    render(<Label>Has Peer Styling</Label>);

    const label = screen.getByText('Has Peer Styling');
    expect(label).toHaveClass('peer-disabled:cursor-not-allowed');
    expect(label).toHaveClass('peer-disabled:opacity-70');
  });
});
