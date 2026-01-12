import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { EprintAbstract, StaticAbstract } from './eprint-abstract';

describe('EprintAbstract', () => {
  const shortAbstract = 'This is a short abstract.';
  const longAbstract =
    'This is a very long abstract that exceeds the default maximum length. ' +
    'It contains multiple sentences to test the truncation functionality. ' +
    'The abstract should be truncated at a word boundary for better readability. ' +
    'Users can expand it by clicking the show more button.';

  it('renders full text when below maxLength', () => {
    render(<EprintAbstract abstract={shortAbstract} />);
    expect(screen.getByText(shortAbstract)).toBeInTheDocument();
  });

  it('does not show expand button for short abstracts', () => {
    render(<EprintAbstract abstract={shortAbstract} />);
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  });

  it('truncates long abstracts', () => {
    render(<EprintAbstract abstract={longAbstract} maxLength={50} />);
    // Should not contain the full text
    expect(screen.queryByText(longAbstract)).not.toBeInTheDocument();
    // Should show ellipsis
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
  });

  it('shows expand button for long abstracts', () => {
    render(<EprintAbstract abstract={longAbstract} maxLength={50} />);
    expect(screen.getByText(/Show more/)).toBeInTheDocument();
  });

  it('expands on button click', () => {
    render(<EprintAbstract abstract={longAbstract} maxLength={50} />);
    const showMoreButton = screen.getByText(/Show more/);
    fireEvent.click(showMoreButton);

    // Should show full text after expansion
    expect(screen.getByText(longAbstract)).toBeInTheDocument();
    // Button should now say Show less
    expect(screen.getByText(/Show less/)).toBeInTheDocument();
  });

  it('collapses on second button click', () => {
    render(<EprintAbstract abstract={longAbstract} maxLength={50} />);

    // Expand
    fireEvent.click(screen.getByText(/Show more/));
    expect(screen.getByText(/Show less/)).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText(/Show less/));
    expect(screen.getByText(/Show more/)).toBeInTheDocument();
  });

  it('respects defaultExpanded prop', () => {
    render(<EprintAbstract abstract={longAbstract} maxLength={50} defaultExpanded />);
    // Should show full text initially
    expect(screen.getByText(longAbstract)).toBeInTheDocument();
    // Should show collapse button
    expect(screen.getByText(/Show less/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<EprintAbstract abstract={shortAbstract} className="custom-abstract-class" />);
    const container = screen.getByText(shortAbstract).closest('section');
    expect(container).toHaveClass('custom-abstract-class');
  });

  it('respects custom maxLength', () => {
    render(<EprintAbstract abstract={longAbstract} maxLength={100} />);
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

  it('renders full text when below maxLength', () => {
    render(<StaticAbstract abstract={shortAbstract} />);
    expect(screen.getByText(shortAbstract)).toBeInTheDocument();
  });

  it('truncates long abstracts with ellipsis', () => {
    render(<StaticAbstract abstract={longAbstract} maxLength={50} />);
    // Should contain ellipsis
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    // Should not contain full text
    expect(screen.queryByText(longAbstract)).not.toBeInTheDocument();
  });

  it('does not show expand button (static component)', () => {
    render(<StaticAbstract abstract={longAbstract} maxLength={50} />);
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StaticAbstract abstract={shortAbstract} className="custom-static-class" />);
    const text = screen.getByText(shortAbstract);
    expect(text).toHaveClass('custom-static-class');
  });

  it('respects custom maxLength', () => {
    const mediumAbstract = 'Medium length abstract for testing custom maxLength.';
    render(<StaticAbstract abstract={mediumAbstract} maxLength={20} />);
    // Should be truncated
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
  });
});
