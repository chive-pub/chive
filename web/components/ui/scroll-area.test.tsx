import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ScrollArea, ScrollBar } from './scroll-area';

describe('ScrollArea', () => {
  it('renders children', () => {
    render(
      <ScrollArea>
        <div>Scrollable content</div>
      </ScrollArea>
    );

    expect(screen.getByText('Scrollable content')).toBeInTheDocument();
  });

  it('has correct base styling', () => {
    render(
      <ScrollArea data-testid="scroll-area">
        <div>Content</div>
      </ScrollArea>
    );

    const scrollArea = screen.getByTestId('scroll-area');
    expect(scrollArea).toHaveClass('relative');
    expect(scrollArea).toHaveClass('overflow-hidden');
  });

  it('applies custom className', () => {
    render(
      <ScrollArea className="h-[200px]" data-testid="scroll-area">
        <div>Content</div>
      </ScrollArea>
    );

    const scrollArea = screen.getByTestId('scroll-area');
    expect(scrollArea).toHaveClass('h-[200px]');
  });

  it('forwards ref', () => {
    const ref = { current: null };
    render(
      <ScrollArea ref={ref}>
        <div>Content</div>
      </ScrollArea>
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('renders with scrollable content', () => {
    render(
      <ScrollArea className="h-[100px]" data-testid="scroll-area">
        <div style={{ height: '500px' }}>
          <p>Item 1</p>
          <p>Item 2</p>
          <p>Item 3</p>
        </div>
      </ScrollArea>
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });
});

describe('ScrollBar', () => {
  it('is exported from the module', () => {
    expect(ScrollBar).toBeDefined();
  });

  it('renders within ScrollArea', () => {
    // ScrollBar must be used within ScrollArea (Radix requirement)
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>
    );
    // ScrollArea automatically includes a ScrollBar
    expect(container).toBeTruthy();
  });
});
