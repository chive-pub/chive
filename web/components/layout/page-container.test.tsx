/**
 * Tests for PageContainer component.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageContainer } from './page-container';

describe('PageContainer', () => {
  it('renders children', () => {
    render(
      <PageContainer variant="browse">
        <div data-testid="child">Content</div>
      </PageContainer>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies narrow variant class', () => {
    const { container } = render(<PageContainer variant="narrow">Content</PageContainer>);

    expect(container.firstChild).toHaveClass('max-w-3xl');
  });

  it('applies reading variant class', () => {
    const { container } = render(<PageContainer variant="reading">Content</PageContainer>);

    expect(container.firstChild).toHaveClass('max-w-4xl');
  });

  it('applies browse variant class', () => {
    const { container } = render(<PageContainer variant="browse">Content</PageContainer>);

    expect(container.firstChild).toHaveClass('max-w-7xl');
  });

  it('applies full variant class', () => {
    const { container } = render(<PageContainer variant="full">Content</PageContainer>);

    expect(container.firstChild).toHaveClass('container');
  });

  it('renders as different HTML elements', () => {
    const { container, rerender } = render(
      <PageContainer variant="browse" as="main">
        Content
      </PageContainer>
    );

    expect(container.querySelector('main')).toBeInTheDocument();

    rerender(
      <PageContainer variant="browse" as="section">
        Content
      </PageContainer>
    );
    expect(container.querySelector('section')).toBeInTheDocument();

    rerender(
      <PageContainer variant="browse" as="article">
        Content
      </PageContainer>
    );
    expect(container.querySelector('article')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageContainer variant="browse" className="custom-class">
        Content
      </PageContainer>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies default padding when padding is true', () => {
    const { container } = render(
      <PageContainer variant="browse" padding>
        Content
      </PageContainer>
    );

    expect(container.firstChild).toHaveClass('py-8');
  });

  it('omits padding when padding is false', () => {
    const { container } = render(
      <PageContainer variant="browse" padding={false}>
        Content
      </PageContainer>
    );

    expect(container.firstChild).not.toHaveClass('py-8');
  });
});
