import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { SearchHighlight, HighlightedSnippet } from './search-highlight';

describe('SearchHighlight', () => {
  it('renders plain text without highlights', () => {
    render(<SearchHighlight text="Plain text without highlights" />);
    expect(screen.getByText('Plain text without highlights')).toBeInTheDocument();
  });

  it('highlights text wrapped in em tags', () => {
    render(<SearchHighlight text="Results for <em>quantum</em> computing" />);

    // Check highlighted portion
    const mark = screen.getByText('quantum');
    expect(mark.tagName).toBe('MARK');

    // Check non-highlighted portions
    expect(screen.getByText('Results for')).toBeInTheDocument();
    expect(screen.getByText('computing')).toBeInTheDocument();
  });

  it('handles multiple highlights', () => {
    render(
      <SearchHighlight text="<em>Machine</em> learning and <em>artificial</em> intelligence" />
    );

    const marks = screen.getAllByRole('mark', { hidden: true });
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveTextContent('Machine');
    expect(marks[1]).toHaveTextContent('artificial');
  });

  it('handles highlight at start of text', () => {
    render(<SearchHighlight text="<em>First</em> word highlighted" />);
    expect(screen.getByText('First').tagName).toBe('MARK');
  });

  it('handles highlight at end of text', () => {
    render(<SearchHighlight text="Last word <em>highlighted</em>" />);
    expect(screen.getByText('highlighted').tagName).toBe('MARK');
  });

  it('handles adjacent highlights', () => {
    render(<SearchHighlight text="<em>Two</em><em>Words</em> together" />);
    expect(screen.getByText('Two').tagName).toBe('MARK');
    expect(screen.getByText('Words').tagName).toBe('MARK');
  });

  it('applies highlight styling', () => {
    render(<SearchHighlight text="<em>styled</em> text" />);
    const mark = screen.getByText('styled');
    expect(mark).toHaveClass('bg-yellow-200');
  });

  it('applies custom className', () => {
    const { container } = render(
      <SearchHighlight text="text" className="custom-highlight-class" />
    );
    expect(container.firstChild).toHaveClass('custom-highlight-class');
  });

  it('handles empty text', () => {
    const { container } = render(<SearchHighlight text="" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles text with only highlight', () => {
    render(<SearchHighlight text="<em>only highlighted</em>" />);
    expect(screen.getByText('only highlighted').tagName).toBe('MARK');
  });
});

describe('HighlightedSnippet', () => {
  const snippets = [
    'First <em>snippet</em> with highlight',
    'Second <em>snippet</em> here',
    'Third <em>snippet</em> text',
  ];

  it('renders snippets', () => {
    render(<HighlightedSnippet snippets={snippets} />);
    expect(screen.getAllByText('snippet')).toHaveLength(3);
  });

  it('limits visible snippets with max prop', () => {
    render(<HighlightedSnippet snippets={snippets} max={2} />);
    const marks = screen.getAllByRole('mark', { hidden: true });
    expect(marks).toHaveLength(2);
  });

  it('shows ellipsis before and after snippets', () => {
    const { container } = render(<HighlightedSnippet snippets={snippets.slice(0, 1)} />);
    // Ellipsis are rendered as text nodes within the paragraph
    const paragraph = container.querySelector('p');
    expect(paragraph?.textContent).toContain('...');
  });

  it('handles empty snippets array', () => {
    const { container } = render(<HighlightedSnippet snippets={[]} />);
    expect(container.querySelector('.space-y-1')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <HighlightedSnippet snippets={snippets} className="custom-snippet-class" />
    );
    expect(container.firstChild).toHaveClass('custom-snippet-class');
  });
});
