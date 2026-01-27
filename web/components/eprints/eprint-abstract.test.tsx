import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { EprintAbstract, StaticAbstract } from './eprint-abstract';
import type { RichTextItem } from '@/lib/types/rich-text';

/**
 * Helper to create a text item for rich text content.
 */
function textItem(content: string): RichTextItem {
  return { type: 'text', content };
}

describe('EprintAbstract', () => {
  const shortAbstract = 'This is a short abstract.';
  const shortAbstractItems: RichTextItem[] = [textItem(shortAbstract)];
  const longAbstract =
    'This is a very long abstract that exceeds the default maximum length. ' +
    'It contains multiple sentences to test the truncation functionality. ' +
    'The abstract should be truncated at a word boundary for better readability. ' +
    'Users can expand it by clicking the show more button.';
  const longAbstractItems: RichTextItem[] = [textItem(longAbstract)];

  it('renders full text when below maxLength', () => {
    render(<EprintAbstract abstractItems={shortAbstractItems} />);
    expect(screen.getByText(shortAbstract)).toBeInTheDocument();
  });

  it('does not show expand button for short abstracts', () => {
    render(<EprintAbstract abstractItems={shortAbstractItems} />);
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  });

  it('truncates long abstracts', () => {
    render(<EprintAbstract abstractItems={longAbstractItems} maxLength={50} />);
    // Should show truncated content with line-clamp
    // The component uses CSS line-clamp, not text truncation with ellipsis
    const container = screen.getByRole('region', { name: 'Abstract' });
    expect(container).toBeInTheDocument();
  });

  it('shows expand button for long abstracts', () => {
    render(<EprintAbstract abstractItems={longAbstractItems} maxLength={50} />);
    expect(screen.getByText(/Show more/)).toBeInTheDocument();
  });

  it('expands on button click', () => {
    render(<EprintAbstract abstractItems={longAbstractItems} maxLength={50} />);
    const showMoreButton = screen.getByText(/Show more/);
    fireEvent.click(showMoreButton);

    // Should show full text after expansion
    expect(screen.getByText(longAbstract)).toBeInTheDocument();
    // Button should now say Show less
    expect(screen.getByText(/Show less/)).toBeInTheDocument();
  });

  it('collapses on second button click', () => {
    render(<EprintAbstract abstractItems={longAbstractItems} maxLength={50} />);

    // Expand
    fireEvent.click(screen.getByText(/Show more/));
    expect(screen.getByText(/Show less/)).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText(/Show less/));
    expect(screen.getByText(/Show more/)).toBeInTheDocument();
  });

  it('respects defaultExpanded prop', () => {
    render(<EprintAbstract abstractItems={longAbstractItems} maxLength={50} defaultExpanded />);
    // Should show full text initially
    expect(screen.getByText(longAbstract)).toBeInTheDocument();
    // Should show collapse button
    expect(screen.getByText(/Show less/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<EprintAbstract abstractItems={shortAbstractItems} className="custom-abstract-class" />);
    const container = screen.getByText(shortAbstract).closest('section');
    expect(container).toHaveClass('custom-abstract-class');
  });

  it('respects custom maxLength', () => {
    render(<EprintAbstract abstractItems={longAbstractItems} maxLength={100} />);
    // With 100 char max, show more button should appear
    expect(screen.getByText(/Show more/)).toBeInTheDocument();
  });
});

describe('StaticAbstract', () => {
  const shortAbstract = 'This is a short abstract.';
  const longAbstract =
    'This is a very long abstract that exceeds the default maximum length. ' +
    'It contains multiple sentences to test the truncation functionality. ' +
    'The abstract should be truncated at a word boundary for better readability.';

  it('renders full text when using text prop', () => {
    render(<StaticAbstract text={shortAbstract} />);
    expect(screen.getByText(shortAbstract)).toBeInTheDocument();
  });

  it('renders content with abstractItems prop', () => {
    const items: RichTextItem[] = [textItem(shortAbstract)];
    render(<StaticAbstract abstractItems={items} />);
    expect(screen.getByText(shortAbstract)).toBeInTheDocument();
  });

  it('applies CSS line-clamp for truncation', () => {
    render(<StaticAbstract text={longAbstract} maxLines={3} />);
    // The component uses CSS line-clamp, so we just verify it renders
    const container = screen.getByText(longAbstract);
    expect(container).toBeInTheDocument();
    // Check that maxLines style is applied (via inline styles)
    expect(container).toHaveStyle({ WebkitLineClamp: '3' });
  });

  it('does not show expand button (static component)', () => {
    render(<StaticAbstract text={longAbstract} maxLines={2} />);
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StaticAbstract text={shortAbstract} className="custom-static-class" />);
    const text = screen.getByText(shortAbstract);
    expect(text).toHaveClass('custom-static-class');
  });

  it('returns null when no content provided', () => {
    const { container } = render(<StaticAbstract />);
    expect(container.firstChild).toBeNull();
  });
});
