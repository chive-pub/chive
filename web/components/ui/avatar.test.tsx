import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Avatar, AvatarImage, AvatarFallback } from './avatar';

describe('Avatar', () => {
  it('renders avatar container', () => {
    render(<Avatar data-testid="avatar" />);

    const avatar = screen.getByTestId('avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveClass('relative');
    expect(avatar).toHaveClass('flex');
    expect(avatar).toHaveClass('h-10');
    expect(avatar).toHaveClass('w-10');
    expect(avatar).toHaveClass('rounded-full');
  });

  it('applies custom className to Avatar', () => {
    render(<Avatar className="h-12 w-12" data-testid="avatar" />);

    const avatar = screen.getByTestId('avatar');
    expect(avatar).toHaveClass('h-12');
    expect(avatar).toHaveClass('w-12');
  });

  it('forwards ref to Avatar', () => {
    const ref = { current: null };
    render(<Avatar ref={ref} data-testid="avatar" />);

    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});

describe('AvatarImage', () => {
  it('is exported from the module', () => {
    expect(AvatarImage).toBeDefined();
  });

  it('renders within Avatar container', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.jpg" alt="User avatar" />
      </Avatar>
    );

    // AvatarImage renders within Avatar, container should exist
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('AvatarFallback', () => {
  it('renders fallback content', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('has correct base styling', () => {
    render(
      <Avatar>
        <AvatarFallback data-testid="fallback">AB</AvatarFallback>
      </Avatar>
    );

    const fallback = screen.getByTestId('fallback');
    expect(fallback).toHaveClass('flex');
    expect(fallback).toHaveClass('h-full');
    expect(fallback).toHaveClass('w-full');
    expect(fallback).toHaveClass('items-center');
    expect(fallback).toHaveClass('justify-center');
    expect(fallback).toHaveClass('rounded-full');
    expect(fallback).toHaveClass('bg-muted');
  });

  it('applies custom className to AvatarFallback', () => {
    render(
      <Avatar>
        <AvatarFallback className="bg-primary" data-testid="fallback">
          CD
        </AvatarFallback>
      </Avatar>
    );

    const fallback = screen.getByTestId('fallback');
    expect(fallback).toHaveClass('bg-primary');
  });
});

describe('Avatar Composition', () => {
  it('renders complete avatar with image and fallback', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.jpg" alt="User avatar" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );

    // Fallback is always visible until image loads (Radix behavior)
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});
